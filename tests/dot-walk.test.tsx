/**
 * A real WalkPlannerApp walk (locate() mocked), streamed 1 Hz fixes along the route at 1.4 m/s.
 * From the diagnosis harness of docs/DOT-NOT-MOVING-PLAN-2026-11-24.md.
 */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Attraction, Coordinates, WalkPlan, WalkSegment } from "@/lib/types";
import { DEFAULT_WALK_SETTINGS } from "@/lib/types/walk-settings";

// A fake GPS for the stationary-jitter test; every other locate() caller gets an inert one.
type Fix = { coordinates: Coordinates; accuracyMeters: number; timestamp: number; source: "gps" };
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
function rng(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

/** Streams `n` fixes; returns how often the dot moved, and the last map props. */
async function walk(accOf: (i: number, r: () => number) => number, n: number) {
  await startRealWalk();
  const r = rng(7);
  const t0 = Date.now();
  let dotMoves = 0;
  let prevDot: Coordinates | null = null;
  for (let i = 0; i < n; i++) {
    const acc = accOf(i, r);
    const noise = (r() - 0.5) * Math.min(acc, 20);
    await act(async () => {
      walkOnUpdate!({
        coordinates: { lat: ORIGIN.lat + (1.4 * i + noise) / M_PER_DEG, lng: ORIGIN.lng + ((r() - 0.5) * Math.min(acc, 20)) / (M_PER_DEG * 0.848) },
        accuracyMeters: acc,
        timestamp: t0 + i * 1000,
        source: "gps",
      });
    });
    await advance(1_000);
    const dot = mapCalls.at(-1)?.currentPosition as Coordinates | undefined;
    if (prevDot && dot && (dot.lat !== prevDot.lat || dot.lng !== prevDot.lng)) dotMoves++;
    prevDot = dot ?? prevDot;
  }
  return { dotMoves, last: mapCalls.at(-1) };
}

describe("a walk streamed through the real planner", () => {
  for (const [label, accOf] of [
    ["mixed 10-40 m", (_i: number, r: () => number) => 10 + r() * 30],
    ["steady 12 m", () => 12],
    ["steady 30 m", () => 30],
    ["steady 60 m", () => 60],
  ] as const) {
    it(`the dot moves on every tick (${label})`, async () => {
      const { dotMoves } = await walk(accOf, 60);
      expect(dotMoves).toBeGreaterThanOrEqual(58);
    });
  }

  it("a 30 m phone still draws a trail that ends at the dot", async () => {
    const { last } = await walk(() => 30, 60);
    const trail = last.walkedGeometry as Coordinates[];
    expect(trail.length).toBeGreaterThan(2);
    expect(trail[trail.length - 1]).toEqual(last.currentPosition);
  });

  it("a fix that arrives 150 ms early (850 ms after the last one) still moves the dot", async () => {
    await startRealWalk();
    const t0 = Date.now();
    const shown = new Set<string>();
    const key = (c: Coordinates) => `${c.lat.toFixed(7)},${c.lng.toFixed(7)}`;
    const sent: string[] = [];
    for (let i = 0; i < 60; i++) {
      const coordinates = { lat: ORIGIN.lat + (1.4 * i) / M_PER_DEG, lng: ORIGIN.lng };
      sent.push(key(coordinates));
      await act(async () => {
        walkOnUpdate!({ coordinates, accuracyMeters: 10, timestamp: t0 + i * 1000, source: "gps" });
      });
      const dot = mapCalls.at(-1)?.currentPosition as Coordinates | undefined;
      if (dot) shown.add(key(dot));
      // every 10th fix comes 150 ms early: 850 ms after the previous one
      await advance((i + 1) % 10 === 0 ? 850 : 1_000);
    }
    const missed = sent.filter((k) => !shown.has(k));
    expect(missed.length, `dot never showed ${missed.length} of ${sent.length} fixes`).toBe(0);
  });
});
