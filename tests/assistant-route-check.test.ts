import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Coordinates } from "@/lib/types";
import { OrsNoRouteError } from "@/lib/walk/ors-errors";

const p = (lat: number, lng: number): Coordinates => ({ lat, lng });
const origin = p(32, 34);
const north = p(32.01, 34);
const outAndBack = [origin, north, origin];
const square = [origin, north, p(32.01, 34.012), p(32, 34.012), origin];

const details = new Map<Coordinates[], { named: Array<{ name: string; path: Coordinates[] }>; stateRoads: Coordinates[][] | null }>();
let route: (w: Coordinates[], avoid: unknown) => Promise<Coordinates[]>;
const router = vi.fn((w: Coordinates[], avoid: unknown) => route(w, avoid));
let overpassDown = false;

vi.mock("@/lib/walk/ors-route", () => ({
  orsRoute: (w: Coordinates[], avoid: unknown) => router(w, avoid),
  isRouteCached: () => false,
  routeDetail: (g: Coordinates[]) => details.get(g),
}));
vi.mock("@/lib/walk/forbidden-ways", async (orig) => ({
  ...(await orig<typeof import("@/lib/walk/forbidden-ways")>()),
  fetchForbiddenWays: vi.fn(async (_c: Coordinates, _r: number, opts: { onError?: () => void }) => {
    if (overpassDown) opts.onError?.();
    return [];
  }),
}));
vi.mock("@/lib/api/ors-client", () => ({
  getMatrix: vi.fn(async (req: { locations: unknown[] }) => ({
    distances: req.locations.length === 3 ? [[0, 1100, 3000], [1100, 0, 2500], [3000, 2500, 0]] : req.locations.map((_, i) => req.locations.map((__, j) => Math.abs(i - j) * 1000)),
  })),
}));

import { EMPTY_STATE, type AssistantState } from "@/lib/assistant/state";
import { runTool } from "@/lib/assistant/tools";

const state = (params: AssistantState["params"]): AssistantState => ({
  ...EMPTY_STATE,
  origin,
  limitsSettled: true,
  params,
  candidates: [
    { id: "c1", name: "A", coordinates: north, category: "park", placeId: "a" },
    { id: "c2", name: "B", coordinates: p(32.01, 34.012), category: "food", placeId: "b" },
  ],
});
const call = async (name: string, args: object, st: AssistantState) => {
  const run = await runTool(name, JSON.stringify(args), st);
  return { run, out: JSON.parse(run.output) };
};

beforeEach(() => {
  router.mockClear();
  details.clear();
  overpassDown = false;
  route = async () => square;
});

describe("route check", () => {
  it("build_walk after estimate_walk reuses the check: no further routing", async () => {
    const st = state({ noRepeat: true, endDistanceKm: 0 });
    const est = await call("estimate_walk", { stop_ids: ["c1", "c2"] }, st);
    expect(est.out.verdict.ok).toBe(true);
    const used = router.mock.calls.length;
    const built = await call("build_walk", { stop_ids: ["c1", "c2"] }, est.run.state);
    expect(built.run.action?.stops).toHaveLength(2);
    expect(router.mock.calls.length).toBe(used);
  });

  it("a repeated street is not_met, build is refused, and alternatives come with numbers", async () => {
    route = async () => outAndBack;
    const st = state({ noRepeat: true, endDistanceKm: 0 });
    const est = await call("estimate_walk", { stop_ids: ["c1", "c2"] }, st);
    expect(est.out.verdict.ok).toBe(false);
    expect(est.out.verdict.rules.find((r: { rule: string }) => r.rule === "no_repeat").status).toBe("not_met");
    expect(est.out.alternatives.length).toBeGreaterThan(0);
    expect(est.out.alternatives[0].option).toContain("give up");
    const built = await call("build_walk", { stop_ids: ["c1", "c2"] }, st);
    expect(built.run.action).toBeUndefined();
    expect(built.out.error).toContain("breaks");
  });

  it("with the map service down, router street names still catch an avoided street", async () => {
    overpassDown = true;
    const g = [origin, north, origin];
    details.set(g, { named: [{ name: "הנביאים", path: [origin, north] }], stateRoads: null });
    route = async () => g;
    const st = state({ avoidStreets: ["רחוב הנביאים"] });
    const est = await call("estimate_walk", { stop_ids: ["c1", "c2"] }, st);
    expect(est.out.verdict.rules.find((r: { rule: string }) => r.rule === "avoid_streets").status).toBe("not_met");
  });

  it("with the map service down and no names, the rule is not_checked and never met", async () => {
    overpassDown = true;
    route = async () => square;
    const st = state({ avoidStreets: ["הנביאים"] });
    const est = await call("estimate_walk", { stop_ids: ["c1", "c2"] }, st);
    expect(est.out.verdict.rules.find((r: { rule: string }) => r.rule === "avoid_streets").status).toBe("not_checked");
    expect(est.out.verdict.ok).toBe(false);
    // not_checked does not block a build, but it is reported
    const built = await call("build_walk", { stop_ids: ["c1", "c2"] }, st);
    expect(built.run.action).toBeDefined();
    expect(built.out.not_checked).toBeDefined();
  });

  it("a router failure gives not_checked verdicts instead of a tool error", async () => {
    route = async () => {
      throw new Error("Routing quota exceeded.");
    };
    const st = state({ noRepeat: true, endDistanceKm: 0 });
    const est = await call("estimate_walk", { stop_ids: ["c1", "c2"] }, st);
    expect(est.out.error).toBeUndefined();
    expect(est.out.verdict.rules.every((r: { status: string }) => r.status === "not_checked")).toBe(true);
  });

  it("with a stroller, 'no route' fails that set (no_steps) instead of looking like an outage", async () => {
    const { OrsNoRouteError } = await import("@/lib/walk/ors-errors");
    route = async () => {
      throw new OrsNoRouteError("No valid route could be found with these constraints.");
    };
    const st = state({ access: "stroller" });
    const est = await call("estimate_walk", { stop_ids: ["c1", "c2"] }, st);
    expect(est.out.verdict.unavailable).toBeUndefined();
    expect(est.out.verdict.broken).toBe(true);
    expect(est.out.verdict.rules.find((r: { rule: string }) => r.rule === "no_steps").status).toBe("not_met");
  });

  it("a walk in Paris planned from a phone in New York reads 10:00 as Paris time: the cafe that opens at 13:00 is closed", async () => {
    const days = [0, 1, 2, 3, 4, 5, 6].map((day) => ({ open: { day, minute: 780 }, close: { day, minute: 1080 } }));
    const st = state({ timeZone: "America/New_York" });
    st.candidates[1] = { ...st.candidates[1], hours: { utcOffsetMin: 120, periods: days } };
    const clock = await call("set_clock", { start_time: "10:00" }, st);
    expect(clock.out.zone).toBe("UTC+02:00");
    const est = await call("estimate_walk", { stop_ids: ["c1", "c2"], ordered: true }, clock.run.state);
    expect(est.out.verdict.rules.find((r: { rule: string }) => r.rule === "open_hours").status).toBe("not_met");
  });

  it("check_weather uses the start set by set_clock and returns one recommendation", async () => {
    const iso = (ms: number) => new Date(ms).toISOString().slice(0, 16);
    const base = Date.now();
    const time = Array.from({ length: 72 }, (_, i) => iso(base + i * 3_600_000));
    const code = time.map((_, i) => (i >= 2 && i <= 4 ? 95 : 0));
    const zeros = time.map(() => 0);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      hourly: { time, apparent_temperature: time.map(() => 20), precipitation_probability: zeros, precipitation: zeros, wind_gusts_10m: zeros, weather_code: code },
      daily: { time: [iso(base).slice(0, 10)], sunrise: [iso(base - 40 * 3_600_000)], sunset: [iso(base + 40 * 3_600_000)] },
    }))));
    const st = state({ startAt: base + 2.5 * 3_600_000, timeMinutes: 120 });
    const r = await call("check_weather", { start_in_hours: 0, duration_minutes: 120 }, st);
    vi.unstubAllGlobals();
    expect(r.out.startKnown).toBe(true);
    expect(r.out.issues.some((i: { kind: string }) => i.kind === "thunderstorm")).toBe(true);
    expect(r.out.recommendation).toMatchObject({ at: expect.any(String) });
  });

  it("find_clean_walk tries another set when the router has no route for one of them", async () => {
    const st = state({ timeMinutes: 600, endDistanceKm: 0 });
    st.candidates.push({ id: "c3", name: "C", coordinates: p(32.02, 34.02), category: "museum", placeId: "c" });
    route = async (w) => {
      if (w.some((x) => x.lat === north.lat && x.lng === north.lng)) throw new OrsNoRouteError("No valid route");
      return square;
    };
    const r = await call("find_clean_walk", { count: 2 }, st);
    expect(r.out.error).toBeUndefined();
    expect([...r.out.stop_ids].sort()).toEqual(["c2", "c3"]);
  });

  it("clear removes a rule the walker gives up", async () => {
    const st = state({ noRepeat: true, avoidStreets: ["x"], endDistanceKm: 0 });
    const r = await call("set_walk_params", { clear: ["no_repeat", "avoid_streets"] }, st);
    expect(r.run.state.params.noRepeat).toBeUndefined();
    expect(r.run.state.params.avoidStreets).toBeUndefined();
    expect(r.run.state.params.endDistanceKm).toBe(0);
  });
});
