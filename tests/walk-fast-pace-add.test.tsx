/**
 * Regression: "you're ahead of time, add a stop? yes" must add that exact place.
 * Same harness as `walk-hud.test.tsx`: a real simulated walk, `fetch` the only fake.
 * `/api/nearby` returns one café just off the route ahead; `/api/walk-plan` echoes
 * the stops it is asked to keep, so the assertions read what the planner was told.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Attraction, Coordinates, WalkPlan } from "@/lib/types";
import { DEFAULT_WALK_SETTINGS } from "@/lib/types/walk-settings";

// Same stand-in, and the same reason, as `tests/walk-planner-app.test.tsx`.
vi.mock("@/components/map", () => ({
  DynamicMap: ({
    waypoints,
    pinnedIds = [],
    onTogglePin,
  }: {
    waypoints: { id: string; name: string }[];
    pinnedIds?: string[];
    onTogglePin?: (id: string) => void;
  }) => (
    <div data-testid="map" data-pinned={pinnedIds.join(",")}>
      {waypoints.map((waypoint) => (
        <button
          key={waypoint.id}
          type="button"
          aria-label={`Map marker ${waypoint.name}`}
          onClick={() => onTogglePin?.(waypoint.id)}
        />
      ))}
    </div>
  ),
}));

const { WalkPlannerApp } = await import("@/components/planner/WalkPlannerApp");

const ORIGIN: Coordinates = { lat: 32.08, lng: 34.78 };

/**
 * A straight line due north, and a long one. Straight because a route that
 * doubles back can measure a stray against the wrong segment — the same reason
 * the sibling suite uses one. Long because the walk has to survive the ninety
 * seconds the off-route question stands, and at 10× playback that is around
 * ten kilometres of walking; a route the simulator finishes stops the tracker
 * and takes the situation under test off the table.
 */
const ROUTE: Coordinates[] = [ORIGIN, { lat: 32.35, lng: 34.78 }];

function attraction(id: string, name: string, lat: number): Attraction {
  return {
    id,
    name,
    coordinates: { lat, lng: 34.78 },
    category: "museum",
    avgVisitMinutes: 20,
    tags: {},
  };
}

const MUSEUM = attraction("a1", "City Museum", 32.09);
const CATHEDRAL = attraction("a2", "Old Cathedral", 32.11);

const CAFE: Attraction = {
  id: "osm-node-777",
  name: "Café Ahead",
  coordinates: { lat: 32.09, lng: 34.7806 }, // ~60 m east of the route, ahead of the start
  category: "food",
  avgVisitMinutes: 20,
  tags: { name: "Café Ahead" },
};

function planOf(attractions: Attraction[]): WalkPlan {
  return {
    orderedAttractions: attractions,
    segments: attractions.map((to) => ({ from: { name: "origin", coordinates: ORIGIN }, to, distanceMeters: 900, walkingMinutes: 13 })),
    totalDistanceMeters: 900 * attractions.length,
    totalMinutes: 33 * attractions.length,
    feasible: true,
    droppedAttractions: [],
    geometry: ROUTE,
  };
}

type Body = Record<string, unknown>;
let walkPlanCalls: Body[];
let assistantCalls: number;
let failRebuild: boolean;
let settingsStore: Record<string, string>;

function installFetch() {
  walkPlanCalls = [];
  assistantCalls = 0;
  failRebuild = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith("/api/walk-plan")) {
        const body = JSON.parse(String(init?.body)) as Body;
        walkPlanCalls.push(body);
        if (failRebuild && body.explicitAttractions) return { ok: false, json: async () => ({ error: "boom" }) };
        const kept = (body.explicitAttractions as Attraction[] | undefined) ?? [MUSEUM, CATHEDRAL];
        return { ok: true, json: async () => planOf(kept) };
      }
      if (url === "/api/nearby") {
        return {
          ok: true,
          json: async () => ({
            places: [{ ...CAFE, source: "osm", verification: "registered", kind: "poi" }],
          }),
        };
      }
      if (url === "/api/walk-assistant") assistantCalls += 1;
      return { ok: false, status: 404, json: async () => ({ error: "not stubbed here" }) };
    }),
  );
}

async function flush() {
  await act(async () => {});
}

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
  await flush();
}

async function startFastWalk(untilQuestion = true) {
  render(<WalkPlannerApp />);
  await flush();
  fireEvent.change(screen.getByPlaceholderText("Latitude"), { target: { value: String(ORIGIN.lat) } });
  fireEvent.change(screen.getByPlaceholderText("Longitude"), { target: { value: String(ORIGIN.lng) } });
  fireEvent.click(screen.getByRole("button", { name: "Build My Walk" }));
  await flush();
  fireEvent.click(screen.getByLabelText(/Simulate this walk/));
  fireEvent.click(screen.getByRole("button", { name: "Start Walk" }));
  await flush();
  await advance(3_000);
  fireEvent.click(screen.getByRole("button", { name: "Fast pace" }));
  await flush();
  await advance(45_000);
  // The pace card appears first; the companion's question about a named place a moment later.
  if (untilQuestion) await advance(20_000);
}

function expectCafeAdded() {
  const last = walkPlanCalls.at(-1)!;
  expect((last.explicitAttractions as Attraction[]).map((a) => a.id)).toContain(CAFE.id);
  expect(last.pinnedAttractionIds as string[]).toContain(CAFE.id);
  expect(last.fillRemainingTime).toBe(false);
  expect(screen.getByTestId("walk-notice").textContent).toContain("Added: Café Ahead");
  // The sheet offers Undo for the change.
  expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
}

beforeEach(() => {
  vi.useFakeTimers();
  settingsStore = { "walk-settings": JSON.stringify({ ...DEFAULT_WALK_SETTINGS, deviationMode: "ask" }) };
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => settingsStore[key] ?? null,
      setItem: (key: string, value: string) => {
        settingsStore[key] = value;
      },
      removeItem: (key: string) => {
        delete settingsStore[key];
      },
      clear: () => {
        settingsStore = {};
      },
    },
  });
  installFetch();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("ahead of pace: yes adds the named place", () => {
  it("the companion's Add it adds Café Ahead, pinned, and the sheet says so", async () => {
    await startFastWalk();
    expect(screen.getByText(/You're ahead of time\. Add Café Ahead/)).toBeTruthy();
    const callsBefore = walkPlanCalls.length;
    fireEvent.click(screen.getByRole("button", { name: "Add it" }));
    await flush();
    expect(walkPlanCalls.length).toBe(callsBefore + 1);
    expectCafeAdded();
  });

  it("Extend the hike (propose mode) adds the place directly, without asking the assistant", async () => {
    await startFastWalk(false);
    fireEvent.click(screen.getByRole("button", { name: "Extend the hike" }));
    await flush();
    expectCafeAdded();
    expect(assistantCalls).toBe(0);
  });

  it("says so on the sheet when the rebuild fails, and keeps the walk", async () => {
    await startFastWalk();
    failRebuild = true;
    fireEvent.click(screen.getByRole("button", { name: "Add it" }));
    await flush();
    expect(screen.getByTestId("walk-notice").textContent).toContain("Couldn't update your route");
    expect(screen.getByTestId("walk-hud")).toBeTruthy();
  });
});
