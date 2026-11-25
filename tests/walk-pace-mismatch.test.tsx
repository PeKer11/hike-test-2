/**
 * "Planned at 2 km/h, walked at 4.5": the planner asks whether to plan at the real pace.
 * Same harness as `walk-hud.test.tsx` (a real SimulatedWalkTracker feeding the real component,
 * `fetch` the only fake). The simulated walker keeps its 15 min/km (4 km/h); the plan is told it
 * is walking 1.5 km/h through the walk chat's "N km/h" command, which is how a plan ends up
 * far slower than the walker.
 */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Attraction, Coordinates, WalkPlan, WalkSegment } from "@/lib/types";

/** A walk starts at peek (deck, numbers, credits); Ask and End walk wait in half. Tests that use them raise the sheet first. */
function raiseSheet() {
  if (screen.getByTestId("walk-hud").getAttribute("data-sheet") === "peek") fireEvent.click(screen.getByRole("button", { name: /^(Expand or collapse|הרחבה או כיווץ)$/ }));
}

vi.mock("@/components/map", () => ({
  DynamicMap: () => <div data-testid="map" />,
}));

const { WalkPlannerApp } = await import("@/components/planner/WalkPlannerApp");

const ORIGIN: Coordinates = { lat: 32.08, lng: 34.78 };
// Due north and long: the walk must outlast the minutes the test lets pass.
const ROUTE: Coordinates[] = [ORIGIN, { lat: 32.35, lng: 34.78 }];

function stop(id: string, name: string, lat: number): Attraction {
  return { id, name, coordinates: { lat, lng: 34.78 }, category: "museum", avgVisitMinutes: 20, tags: {} };
}
const STOPS = [stop("a1", "City Museum", 32.09), stop("a2", "Old Cathedral", 32.11), stop("a3", "Covered Market", 32.13)];
const segmentTo = (to: Attraction): WalkSegment => ({
  from: { name: "origin", coordinates: ORIGIN },
  to,
  distanceMeters: 900,
  walkingMinutes: 13,
});
const PLAN: WalkPlan = {
  orderedAttractions: STOPS,
  segments: STOPS.map(segmentTo),
  totalDistanceMeters: 2700,
  totalMinutes: 99,
  feasible: true,
  droppedAttractions: [],
  geometry: ROUTE,
};

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

async function startSimulatedWalk() {
  render(<WalkPlannerApp />);
  await flush();
  fireEvent.change(screen.getByPlaceholderText(/^(Latitude|קו רוחב)$/), { target: { value: String(ORIGIN.lat) } });
  fireEvent.change(screen.getByPlaceholderText(/^(Longitude|קו אורך)$/), { target: { value: String(ORIGIN.lng) } });
  fireEvent.click(screen.getByRole("button", { name: /^(Build walking route|בנה מסלול הליכה)$/ }));
  await flush();
  fireEvent.click(screen.getByLabelText(/Simulate this walk/));
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
  settingsStore = { "walk-settings": JSON.stringify({ deviationMode: "ask" }) };
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
    vi.fn(async (url: string) =>
      typeof url === "string" && url.startsWith("/api/walk-plan")
        ? { ok: true, json: async () => PLAN }
        : { ok: false, json: async () => ({ error: "not stubbed here" }) },
    ),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("a walker much faster than the plan's pace", () => {
  it("is asked once whether to plan at the real pace, and Plan at it takes the card down and does not ask again", async () => {
    await startSimulatedWalk();
    await advance(3_000);
    await planAtOnePointFiveKmh();
    expect(screen.queryByText(/You're walking about/)).toBeNull();

    // 3 simulated minutes of 4 km/h against a 1.5 km/h plan: about 18 s of wall time at 10x, plus the 5 s tick.
    await advance(40_000);
    expect(screen.getByText(/You're walking about 4 km\/h/)).toBeTruthy();
    expect(screen.getByText("Your plan assumes 1.5 km/h.")).toBeTruthy();
    expect(screen.getAllByRole("alert")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Plan at 4 km/h" }));
    await flush();
    expect(screen.queryByText(/You're walking about/)).toBeNull();
    expect(screen.getByText("Planning at 4 km/h from here")).toBeTruthy();
    // Planned pace is now the walker's: no second question however long they keep walking.
    await advance(120_000);
    expect(screen.queryByText(/You're walking about/)).toBeNull();
  });

  it("Keep leaves the plan's pace alone and is not asked again", async () => {
    await startSimulatedWalk();
    await advance(3_000);
    await planAtOnePointFiveKmh();
    await advance(40_000);
    fireEvent.click(screen.getByRole("button", { name: "Keep 1.5 km/h" }));
    await flush();
    expect(screen.queryByText(/You're walking about/)).toBeNull();
    await advance(120_000);
    expect(screen.queryByText(/You're walking about/)).toBeNull();
  });

  it("is not asked at all while the walker is on the plan's pace", async () => {
    await startSimulatedWalk();
    await advance(180_000);
    expect(screen.queryByText(/You're walking about/)).toBeNull();
  });
});
