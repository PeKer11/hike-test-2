/**
 * The walked trail handed to the map keeps its identity between renders that add no fix, so the map updates its
 * polylines in place instead of rebuilding them (docs/PHONE-FEEDBACK-BEAM-TRAIL-CRASH-PLAN-2026-11-24.md, T4).
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

const mapCalls: { walkedGeometry?: unknown[] }[] = [];
vi.mock("@/components/map", () => ({
  DynamicMap: (props: { walkedGeometry?: unknown[] }) => {
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
  const store: Record<string, string> = { "walk-settings": JSON.stringify({ ...DEFAULT_WALK_SETTINGS }) };
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


const EAST_M = (m: number) => m / (111_320 * Math.cos((32.08 * Math.PI) / 180));
const fixAt = (northM: number, eastM: number, t: number): Fix => ({
  coordinates: { lat: ORIGIN.lat + northM / 111_320, lng: ORIGIN.lng + EAST_M(eastM) },
  accuracyMeters: 10,
  timestamp: t,
  source: "gps",
});

describe("off-route card and the jittery fix", () => {
  it("after 'I know where I'm going', 25/55 m jitter does not bring the card back", async () => {
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
    const t0 = Date.now();
    let i = 0;
    const fix = async (eastM: number) => {
      await act(async () => walkOnUpdate!(fixAt(300 + i, eastM, t0 + i * 1000)));
      await advance(1_000);
      i += 1;
    };
    for (let k = 0; k < 6; k++) await fix(55);
    expect(screen.queryByTestId("off-route-card")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /I know where I'm going/ }));
    expect(screen.queryByTestId("off-route-card")).toBeNull();
    for (let k = 0; k < 120; k++) {
      await fix(k % 2 ? 55 : 25);
      expect(screen.queryByTestId("off-route-card"), `second ${k}`).toBeNull();
    }
  });
});
