/**
 * The one thing in `WalkPlannerApp` that cannot be reached by clicking a
 * button: a rebuild the walker did not ask for.
 *
 * Every automatic path — the pace trigger, the off-route trigger, the silence
 * that follows an unanswered off-route question — runs out of a callback armed
 * when the walk started, reads its inputs through refs, and passes
 * `autoResume`, which is the flag that decides whether the pins, the dropped
 * stops and the visit history survive the rebuild. None of that can be staged
 * by rendering a panel with props; it needs a walk actually under way.
 *
 * So there is one under way. A real `SimulatedWalkTracker` walks a real route
 * and a real ORS-shaped detour, feeding the component's own `onPositionUpdate`;
 * that drives the real `detectDeviation`, the real `DeviationMonitor` and the
 * real `HeadingMonitor`, and whatever they decide reaches the real request
 * builders. `fetch` is the only fake, exactly as in
 * `tests/heading-continued-rebuild.test.ts`, which covers the same stream from
 * the other side: that file asks what the monitors conclude, this one asks what
 * the component does about it.
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
let walkPlanQueue: WalkPlan[];
let settingsStore: Record<string, string>;

function installFetch() {
  walkPlanCalls = [];
  walkPlanQueue = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (typeof url === "string" && url.startsWith("/api/walk-plan")) {
        walkPlanCalls.push(
          init?.body ? (JSON.parse(String(init.body)) as WalkPlanBody) : {},
        );
        const plan = walkPlanQueue.shift() ?? planOf([MUSEUM, CATHEDRAL, MARKET]);
        return { ok: true, json: async () => plan };
      }

      if (url === "/api/directions") {
        return {
          ok: true,
          json: async () => ({
            routes: [{ geometry: encodePolyline(SIDE_STREET) }],
          }),
        };
      }

      return { ok: false, json: async () => ({ error: "not stubbed here" }) };
    }),
  );
}

/** Let every pending promise settle without moving the clock. */
async function flush() {
  await act(async () => {});
}

/** Move the clock, and let whatever that started settle. */
async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
  await flush();
}

function seedSettings(overrides: Partial<typeof DEFAULT_WALK_SETTINGS>) {
  settingsStore["walk-settings"] = JSON.stringify({
    ...DEFAULT_WALK_SETTINGS,
    ...overrides,
  });
}

function pinnedOnMap(): string[] {
  const value = screen.getByTestId("map").getAttribute("data-pinned") ?? "";
  return value === "" ? [] : value.split(",");
}

/** Fill the form, build, and start the walk on the simulated tracker. */
async function startSimulatedWalk(plan = planOf([MUSEUM, CATHEDRAL, MARKET])) {
  render(<WalkPlannerApp />);
  await flush();

  walkPlanQueue.push(plan);
  fireEvent.change(screen.getByPlaceholderText("Latitude"), {
    target: { value: String(ORIGIN.lat) },
  });
  fireEvent.change(screen.getByPlaceholderText("Longitude"), {
    target: { value: String(ORIGIN.lng) },
  });
  fireEvent.click(screen.getByRole("button", { name: "Build My Walk" }));
  await flush();

  // `WalkTracker.start()` throws without `navigator.geolocation`; the simulator
  // is the app's own answer to that, and the same one a developer ticks to
  // watch this flow in a browser.
  fireEvent.click(screen.getByLabelText(/Simulate this walk/));
  fireEvent.click(screen.getByRole("button", { name: "Start Walk" }));
  await flush();
}

const OFF_ROUTE_QUESTION = /You've gone off the planned route/;

/**
 * Walk a while, turn down the side street, and stay on it long enough for the
 * deviation monitor to raise the question.
 *
 * The sustain window is 30 s of *simulated* time and needs at least three
 * samples; at 10× playback with a 500 ms tick that is three real seconds' worth
 * of ticks, halved again by the once-per-second state throttle the monitor sits
 * behind. Eight real seconds is comfortably past both.
 */
async function strayUntilAsked() {
  await advance(2_000);
  fireEvent.click(
    screen.getByRole("button", { name: /Stray 80 m off route/ }),
  );
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

describe("going off route mid-walk", () => {
  it("raises the question instead of redrawing, for a walker on ask", async () => {
    await startSimulatedWalk();
    await strayUntilAsked();

    expect(screen.getByText(OFF_ROUTE_QUESTION)).toBeTruthy();
    // Asked, not acted on: still only the build the walker themselves asked for.
    expect(walkPlanCalls).toHaveLength(1);
  });

  it("redraws from where the walker actually is when they say yes", async () => {
    await startSimulatedWalk();
    await strayUntilAsked();

    fireEvent.click(screen.getByRole("button", { name: "Redraw from here" }));
    await flush();

    expect(walkPlanCalls).toHaveLength(2);
    // Down the side street, not back at the origin they started from.
    expect(Number(walkPlanCalls[1].lng)).toBeGreaterThan(ORIGIN.lng);
    // A redraw keeps the walk they chose; it does not go looking for more.
    expect(walkPlanCalls[1].fillRemainingTime).toBe(false);
  });

  it("keeps a pin the walker set through a rebuild they did not ask for", async () => {
    await startSimulatedWalk();

    fireEvent.click(screen.getByLabelText("Map marker 2. Old Cathedral"));
    expect(pinnedOnMap()).toEqual(["a2"]);

    await strayUntilAsked();
    fireEvent.click(screen.getByRole("button", { name: "Redraw from here" }));
    await flush();

    // Both halves of the `!options?.autoResume` gate: the pin survived the
    // rebuild in the component, and it reached the request that ran it.
    expect(walkPlanCalls[1].pinnedAttractionIds).toEqual(["a2"]);
    expect(pinnedOnMap()).toEqual(["a2"]);
  });

  it("never plans a stop the walker already finished back into the walk", async () => {
    await startSimulatedWalk();
    await advance(3_000);

    fireEvent.click(screen.getByLabelText("Skip City Museum"));
    await flush();

    await strayUntilAsked();
    fireEvent.click(screen.getByRole("button", { name: "Redraw from here" }));
    await flush();

    const kept = (walkPlanCalls[1].explicitAttractions ?? []) as Attraction[];
    expect(kept.map((a) => a.id)).not.toContain("a1");
    expect(kept.map((a) => a.id)).toContain("a2");
  });
});

describe("what a rebuild cost the walker", () => {
  /** Stray, say yes, and get back a plan that has lost the cathedral. */
  async function rebuildDroppingTheCathedral() {
    await startSimulatedWalk();
    await strayUntilAsked();

    walkPlanQueue.push(planOf([MUSEUM, MARKET]));
    fireEvent.click(screen.getByRole("button", { name: "Redraw from here" }));
    await flush();
  }

  it("names the stop the rebuild dropped", async () => {
    await rebuildDroppingTheCathedral();

    expect(screen.getByText("Old Cathedral")).toBeTruthy();
  });

  it("puts that panel above the build form, where a narrow screen shows it", async () => {
    await rebuildDroppingTheCathedral();

    const dropped = screen.getByText("Old Cathedral");
    const buildForm = screen.getByText("City Walk Companion");

    // Node.DOCUMENT_POSITION_FOLLOWING — the form comes after the panel.
    expect(dropped.compareDocumentPosition(buildForm) & 4).toBeTruthy();
  });

  it("takes the panel down with the walk it belonged to", async () => {
    await rebuildDroppingTheCathedral();

    fireEvent.click(screen.getByRole("button", { name: "End Walk" }));
    await flush();

    expect(screen.queryByLabelText("Put Old Cathedral back in the walk")).toBeNull();
  });

  /**
   * The offer is gated on walking, not on there being something to offer, and
   * the two come apart for a walker who turned auto-resume off: the rebuild
   * lands them on the planned screen with stops genuinely missing. Recall is
   * itself a mid-walk rebuild — `midWalkRebuildState` answers nothing without a
   * live tracker — so offering it here would be a button that does nothing.
   */
  it("does not offer a dropped stop back on a screen where recall could not run", async () => {
    seedSettings({ autoResumeAfterRebuild: false });
    await startSimulatedWalk();
    await strayUntilAsked();

    walkPlanQueue.push(planOf([MUSEUM, MARKET]));
    fireEvent.click(screen.getByRole("button", { name: "Redraw from here" }));
    await flush();

    // The rebuild happened and handed the walker the new route to start.
    expect(walkPlanCalls).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Start Walk" })).toBeTruthy();
    expect(screen.queryByLabelText("Put Old Cathedral back in the walk")).toBeNull();
  });

  it("puts a recalled stop back as a pin, in the same request that asks for it", async () => {
    await rebuildDroppingTheCathedral();

    fireEvent.click(
      screen.getByLabelText("Put Old Cathedral back in the walk"),
    );
    await flush();

    expect(walkPlanCalls).toHaveLength(3);
    const kept = (walkPlanCalls[2].explicitAttractions ?? []) as Attraction[];
    // The pin and the ask travel together — a recall that asked for the stop
    // without pinning it would be dropped again by the planner it just failed.
    expect(kept.map((a) => a.id)).toContain("a2");
    expect(walkPlanCalls[2].pinnedAttractionIds).toContain("a2");
    // And it is a real pin, not one that lived for the length of one request:
    // the map draws it, and the rebuild below reads it back.
    expect(pinnedOnMap()).toContain("a2");
  });

  /**
   * A pin is the one thing the planner refuses to drop, so recalling a stop can
   * hand back a plan that no longer fits — which is said out loud rather than
   * hidden. The "+ 15 min" answer to it is also the one path that reads the pin
   * back out of the ref that `recallDroppedStop` wrote it to, which is why the
   * two are tested together.
   */
  it("warns when the recalled stop no longer fits, and buys time without losing the pin", async () => {
    await rebuildDroppingTheCathedral();

    walkPlanQueue.push(
      planOf([MUSEUM, CATHEDRAL, MARKET], { feasible: false }),
    );
    fireEvent.click(
      screen.getByLabelText("Put Old Cathedral back in the walk"),
    );
    await flush();

    expect(screen.getByText(/won't reach every pinned stop/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "+ 15 min" }));
    await flush();

    expect(walkPlanCalls).toHaveLength(4);
    expect(walkPlanCalls[3].pinnedAttractionIds).toContain("a2");
  });
});

describe("silence after the off-route question", () => {
  it("leaves the route alone when silence has not been opted into", async () => {
    await startSimulatedWalk();
    await strayUntilAsked();

    await advance(90_000);

    expect(screen.queryByText(OFF_ROUTE_QUESTION)).toBeNull();
    // The question lapsed and nothing happened, which is the default meaning
    // of silence for every walker who has not said otherwise.
    expect(walkPlanCalls).toHaveLength(1);
  });

  it("rebuilds around the direction the walker held, once they have opted in", async () => {
    seedSettings({ continueHeadingOnSilence: true });
    await startSimulatedWalk();
    await strayUntilAsked();

    await advance(90_000);

    expect(walkPlanCalls).toHaveLength(2);
    // Built from where they got to, going their way, and allowed to find
    // replacements for the stops the cone cut.
    expect(Number(walkPlanCalls[1].lng)).toBeGreaterThan(ORIGIN.lng);
    expect(walkPlanCalls[1].fillRemainingTime).toBe(true);
  });

  it("leaves the route alone when the walker rejoined before the question lapsed", async () => {
    seedSettings({ continueHeadingOnSilence: true });
    await startSimulatedWalk();
    await strayUntilAsked();

    fireEvent.click(screen.getByRole("button", { name: "Rejoin the route" }));
    await advance(90_000);

    // The banner outlives the excursion that raised it. Rebuilding a walker
    // who is back on their route ninety seconds later is the failure this
    // guard exists for.
    expect(walkPlanCalls).toHaveLength(1);
  });
});
