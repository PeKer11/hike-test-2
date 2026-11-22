/**
 * P8 of docs/PACE-AND-MIDWALK-REROUTE-REVIEW-2026-11-22.md: after a reload in the middle of a walk the saved
 * start belongs to the first leg only. Every later change of route used to count the minutes already walked a
 * second time (its budget collapsed to the 15-minute floor), and the finish card reported the last leg alone.
 *
 * A real device is a `locate()` stream; here it is a stand-in the test feeds one fix at a time.
 */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Attraction, Coordinates, WalkPlan, WalkSegment } from "@/lib/types";
import type { ActiveWalkSnapshot } from "@/lib/walk/active-walk-store";
import type { LocateFix, LocateOptions } from "@/lib/geo/locate";
import { PlannerBridge } from "@/lib/shell/planner-bridge";
import { DEFAULT_WALK_SETTINGS } from "@/lib/types/walk-settings";

vi.mock("@/components/map", () => ({
  DynamicMap: () => <div data-testid="map" />,
}));

let stream: LocateOptions | null = null;
vi.mock("@/lib/geo/locate", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/geo/locate")>();
  return {
    ...actual,
    geolocationSupported: () => true,
    locate: (options: LocateOptions) => {
      stream = options;
      return { stop: () => void (stream = null) };
    },
  };
});

const { WalkPlannerApp } = await import("@/components/planner/WalkPlannerApp");

const ORIGIN: Coordinates = { lat: 32.08, lng: 34.78 };
const ROUTE: Coordinates[] = [ORIGIN, { lat: 32.116, lng: 34.78 }];
const M_PER_DEG_LAT = 111_195;

function stop(id: string, name: string, lat: number): Attraction {
  return { id, name, coordinates: { lat, lng: 34.78 }, category: "museum", avgVisitMinutes: 5, tags: {} };
}
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
  totalMinutes: 70,
  feasible: true,
  droppedAttractions: [],
  geometry: ROUTE,
};

type Body = Record<string, unknown>;
let walkPlanCalls: Body[];
let settingsStore: Record<string, string>;

async function flush() {
  await act(async () => {});
}
async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
  await flush();
}

/** One accepted fix `metersNorth` up the route, stamped with the current (fake) wall clock like a real device. */
async function fixAt(metersNorth: number) {
  await advance(1_100); // the component takes at most one fix a second into its state
  await act(async () => {
    const fix: LocateFix = {
      coordinates: { lat: ORIGIN.lat + metersNorth / M_PER_DEG_LAT, lng: ORIGIN.lng },
      accuracyMeters: 5,
      timestamp: Date.now(),
      source: "gps",
    };
    stream?.onUpdate(fix);
  });
  await flush();
}

async function addStopFromChat() {
  const ask = screen.queryByRole("button", { name: "Ask" });
  if (ask) fireEvent.click(ask); // the chat stays open after the first use
  const box = within(screen.getByTestId("walk-chat")).getByRole("textbox");
  fireEvent.change(box, { target: { value: "add a stop" } });
  fireEvent.submit(box.closest("form")!);
  await flush();
  fireEvent.click(screen.getAllByRole("button", { name: "Add a stop" }).at(-1)!);
  await flush();
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-22T10:00:00Z"));
  stream = null;
  walkPlanCalls = [];
  settingsStore = { "walk-settings": JSON.stringify({ ...DEFAULT_WALK_SETTINGS, deviationMode: "ask" }) };
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => settingsStore[key] ?? null,
      setItem: (key: string, value: string) => void (settingsStore[key] = value),
      removeItem: (key: string) => void delete settingsStore[key],
      clear: () => void (settingsStore = {}),
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (typeof url === "string" && url.startsWith("/api/walk-plan")) {
        walkPlanCalls.push(JSON.parse(String(init?.body)) as Body);
        return { ok: true, json: async () => PLAN };
      }
      if (url === "/api/nearby") return { ok: true, json: async () => ({ places: [] }) };
      return { ok: false, json: async () => ({ error: "not stubbed here" }) };
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("a walk resumed after a reload", () => {
  it("counts the minutes walked before the reload once: a second change still gets the time that is left", async () => {
    const bridge = new PlannerBridge();
    render(<WalkPlannerApp bridge={bridge} />);
    await flush();

    // The walk began 20 minutes ago, with an hour in hand. The saved snapshot is what a reload finds.
    const snapshot: ActiveWalkSnapshot = {
      plan: PLAN,
      geometry: ROUTE,
      input: { origin: ORIGIN, availableMinutes: 60, walkingPaceMinPerKm: 15, radiusMeters: 2000 },
      visitedIds: [],
      startedAt: Date.now() - 20 * 60_000,
      lastFix: ORIGIN,
      savedAt: Date.now(),
    };
    await act(async () => bridge.actions!.resumeWalk(snapshot));
    await flush();
    await fixAt(150);
    expect(stream).not.toBeNull();

    // First change: 20 of the 60 minutes are gone, so 40 are left.
    await addStopFromChat();
    expect(walkPlanCalls).toHaveLength(1);
    expect(walkPlanCalls[0].availableMinutes as number).toBeCloseTo(40, 0);

    // Second change, a minute into the new leg: about 39 left, not the 15-minute floor.
    await fixAt(160);
    await advance(30_000);
    await fixAt(200);
    await addStopFromChat();
    expect(walkPlanCalls).toHaveLength(2);
    expect(walkPlanCalls[1].availableMinutes as number).toBeGreaterThan(36);
    expect(walkPlanCalls[1].availableMinutes as number).toBeLessThan(41);
  });

  it("the finish card counts the minutes of both legs", async () => {
    const bridge = new PlannerBridge();
    render(<WalkPlannerApp bridge={bridge} />);
    await flush();
    const snapshot: ActiveWalkSnapshot = {
      plan: PLAN,
      geometry: ROUTE,
      input: { origin: ORIGIN, availableMinutes: 60, walkingPaceMinPerKm: 15, radiusMeters: 2000 },
      visitedIds: [],
      startedAt: Date.now() - 20 * 60_000,
      lastFix: ORIGIN,
      legsBefore: { minutes: 0, meters: 0 },
      savedAt: Date.now(),
    };
    await act(async () => bridge.actions!.resumeWalk(snapshot));
    await flush();
    await fixAt(150);
    await addStopFromChat();
    await fixAt(160);
    await advance(60_000);
    await fixAt(200);

    fireEvent.click(screen.getByRole("button", { name: "End walk" }));
    fireEvent.click(screen.getByRole("button", { name: "End walk?" }));
    await flush();
    const text = screen.getByText("You finished your walk!").closest("div")!.textContent ?? "";
    const minutes = Number(/(\d+) min/.exec(text)?.[1] ?? Number.NaN);
    // 20 minutes before the reload plus about a minute after the change.
    expect(minutes).toBeGreaterThanOrEqual(20);
    expect(minutes).toBeLessThanOrEqual(24);
  });
});
