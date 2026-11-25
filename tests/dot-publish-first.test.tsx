/**
 * The dot is published before the engine runs: a throw in the engine cannot freeze it.
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
const { SpeedEstimator } = await import("@/lib/walk/speed-estimator");

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
function rng(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

describe("dot publishes first", () => {
  it("keeps moving when the speed estimator throws on every fix", async () => {
    const spy = vi.spyOn(SpeedEstimator.prototype, "record").mockImplementation(() => {
      throw new Error("x");
    });
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await startRealWalk();
    const t0 = Date.now();
    let moves = 0;
    let prev: Coordinates | undefined;
    for (let i = 0; i < 10; i++) {
      await act(async () => {
        walkOnUpdate!({ coordinates: { lat: ORIGIN.lat + (1.4 * i) / M_PER_DEG, lng: ORIGIN.lng }, accuracyMeters: 12, speedMps: 1.4, timestamp: t0 + i * 1000, source: "gps" });
      });
      await advance(1_000);
      const dot = mapCalls.at(-1)?.currentPosition as Coordinates | undefined;
      if (prev && dot && dot.lat !== prev.lat) moves++;
      prev = dot ?? prev;
    }
    spy.mockRestore();
    errSpy.mockRestore();
    expect(moves).toBeGreaterThanOrEqual(8);
  });
});

describe("the dot holds while standing", () => {
  it("120 stationary fixes with jitter move the shown dot at most 3 times after warm-up", async () => {
    await startRealWalk();
    const t0 = Date.now();
    const r = rng(7);
    const seen = new Set<Coordinates>();
    for (let i = 0; i < 120; i++) {
      await act(async () => {
        walkOnUpdate!({
          coordinates: { lat: ORIGIN.lat + ((r() - 0.5) * 12) / M_PER_DEG, lng: ORIGIN.lng + ((r() - 0.5) * 12) / M_PER_DEG },
          accuracyMeters: 8,
          speedMps: 0.05,
          timestamp: t0 + i * 1000,
          source: "gps",
        });
      });
      await advance(1_000);
      const dot = mapCalls.at(-1)?.currentPosition as Coordinates | undefined;
      if (i >= 10 && dot) seen.add(dot);
    }
    expect(seen.size).toBeLessThanOrEqual(3);
  });
  it("the route line keeps the same geometry while the dot holds", async () => {
    await startRealWalk();
    const t0 = Date.now();
    const r = rng(9);
    const seen = new Set<unknown>();
    for (let i = 0; i < 60; i++) {
      await act(async () => {
        walkOnUpdate!({
          coordinates: { lat: ORIGIN.lat + ((r() - 0.5) * 12) / M_PER_DEG, lng: ORIGIN.lng + ((r() - 0.5) * 12) / M_PER_DEG },
          accuracyMeters: 8,
          speedMps: 0.05,
          timestamp: t0 + i * 1000,
          source: "gps",
        });
      });
      await advance(1_000);
      if (i >= 10) seen.add(mapCalls.at(-1)?.routeGeometry);
    }
    expect(seen.size).toBeLessThanOrEqual(1);
  });
});
