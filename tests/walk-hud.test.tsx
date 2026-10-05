/**
 * The live-walk HUD and the local way-back, driven the same way as
 * `walk-planner-silence.test.tsx`: a real `SimulatedWalkTracker` feeding the real
 * component, `fetch` the only fake.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Attraction, Coordinates, WalkPlan, WalkSegment } from "@/lib/types";
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

/**
 * The side street the stray goes down: due east, and long for the same reason
 * the route is. A walker holding one direction for the whole heading window is
 * the case the silence path exists for, so the detour must not run out and
 * quietly put them back on the planned line mid-test.
 */
const SIDE_STREET: Coordinates[] = [ORIGIN, { lat: 32.08, lng: 34.99 }];

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
const MARKET = attraction("a3", "Covered Market", 32.13);

function segmentTo(to: Attraction): WalkSegment {
  return {
    from: { name: "origin", coordinates: ORIGIN },
    to,
    distanceMeters: 900,
    walkingMinutes: 13,
  };
}

function planOf(
  attractions: Attraction[],
  overrides: Partial<WalkPlan> = {},
): WalkPlan {
  return {
    orderedAttractions: attractions,
    segments: attractions.map(segmentTo),
    totalDistanceMeters: 900 * attractions.length,
    totalMinutes: 33 * attractions.length,
    feasible: true,
    droppedAttractions: [],
    geometry: ROUTE,
    ...overrides,
  };
}

/* --- polyline encoding, so the detour comes back the shape ORS sends it --- */

function encodeSignedValue(value: number): string {
  let remaining = value < 0 ? ~(value << 1) : value << 1;
  let encoded = "";
  while (remaining >= 0x20) {
    encoded += String.fromCharCode((0x20 | (remaining & 0x1f)) + 63);
    remaining >>= 5;
  }
  return encoded + String.fromCharCode(remaining + 63);
}

function encodePolyline(coords: Coordinates[]): string {
  let lastLat = 0;
  let lastLng = 0;
  let encoded = "";
  for (const coord of coords) {
    const lat = Math.round(coord.lat * 1e5);
    const lng = Math.round(coord.lng * 1e5);
    encoded +=
      encodeSignedValue(lat - lastLat) + encodeSignedValue(lng - lastLng);
    lastLat = lat;
    lastLng = lng;
  }
  return encoded;
}

type WalkPlanBody = Record<string, unknown>;

let walkPlanCalls: WalkPlanBody[];
let rerouteCalls: Array<{ from: Coordinates; candidates: Coordinates[] }>;
let rerouteMode: "ok" | "fail";
let settingsStore: Record<string, string>;
// When set, the next `/api/walk-plan` call stays pending until settled.
let holdPlan: boolean;
let heldPlan: { resolve: () => void; reject: () => void } | null;

function installFetch() {
  walkPlanCalls = [];
  rerouteCalls = [];
  rerouteMode = "ok";
  holdPlan = false;
  heldPlan = null;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (typeof url === "string" && url.startsWith("/api/walk-plan")) {
        walkPlanCalls.push(JSON.parse(String(init?.body)) as WalkPlanBody);
        if (holdPlan) {
          await new Promise<void>((resolve, reject) => {
            heldPlan = { resolve, reject: () => reject(new Error("network")) };
          });
        }
        return { ok: true, json: async () => planOf([MUSEUM, CATHEDRAL, MARKET]) };
      }
      if (url === "/api/directions") {
        return {
          ok: true,
          json: async () => ({ routes: [{ geometry: encodePolyline(SIDE_STREET) }] }),
        };
      }
      if (url === "/api/reroute") {
        const body = JSON.parse(String(init?.body)) as {
          from: Coordinates;
          candidates: Coordinates[];
        };
        rerouteCalls.push(body);
        if (rerouteMode === "fail") {
          return { ok: false, status: 422, json: async () => ({ error: "none" }) };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            geometry: [body.from, body.candidates[0]],
            distanceMeters: 100,
            candidateIndex: 0,
          }),
        };
      }
      return { ok: false, json: async () => ({ error: "not stubbed here" }) };
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

async function startSimulatedWalk() {
  render(<WalkPlannerApp />);
  await flush();
  fireEvent.change(screen.getByPlaceholderText("Latitude"), {
    target: { value: String(ORIGIN.lat) },
  });
  fireEvent.change(screen.getByPlaceholderText("Longitude"), {
    target: { value: String(ORIGIN.lng) },
  });
  fireEvent.click(screen.getByRole("button", { name: "Build My Walk" }));
  await flush();
  fireEvent.click(screen.getByLabelText(/Simulate this walk/));
  fireEvent.click(screen.getByRole("button", { name: "Start Walk" }));
  await flush();
}

async function stray() {
  await advance(2_000);
  fireEvent.click(screen.getByRole("button", { name: /Stray 80 m off route/ }));
  await flush();
  await advance(8_000);
}

beforeEach(() => {
  vi.useFakeTimers();
  settingsStore = {};
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

describe("the live-walk HUD", () => {
  it("shows the stats bar and the End walk pill while walking, and speed matches the plan", async () => {
    await startSimulatedWalk();
    await advance(12_000);

    expect(screen.getByTestId("walk-hud")).toBeTruthy();
    expect(screen.getByRole("button", { name: "End walk" })).toBeTruthy();
    const stats = screen.getByTestId("walk-stats").textContent ?? "";
    expect(stats).toContain("Walking pace");
    expect(stats).toContain("Time to finish");
    expect(stats).toContain("Distance to finish");

    const planned = 60 / Number(walkPlanCalls[0].walkingPaceMinPerKm);
    const shown = Number(/(\d+\.\d)\s*km\/h/.exec(stats)?.[1]);
    expect(Math.abs(shown - planned)).toBeLessThanOrEqual(0.3);
  });

  it("gives the whole frame to the map: the form is hidden until Details, and not unmounted", async () => {
    await startSimulatedWalk();
    const aside = document.querySelector("aside") as HTMLElement;
    expect(aside.className).toContain("hidden");
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(aside.className).not.toMatch(/(^| )hidden( |$)/);
    expect(aside.className).toContain("z-[700]");
  });

  it("asks the frame to expand when the walk starts", async () => {
    const onRequestExpand = vi.fn();
    render(<WalkPlannerApp onRequestExpand={onRequestExpand} />);
    await flush();
    fireEvent.change(screen.getByPlaceholderText("Latitude"), { target: { value: String(ORIGIN.lat) } });
    fireEvent.change(screen.getByPlaceholderText("Longitude"), { target: { value: String(ORIGIN.lng) } });
    fireEvent.click(screen.getByRole("button", { name: "Build My Walk" }));
    await flush();
    fireEvent.click(screen.getByLabelText(/Simulate this walk/));
    fireEvent.click(screen.getByRole("button", { name: "Start Walk" }));
    await flush();
    expect(onRequestExpand).toHaveBeenCalledWith(true);
  });

  it("offers a shorter route once the walker is clearly slower, without rebuilding by itself", async () => {
    await startSimulatedWalk();
    await advance(3_000);
    fireEvent.click(screen.getByRole("button", { name: "Slow pace" }));
    await flush();
    // ~5 simulated minutes of slow walking is ~30 s of wall time at 10x.
    await advance(45_000);

    expect(screen.getByText("You're going slower than planned")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Show shorter route" })).toBeTruthy();
    // An offer, not an action.
    expect(walkPlanCalls).toHaveLength(1);
    expect(screen.getAllByRole("alert")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Show shorter route" }));
    await flush();
    expect(walkPlanCalls).toHaveLength(2);
  });
});

describe("ending the walk during a mid-walk rebuild", () => {
  async function startRebuild() {
    await startSimulatedWalk();
    await advance(3_000);
    fireEvent.click(screen.getByRole("button", { name: "Slow pace" }));
    await flush();
    await advance(45_000);
    holdPlan = true;
    fireEvent.click(screen.getByRole("button", { name: "Show shorter route" }));
    await flush();
    expect(walkPlanCalls).toHaveLength(2);
    expect(heldPlan).not.toBeNull();
    // The HUD (and its End walk) stays up while the rebuild is in flight.
    expect(screen.getByTestId("walk-hud")).toBeTruthy();
  }

  function expectWalkEnded() {
    expect(screen.queryByTestId("walk-hud")).toBeNull();
    expect(screen.getByRole("button", { name: "Build My Walk" })).toBeTruthy();
  }

  it("does not restart the walk when the held rebuild later succeeds", async () => {
    await startRebuild();
    fireEvent.click(screen.getByRole("button", { name: "End walk" }));
    await flush();
    expectWalkEnded();
    holdPlan = false;
    await act(async () => heldPlan!.resolve());
    await advance(5_000);
    expectWalkEnded();
    expect(walkPlanCalls).toHaveLength(2);
  });

  it("does not restart the walk when the held rebuild later fails", async () => {
    await startRebuild();
    fireEvent.click(screen.getByRole("button", { name: "End walk" }));
    await flush();
    expectWalkEnded();
    await act(async () => heldPlan!.reject());
    await advance(5_000);
    expectWalkEnded();
  });
});

describe("the local way back", () => {
  it("in auto mode splices a street route in and never re-plans", async () => {
    settingsStore["walk-settings"] = JSON.stringify({
      ...DEFAULT_WALK_SETTINGS,
      deviationMode: "auto",
    });
    await startSimulatedWalk();
    await stray();

    expect(rerouteCalls.length).toBeGreaterThanOrEqual(1);
    expect(rerouteCalls[0].candidates.length).toBeGreaterThanOrEqual(1);
    expect(rerouteCalls[0].candidates.length).toBeLessThanOrEqual(2);
    // Same plan, same stops, same tracker: no second build, still walking.
    expect(walkPlanCalls).toHaveLength(1);
    expect(screen.getByRole("button", { name: "End walk" })).toBeTruthy();
  });

  it("falls back to the full re-plan when no way back can be routed", async () => {
    settingsStore["walk-settings"] = JSON.stringify({
      ...DEFAULT_WALK_SETTINGS,
      deviationMode: "auto",
    });
    rerouteMode = "fail";
    await startSimulatedWalk();
    await stray();
    await flush();

    expect(rerouteCalls.length).toBeGreaterThanOrEqual(1);
    expect(walkPlanCalls).toHaveLength(2);
  });

  it("in ask mode offers Show way back, which routes locally instead of re-planning", async () => {
    await startSimulatedWalk();
    await stray();

    expect(screen.getByText(/You've gone off the planned route/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show way back" }));
    await flush();
    expect(rerouteCalls).toHaveLength(1);
    expect(walkPlanCalls).toHaveLength(1);
  });
});
