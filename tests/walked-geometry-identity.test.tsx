/**
 * The walked trail handed to the map keeps its identity between renders that add no fix, so the map updates its
 * polylines in place instead of rebuilding them (docs/PHONE-FEEDBACK-BEAM-TRAIL-CRASH-PLAN-2026-11-24.md, T4).
 */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Attraction, Coordinates, WalkPlan, WalkSegment } from "@/lib/types";
import { DEFAULT_WALK_SETTINGS } from "@/lib/types/walk-settings";

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

describe("walkedGeometry handed to the map", () => {
  it("keeps its identity between renders that add no fix", async () => {
    const { rerender } = render(<WalkPlannerApp />);
    await flush();
    fireEvent.change(screen.getByPlaceholderText("Latitude"), { target: { value: String(ORIGIN.lat) } });
    fireEvent.change(screen.getByPlaceholderText("Longitude"), { target: { value: String(ORIGIN.lng) } });
    fireEvent.click(screen.getByRole("button", { name: "Build walking route" }));
    await flush();
    fireEvent.click(screen.getByLabelText(/Simulate this walk/));
    fireEvent.click(screen.getByRole("button", { name: "Start Walk" }));
    await flush();
    for (let i = 0; i < 20; i++) await advance(1_000);
    const last = () => mapCalls.filter((c) => Array.isArray(c.walkedGeometry)).at(-1)!.walkedGeometry!;
    const before = last();
    expect(before.length).toBeGreaterThan(2); // the trail did grow
    const calls = mapCalls.length;
    for (let i = 0; i < 5; i++) rerender(<WalkPlannerApp />); // renders that add no fix
    expect(mapCalls.length).toBeGreaterThan(calls); // the planner really did render again
    expect(last()).toBe(before);
    await advance(2_000); // a new fix
    expect(last()).not.toBe(before);
    expect(last().length).toBeGreaterThan(before.length);
  });
});
