/**
 * The speed cell through the real WalkPlannerApp (locate() mocked), 1 Hz fixes with Doppler.
 * From the harness of docs/SPEED-LAG-PLAN-2026-11-24.md.
 */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Attraction, Coordinates, WalkPlan, WalkSegment } from "@/lib/types";
import { DEFAULT_WALK_SETTINGS } from "@/lib/types/walk-settings";

// A fake GPS for the stationary-jitter test; every other locate() caller gets an inert one.
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

// Stand 25 s, walk 40 s at 1.4 m/s, stand 30 s, walk 30 s.
const SEGS = [{ until: 25, v: 0 }, { until: 65, v: 1.4 }, { until: 95, v: 0 }, { until: 125, v: 1.4 }];

async function streamSpeed(acc: number) {
  await startRealWalk();
  const t0 = Date.now();
  const cells: string[] = [];
  let along = 0;
  let wob = 0;
  for (let i = 0; i < 125; i++) {
    const v = SEGS.find((s) => i < s.until)!.v;
    along += v;
    wob = 0.95 * wob + (i % 3 === 0 ? 1 : -1) * 0.6;
    await act(async () => {
      walkOnUpdate!({
        coordinates: { lat: ORIGIN.lat + (along + wob) / M_PER_DEG, lng: ORIGIN.lng },
        accuracyMeters: acc,
        timestamp: t0 + i * 1000,
        source: "gps",
        speedMps: v,
      });
    });
    await advance(1_000);
    const el = screen.queryByTestId("walk-stats");
    const ps = el ? Array.from(el.querySelectorAll("p.text-\\[28px\\]")) : [];
    cells.push(ps[2]?.textContent ?? "?");
  }
  return cells;
}

const isNumber = (t: string) => /^\d/.test(t);
const kmh = (t: string) => parseFloat(t);

describe("the speed cell follows the device speed within seconds", () => {
  for (const acc of [10, 20, 30]) {
    it(`start, stop and stand at ${acc} m accuracy`, async () => {
      const c = await streamSpeed(acc);
      // within 3 s of each start: a real number
      for (const start of [25, 95]) {
        const hit = c.slice(start, start + 4).some((t) => isNumber(t) && kmh(t) >= 4.0);
        expect(hit, `start @${start}: ${c.slice(start, start + 6).join(" ")}`).toBe(true);
      }
      // within 3 s of each stop: paused
      for (const stopAt of [65]) {
        const hit = c.slice(stopAt, stopAt + 4).some((t) => t.includes("Paused"));
        expect(hit, `stop @${stopAt}: ${c.slice(stopAt, stopAt + 6).join(" ")}`).toBe(true);
      }
      // standing: never "0.0"
      for (const t of [...c.slice(0, 25), ...c.slice(65, 95)]) expect(t).not.toMatch(/^0\.0/);
      // walking (after the first seconds): never paused
      for (const t of [...c.slice(29, 65), ...c.slice(99, 125)]) expect(t).not.toContain("Paused");
    }, 60_000);
  }
});
