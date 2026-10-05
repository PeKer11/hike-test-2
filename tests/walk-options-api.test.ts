import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetDirections = vi.fn();

vi.mock("@/lib/api/ors-client", () => ({
  getDirections: (...args: unknown[]) => mockGetDirections(...args),
}));

import { POST } from "@/app/api/walk-options/route";
import { buildAvoidPolygons } from "@/lib/walk/avoid-polygons";
import { haversineDistance } from "@/lib/utils/geo";
import { at } from "./helpers/discovery";

function encodeValue(value: number): string {
  let v = value < 0 ? ~(value << 1) : value << 1;
  let out = "";
  while (v >= 0x20) {
    out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  return out + String.fromCharCode(v + 63);
}

function encode(points: Array<{ lat: number; lng: number }>): string {
  let prevLat = 0;
  let prevLng = 0;
  let out = "";
  for (const p of points) {
    const lat = Math.round(p.lat * 1e5);
    const lng = Math.round(p.lng * 1e5);
    out += encodeValue(lat - prevLat) + encodeValue(lng - prevLng);
    prevLat = lat;
    prevLng = lng;
  }
  return out;
}

const ORIGIN = at(0, 0);
const WALKED = [at(0, -1000), at(0, -500), ORIGIN];
// Routes leaving the walker: north/east/west do not retrace the walked track.
const NORTH = [ORIGIN, at(0, 600)];
const EAST = [ORIGIN, at(600, 0)];
const WEST = [ORIGIN, at(-600, 0)];
const BACK = [ORIGIN, at(0, -600)]; // retraces the walked track

const routeOf = (points: typeof NORTH, distance = 600) => ({
  routes: [{ summary: { distance, duration: 480 }, geometry: encode(points) }],
});

function request(body: unknown, ip = "9.9.9.9"): Request {
  return new Request("http://localhost/api/walk-options", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

const opt = (theme: string, stops = [at(0, 500)], extra = {}) => ({
  theme,
  mode: "via",
  stops,
  ...extra,
});

const base = { origin: ORIGIN, walked: WALKED };

beforeEach(() => {
  mockGetDirections.mockReset();
});

describe("POST /api/walk-options", () => {
  it("makes one directions call per option and never retries clean options", async () => {
    mockGetDirections
      .mockResolvedValueOnce(routeOf(NORTH))
      .mockResolvedValueOnce(routeOf(EAST))
      .mockResolvedValueOnce(routeOf(WEST));
    const res = await POST(
      request({
        ...base,
        options: [opt("nature", [at(0, 500)]), opt("food", [at(500, 0)]), opt("short", [at(-500, 0)])],
      }),
    );
    expect(res.status).toBe(200);
    expect(mockGetDirections).toHaveBeenCalledTimes(3);
    const body = await res.json();
    expect(body.options.map((o: { theme: string }) => o.theme)).toEqual(["nature", "food", "short"]);
    expect(body.options[0]).toMatchObject({ distanceM: 600, minutes: 8, overlapWalked: 0 });
    expect(body.options[0].geometry.length).toBeGreaterThanOrEqual(2);
  });

  it("passes coordinates as [lng,lat] with origin, stops and end anchor in order", async () => {
    mockGetDirections.mockResolvedValueOnce(routeOf(NORTH));
    await POST(request({ ...base, endAnchor: at(0, 900), options: [opt("nature", [at(0, 400)])] }));
    const call = mockGetDirections.mock.calls[0][0];
    expect(call.coordinates).toHaveLength(3);
    expect(call.coordinates[0]).toEqual([ORIGIN.lng, ORIGIN.lat]);
    expect(call.coordinates[1][0]).toBeCloseTo(at(0, 400).lng, 6);
    expect(call.coordinates[2][1]).toBeCloseTo(at(0, 900).lat, 6);
    expect(call.instructions).toBe(false);
    expect(call.options).toBeUndefined();
  });

  it("retries only the worst retracing option, once, with avoid polygons that spare the origin and stops", async () => {
    const stop = at(0, -500);
    mockGetDirections
      .mockResolvedValueOnce(routeOf(NORTH))
      .mockResolvedValueOnce(routeOf(BACK)) // retraces: overlap 1
      .mockResolvedValueOnce(routeOf(EAST)); // the retry
    const res = await POST(
      request({ ...base, options: [opt("nature"), opt("food", [stop]), opt("short", [at(500, 0)])] }),
    );
    // third option answered by the queue's last value (retry order): calls = 3 initial + 1 retry
    expect(mockGetDirections.mock.calls.length).toBeLessThanOrEqual(4);
    expect(mockGetDirections).toHaveBeenCalledTimes(4);
    const retry = mockGetDirections.mock.calls[3][0];
    const avoid = retry.options.avoid_polygons;
    expect(avoid.type).toBe("MultiPolygon");
    const vertices: Array<[number, number]> = avoid.coordinates.flat(2);
    expect(vertices.length).toBeGreaterThan(0);
    for (const [lng, lat] of vertices) {
      expect(haversineDistance({ lat, lng }, ORIGIN)).toBeGreaterThan(79);
      expect(haversineDistance({ lat, lng }, stop)).toBeGreaterThan(79);
    }
    for (const ring of avoid.coordinates.flat(1)) expect(ring.length).toBeLessThanOrEqual(40);
    expect(res.status).toBe(200);
  });

  it("does not retry when every option stays under 25% walked overlap", async () => {
    mockGetDirections.mockResolvedValue(routeOf(EAST));
    await POST(request({ ...base, options: [opt("nature")] }));
    expect(mockGetDirections).toHaveBeenCalledTimes(1);
  });

  it("drops an option still retracing after the retry, and 422s when none survive", async () => {
    mockGetDirections.mockResolvedValue(routeOf(BACK));
    const res = await POST(request({ ...base, options: [opt("nature"), opt("food")] }));
    expect(res.status).toBe(422);
    expect(mockGetDirections.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it("drops near-duplicate options, keeping the higher score", async () => {
    mockGetDirections
      .mockResolvedValueOnce(routeOf(NORTH))
      .mockResolvedValueOnce(routeOf(NORTH))
      .mockResolvedValueOnce(routeOf(EAST));
    const res = await POST(
      request({
        ...base,
        options: [opt("nature", [at(0, 500)], { score: 1 }), opt("food", [at(0, 480)], { score: 3 }), opt("short", [at(500, 0)], { score: 2 })],
      }),
    );
    const themes = (await res.json()).options.map((o: { theme: string }) => o.theme);
    expect(themes).toEqual(["food", "short"]);
  });

  it("drops options that mostly retrace the abandoned plan, except 'back'", async () => {
    mockGetDirections.mockResolvedValue(routeOf(NORTH));
    const plan = [ORIGIN, at(0, 700)];
    const res = await POST(request({ ...base, abandonedPlan: plan, options: [opt("nature"), opt("back")] }));
    const themes = (await res.json()).options.map((o: { theme: string }) => o.theme);
    expect(themes).toEqual(["back"]);
  });

  it("uses one round-trip call with a green weighting, and picks the least-walked alternative", async () => {
    mockGetDirections.mockResolvedValueOnce(routeOf(WEST));
    await POST(
      request({
        ...base,
        options: [{ theme: "nature", mode: "roundtrip", stops: [], seed: 2, roundTripLengthM: 3800 }],
      }),
    );
    const rt = mockGetDirections.mock.calls[0][0];
    expect(rt.coordinates).toHaveLength(1);
    expect(rt.options.round_trip).toEqual({ length: 3800, points: 3, seed: 2 });
    expect(rt.options.profile_params).toEqual({ weightings: { green: 1 } });

    mockGetDirections.mockReset();
    mockGetDirections.mockResolvedValueOnce({
      routes: [routeOf(BACK).routes[0], routeOf(EAST).routes[0]],
    });
    const res = await POST(
      request({ ...base, endAnchor: at(600, 0), options: [{ theme: "short", mode: "alternatives", stops: [] }] }, "9.9.9.8"),
    );
    const alt = mockGetDirections.mock.calls[0][0];
    expect(alt.options.alternative_routes).toMatchObject({ target_count: 2, share_factor: 0.5, weight_factor: 1.6 });
    expect((await res.json()).options[0].overlapWalked).toBe(0);
  });

  it("returns 502 when every directions call fails", async () => {
    mockGetDirections.mockImplementation(async () => {
      throw new Error("ORS down");
    });
    const res = await POST(request({ ...base, options: [opt("nature")] }));
    expect(res.status).toBe(502);
  });

  it.each([
    ["non-finite origin", { ...base, origin: { lat: "x", lng: 1 }, options: [opt("nature")] }],
    ["too many options", { ...base, options: [opt("nature"), opt("food"), opt("short"), opt("back")] }],
    ["no options", { ...base, options: [] }],
    ["bad theme", { ...base, options: [opt("spicy")] }],
    ["bad mode", { ...base, options: [{ theme: "nature", mode: "teleport", stops: [] }] }],
    ["too many stops", { ...base, options: [opt("nature", Array.from({ length: 5 }, () => at(0, 300)))] }],
    ["too many walked points", { ...base, walked: Array.from({ length: 61 }, () => ORIGIN), options: [opt("nature")] }],
    ["stop out of range", { ...base, options: [opt("nature", [{ lat: 95, lng: 0 }])] }],
    ["stop absurdly far", { ...base, options: [opt("nature", [at(0, 90_000)])] }],
    ["alternatives without anchor", { ...base, options: [{ theme: "short", mode: "alternatives", stops: [] }] }],
    ["roundtrip without length", { ...base, options: [{ theme: "nature", mode: "roundtrip", stops: [] }] }],
    ["roundtrip too long", { ...base, options: [{ theme: "nature", mode: "roundtrip", stops: [], roundTripLengthM: 9e9 }] }],
  ])("400s on %s", async (_name, body) => {
    const res = await POST(request(body));
    expect(res.status).toBe(400);
    expect(mockGetDirections).not.toHaveBeenCalled();
  });

  it("400s on a malformed body", async () => {
    const res = await POST(
      new Request("http://localhost/api/walk-options", { method: "POST", body: "{nope", headers: { "x-forwarded-for": "9.9.9.7" } }),
    );
    expect(res.status).toBe(400);
  });
});

describe("buildAvoidPolygons", () => {
  it("is null for a track too wide for ORS", () => {
    expect(buildAvoidPolygons([at(0, 0), at(0, 25_000)], [])).toBeNull();
    expect(buildAvoidPolygons([ORIGIN], [])).toBeNull();
  });

  it("covers the track outside the keep-disks and nothing inside them", () => {
    const poly = buildAvoidPolygons([at(0, -1000), at(0, 0)], [at(0, 0)])!;
    const ys = poly.coordinates.flat(2).map(([, lat]) => lat);
    // northern limit is ~80 m south of the walker
    expect(Math.max(...ys)).toBeLessThan(at(0, -79).lat);
    expect(Math.min(...ys)).toBeLessThan(at(0, -990).lat);
  });
});
