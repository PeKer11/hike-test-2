/**
 * Lengthen / shorten sized at the walker's real pace, and the "plan at your real pace" card that can also
 * lengthen the walk and takes itself down (P1, P2 of docs/PACE-AND-MIDWALK-REROUTE-REVIEW-2026-11-22.md).
 * Same harness as `walk-pace-mismatch.test.tsx`: a real SimulatedWalkTracker feeds the real component.
 */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Attraction, Coordinates, WalkPlan, WalkSegment } from "@/lib/types";
import { DEFAULT_WALK_SETTINGS } from "@/lib/types/walk-settings";

/** A walk starts at peek (deck, numbers, credits); Ask and End walk wait in half. Tests that use them raise the sheet first. */
function raiseSheet() {
  if (screen.getByTestId("walk-hud").getAttribute("data-sheet") === "peek") fireEvent.click(screen.getByRole("button", { name: /^(Expand or collapse|הרחבה או כיווץ)$/ }));
}

vi.mock("@/components/map", () => ({
  DynamicMap: () => <div data-testid="map" />,
}));

const { WalkPlannerApp } = await import("@/components/planner/WalkPlannerApp");

const ORIGIN: Coordinates = { lat: 32.08, lng: 34.78 };
/** A 4 km route due north: long enough to walk for the whole test, short enough that the walk can have time to spare. */
const ROUTE: Coordinates[] = [ORIGIN, { lat: 32.116, lng: 34.78 }];

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

async function startSimulatedWalk(minutes?: string) {
  render(<WalkPlannerApp />);
  await flush();
  fireEvent.change(screen.getByPlaceholderText(/^(Latitude|קו רוחב)$/), { target: { value: String(ORIGIN.lat) } });
  fireEvent.change(screen.getByPlaceholderText(/^(Longitude|קו אורך)$/), { target: { value: String(ORIGIN.lng) } });
  if (minutes) fireEvent.change(document.querySelector('input[type="number"][min="15"]') as HTMLInputElement, { target: { value: minutes } });
  fireEvent.click(screen.getByRole("button", { name: /^(Build walking route|בנה מסלול הליכה)$/ }));
  await flush();
  fireEvent.click(screen.getByLabelText(/Simulate this walk|הדמיית הליכה/));
  fireEvent.click(screen.getByRole("button", { name: /^(Start Walk|התחל הליכה)$/ }));
  await flush();
  raiseSheet();
}

/** Tell the walk chat "I walk 1.5 km/h" and accept its offer: the plan's pace becomes 40 min/km. */
async function planAtOnePointFiveKmh() {
  const hud = within(screen.getByTestId("walk-hud"));
  fireEvent.click(hud.getByRole("button", { name: "Ask" }));
  fireEvent.change(hud.getByRole("textbox"), { target: { value: "I walk 1.5 km/h" } });
  fireEvent.click(hud.getByRole("button", { name: "Send" }));
  await flush();
  fireEvent.click(screen.getByRole("button", { name: "Plan at 1.5 km/h" }));
  await flush();
}

beforeEach(() => {
  vi.useFakeTimers();
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

describe("the 'plan at your real pace' card", () => {
  it("also offers to lengthen the walk when there is time to spare at that pace, and does it at that pace", async () => {
    await startSimulatedWalk("120");
    await advance(3_000);
    await planAtOnePointFiveKmh();
    await advance(40_000);
    expect(screen.getByText(/You're walking about 4 km\/h/)).toBeTruthy();
    // 2 h set, a few minutes gone, 4 km left at 4 km/h and 10 minutes of visits: plenty to spare.
    expect(screen.getByText(/to spare at that pace/)).toBeTruthy();

    const callsBefore = walkPlanCalls.length;
    fireEvent.click(screen.getByRole("button", { name: "Plan at 4 km/h and lengthen the walk" }));
    await flush();

    expect(walkPlanCalls.length).toBe(callsBefore + 1);
    const rebuild = walkPlanCalls[walkPlanCalls.length - 1];
    expect(rebuild.fillRemainingTime).toBe(true);
    // Sized at the pace the card promised (4 km/h = 15 min/km), not at the 1.5 km/h the plan assumed.
    expect(rebuild.walkingPaceMinPerKm).toBeCloseTo(15, 5);
    expect(screen.queryByText(/You're walking about/)).toBeNull();
  });

  it("without time to spare it only offers the plain 'plan at' answer (no lengthen button)", async () => {
    await startSimulatedWalk("20");
    await advance(3_000);
    await planAtOnePointFiveKmh();
    await advance(40_000);
    expect(screen.getByText(/You're walking about 4 km\/h/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /and lengthen the walk/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Plan at 4 km/h" })).toBeTruthy();
  });

  it("takes itself down after a minute and may ask again later, instead of standing for the whole walk", async () => {
    await startSimulatedWalk("120");
    await advance(3_000);
    await planAtOnePointFiveKmh();
    await advance(40_000);
    expect(screen.getByText(/You're walking about 4 km\/h/)).toBeTruthy();

    await advance(61_000);
    expect(screen.queryByText(/You're walking about/)).toBeNull();
  });
});

describe("lengthen and shorten are sized at the walker's real pace", () => {
  it("a fast walker's 'add a stop' with nothing to add never fills the time with a rebuild", async () => {
    await startSimulatedWalk("120");
    await advance(3_000);
    fireEvent.click(screen.getByRole("button", { name: "Fast pace" })); // the simulated walker goes at 0.6x the plan's pace
    await flush();
    await advance(60_000);

    const ask = screen.queryByRole("button", { name: "Ask" });
    if (ask) fireEvent.click(ask); // the chat stays open after the first use
    const box = within(screen.getByTestId("walk-chat")).getByRole("textbox");
    fireEvent.change(box, { target: { value: "add a stop" } });
    fireEvent.submit(box.closest("form")!);
    await flush();
    const callsBefore = walkPlanCalls.length;
    fireEvent.click(screen.getAllByRole("button", { name: "Add a stop" }).at(-1)!);
    await flush();

    // Nothing was found ahead: the walker is told so, and no rebuild fills the time.
    expect(walkPlanCalls.length).toBe(callsBefore);
    expect(screen.getByTestId("walk-notice").textContent).toContain("No place fits");
  });
});
