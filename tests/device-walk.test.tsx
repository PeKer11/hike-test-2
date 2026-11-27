/**
 * Device classes through the real WalkPlannerApp (locate() mocked): Doppler stuck at 0, and fixes worse than 50 m.
 * From docs/DEVICE-MOVEMENT-PLAN-2026-11-25.md section 4.
 */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Attraction, Coordinates, WalkPlan, WalkSegment } from "@/lib/types";
import { DEFAULT_WALK_SETTINGS } from "@/lib/types/walk-settings";

// A fake GPS for the walk; every other locate() caller gets an inert one.
type Fix = { coordinates: Coordinates; accuracyMeters: number; timestamp: number; source: "gps"; speedMps?: number };
let walkOnUpdate: ((fix: Fix) => void) | null = null;
vi.mock("@/lib/geo/locate", async (orig) => ({
  ...(await orig<typeof import("@/lib/geo/locate")>()),
  geolocationSupported: () => true,
  locate: (o: { purpose: string; onUpdate: (f: Fix) => void }) => {
    if (o.purpose === "walk") walkOnUpdate = o.onUpdate;
    return { stop: () => {} };
  },
}));

const mapCalls: any[] = [];
vi.mock("@/components/map", () => ({
  DynamicMap: (props: any) => {
    mapCalls.push(props);
    return <div data-testid="map" />;
  },
}));
// Signed out while the walk is planned from the form; signed in once it is under way (the chat only exists then).
let signedIn = false;
vi.mock("@/lib/hooks/useIsSignedIn", () => ({ useIsSignedIn: () => signedIn }));
// A signed-in screen has a sign-out button and links; there is no app router in a unit test.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { WalkPlannerApp } = await import("@/components/planner/WalkPlannerApp");

const ORIGIN: Coordinates = { lat: 32.08, lng: 34.78 };
const ROUTE: Coordinates[] = [ORIGIN, { lat: 32.116, lng: 34.78 }];
const stop = (id: string, name: string, lat: number): Attraction => ({
  id,
  name,
  coordinates: { lat, lng: 34.78 },
  category: "museum",
  avgVisitMinutes: 5,
  tags: {},
});
const STOPS = [stop("a1", "City Museum", 32.09), stop("a2", "Old Cathedral", 32.11)];
const segmentTo = (to: Attraction): WalkSegment => ({
  from: { name: "origin", coordinates: ORIGIN },
  to,
  distanceMeters: 900,
  walkingMinutes: 13,
});
const PLAN: WalkPlan = {
  orderedAttractions: STOPS,
  segments: STOPS.map(segmentTo),
  totalDistanceMeters: 4000,
  totalMinutes: 99,
  feasible: true,
  droppedAttractions: [],
  geometry: ROUTE,
};


async function flush() {
  await act(async () => {});
}
async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
  await flush();
}

beforeEach(() => {
  vi.useFakeTimers();
  signedIn = false;
  mapCalls.length = 0;
  const store: Record<string, string> = { "walk-settings": JSON.stringify({ ...DEFAULT_WALK_SETTINGS, learningConsent: (globalThis as any).__consent ?? DEFAULT_WALK_SETTINGS.learningConsent }) };
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => void (store[k] = v), removeItem: (k: string) => void delete store[k], clear: () => {} },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (typeof url === "string" && url.startsWith("/api/walk-plan")) return { ok: true, json: async () => PLAN };
      if (url === "/api/nearby") return { ok: true, json: async () => ({ places: [] }) };
      return { ok: false, status: 404, json: async () => ({ error: "not stubbed here" }) };
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});


const M_PER_DEG = 111_320;
async function startRealWalk() {
  walkOnUpdate = null;
  render(<WalkPlannerApp />);
  await flush();
  fireEvent.change(screen.getByPlaceholderText("Latitude"), { target: { value: String(ORIGIN.lat) } });
  fireEvent.change(screen.getByPlaceholderText("Longitude"), { target: { value: String(ORIGIN.lng) } });
  fireEvent.click(screen.getByRole("button", { name: "Build walking route" }));
  await flush();
  fireEvent.click(screen.getByRole("button", { name: "Start Walk" }));
  await flush();
  expect(walkOnUpdate).not.toBeNull();
}

/**
 * Streams `n` fixes 1 s apart walking north at 1.4 m/s; `fixOf(i)` sets accuracy, speed, along-track wobble, east
 * offset and an optional absolute position. Returns the speed cells.
 */
type FixSpec = { acc: number; speedMps?: number; wobble?: number; eastM?: number; at?: Coordinates };
async function stream(n: number, fixOf: (i: number) => FixSpec) {
  await startRealWalk();
  const t0 = Date.now();
  const cells: string[] = [];
  for (let i = 0; i < n; i++) {
    const f = fixOf(i);
    await act(async () => {
      walkOnUpdate!({
        coordinates: f.at ?? { lat: ORIGIN.lat + (1.4 * i + (f.wobble ?? 0)) / M_PER_DEG, lng: ORIGIN.lng + (f.eastM ?? 0) / (M_PER_DEG * 0.848) },
        accuracyMeters: f.acc,
        timestamp: t0 + i * 1000,
        source: "gps",
        speedMps: f.speedMps,
      });
    });
    await advance(1_000);
    cells.push(speedCell());
  }
  return cells;
}
function speedCell(): string {
  const el = screen.queryByTestId("walk-stats");
  const ps = el ? Array.from(el.querySelectorAll("p.text-\\[28px\\]")) : [];
  return ps[2]?.textContent ?? "?";
}
const PAUSED = /Paused|עצירה/;

describe("Doppler stuck at 0 while walking (Note 9 hypothesis)", () => {
  it("120 fixes walking with speed 0: a trail is drawn and the speed cell is not paused once the contradiction lands", async () => {
    const cells = await stream(120, (i) => ({ acc: 10, speedMps: 0, wobble: Math.sin(i) }));
    const last = mapCalls.at(-1);
    const trail = last.walkedGeometry as Coordinates[];
    let trailM = 0;
    for (let i = 1; i < trail.length; i++) trailM += Math.abs(trail[i].lat - trail[i - 1].lat) * M_PER_DEG;
    expect(trailM, "trail length").toBeGreaterThan(80);
    for (const [i, t] of cells.slice(45).entries()) expect(t, `cell at ${45 + i} s: ${t}`).not.toMatch(PAUSED);
    expect(cells.slice(45).some((t) => /^≈?\d/.test(t) && parseFloat(t.replace("≈", "")) >= 3)).toBe(true);
  }, 60_000);
});

describe("fixes worse than 50 m (Tab S6 network-only)", () => {
  const distanceToFinishKm = () => {
    const el = screen.getByTestId("walk-stats");
    return parseFloat(el.querySelectorAll("p.text-\\[28px\\]")[0]!.textContent!);
  };

  it("2 minutes of 60-90 m fixes walking: the walked distance grows by 100 m+, no off-route badge, no visit", async () => {
    // 10 s standing on 10 m fixes (no Doppler) start the stats; then 120 s walking on 60-90 m fixes, 40 m east of the line.
    const levels = [60, 70, 90, 80];
    await stream(130, (i) =>
      i < 10 ? { acc: 10, wobble: -1.4 * i } : { acc: levels[i % 4], wobble: -14 + Math.sin(i) * 3, eastM: 40 },
    );
    const before = 4.0;
    expect(before - distanceToFinishKm(), "walked km").toBeGreaterThanOrEqual(0.1);
    expect(screen.queryByText(/Off route|מחוץ למסלול/)).toBeNull();
    // Poor fixes right on the first stop never count as visiting it.
    for (let k = 0; k < 15; k++) {
      await act(async () => {
        walkOnUpdate!({ coordinates: STOPS[0].coordinates, accuracyMeters: 70, timestamp: Date.now(), source: "gps" });
      });
      await advance(1_000);
    }
    expect(mapCalls.at(-1).nextStopId).toBe("a1");
    expect(screen.queryByText(/Off route|מחוץ למסלול/)).toBeNull();
  }, 60_000);

  it("the low-accuracy chip shows on 60-90 m fixes and is gone after 30 s of 10 m fixes", async () => {
    const CHIP = "Low location accuracy, position is approximate";
    let shownDuringPoor = false;
    await stream(100, (i) => {
      if (i === 60) shownDuringPoor = screen.queryByText(CHIP) !== null;
      return i < 10 ? { acc: 10, wobble: -1.4 * i } : i < 60 ? { acc: [60, 70, 90, 80][i % 4], wobble: -14 } : { acc: 10, wobble: -14 };
    });
    expect(shownDuringPoor).toBe(true);
    expect(screen.queryByText(CHIP)).toBeNull();
  }, 60_000);
});
