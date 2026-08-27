/**
 * `WalkPlannerApp` as the walker drives it.
 *
 * Everything else in `tests/` covers one module's own logic. This file covers
 * the thing that has none of its own and decides everything anyway: which
 * rebuild path clears which state, what is wired up at which walk phase, and
 * whether a pin set on one surface is the same pin the next request carries.
 * Those are one-line decisions inside a 500-line component, they have been
 * checked by clicking around a browser and by nothing else, and they are
 * exactly the kind of line that gets edited by someone working next door.
 *
 * Nothing under test is stood in for. The real component mounts with its real
 * hooks, the real `WalkCompanionPanel` form, the real `AttractionDistancesPanel`,
 * the real `VisitTracker` and the real request builders. `fetch` is the only
 * fake, at the network boundary, the same way `tests/heading-continued-rebuild.ts`
 * fakes it — plus the map, for the reason given on the mock itself.
 */

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Attraction, Coordinates, WalkPlan, WalkSegment } from "@/lib/types";

/**
 * Leaflet is the one thing here that cannot run: `MapView` needs a live map
 * with a viewport, which jsdom has no answer for — the same wall
 * `tests/map-markers.test.tsx` hits, and its stand-in is the precedent for
 * this one. What the planner actually decides about the map is which props it
 * hands it, so the stand-in renders exactly those: whether a tap is wired at
 * all, which stops are drawn pinned, and a button per marker that fires the
 * tap. `MapMarkers`' own rendering of all that is that file's subject, not
 * this one's.
 */
vi.mock("@/components/map", () => ({
  DynamicMap: ({
    waypoints,
    pinnedIds = [],
    onTogglePin,
    routeGeometry,
    followPosition,
  }: {
    waypoints: { id: string; name: string }[];
    pinnedIds?: string[];
    onTogglePin?: (id: string) => void;
    routeGeometry: Coordinates[];
    followPosition?: boolean;
  }) => (
    <div
      data-testid="map"
      data-pin-tap={onTogglePin ? "wired" : "unwired"}
      data-pinned={pinnedIds.join(",")}
      data-route-points={String(routeGeometry.length)}
      data-following={followPosition ? "yes" : "no"}
    >
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

const { WalkPlannerApp } = await import(
  "@/components/planner/WalkPlannerApp"
);

const ORIGIN: Coordinates = { lat: 32.08, lng: 34.78 };

// Long enough that the simulator never walks off the end of it inside a test,
// and straight, so a stray is always measured against the one segment.
const ROUTE: Coordinates[] = [ORIGIN, { lat: 32.35, lng: 34.78 }];

function attraction(id: string, name: string): Attraction {
  return {
    id,
    name,
    coordinates: { lat: 32.081, lng: 34.781 },
    category: "museum",
    avgVisitMinutes: 20,
    tags: {},
  };
}

const MUSEUM = attraction("a1", "City Museum");
const CATHEDRAL = attraction("a2", "Old Cathedral");
const MARKET = attraction("a3", "Covered Market");

function segmentTo(to: Attraction): WalkSegment {
  return {
    from: { name: "origin", coordinates: ORIGIN },
    to,
    distanceMeters: 600,
    walkingMinutes: 9,
  };
}

function planOf(
  attractions: Attraction[],
  overrides: Partial<WalkPlan> = {},
): WalkPlan {
  return {
    orderedAttractions: attractions,
    segments: attractions.map(segmentTo),
    totalDistanceMeters: 600 * attractions.length,
    totalMinutes: 29 * attractions.length,
    feasible: true,
    droppedAttractions: [],
    geometry: ROUTE,
    ...overrides,
  };
}

type WalkPlanBody = Record<string, unknown>;
type StubResponse = { ok: boolean; json: () => Promise<unknown> };

/** Every body POSTed to `/api/walk-plan`, in order. */
let walkPlanCalls: WalkPlanBody[];
/** Queued answers to those posts; the last one repeats once the queue empties. */
let walkPlanQueue: ((signal?: AbortSignal | null) => Promise<StubResponse>)[];

function respondWith(plan: WalkPlan) {
  return async () => ({ ok: true, json: async () => plan });
}

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
        const responder = walkPlanQueue.shift() ?? respondWith(planOf([MUSEUM]));
        return responder(init?.signal);
      }

      // Everything else the mounted tree reaches for on its own — prompt
      // history, standing facts, the trail briefing. None of it is this file's
      // subject, and each already handles a failed call by leaving its panel
      // alone, so refusing is both the smallest answer and the one that makes
      // an accidental new dependency visible rather than silently satisfied.
      return { ok: false, json: async () => ({ error: "not stubbed here" }) };
    }),
  );
}

function renderPlanner() {
  return render(<WalkPlannerApp />);
}

function fillOrigin(origin: Coordinates = ORIGIN) {
  fireEvent.change(screen.getByPlaceholderText("Latitude"), {
    target: { value: String(origin.lat) },
  });
  fireEvent.change(screen.getByPlaceholderText("Longitude"), {
    target: { value: String(origin.lng) },
  });
}

function clickBuild() {
  fireEvent.click(screen.getByRole("button", { name: "Build My Walk" }));
}

/** Fill the form, build, and wait for the plan to land on screen. */
async function buildWalk(plan: WalkPlan = planOf([MUSEUM, CATHEDRAL])) {
  walkPlanQueue.push(respondWith(plan));
  fillOrigin();
  clickBuild();
  await screen.findByRole("button", { name: "Start Walk" });
}

function mapEl() {
  return screen.getByTestId("map");
}

function pinnedOnMap(): string[] {
  const value = mapEl().getAttribute("data-pinned") ?? "";
  return value === "" ? [] : value.split(",");
}

function tapMapMarker(label: string) {
  fireEvent.click(screen.getByLabelText(`Map marker ${label}`));
}

// `useWalkSettings` reads and writes localStorage directly, and the test
// environment's own implementation is not dependable here — same fresh
// in-memory store per test as `tests/walk-settings.test.tsx` installs.
let settingsStore: Record<string, string> = {};

beforeEach(() => {
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

describe("building a walk", () => {
  it("asks the API for the walk the walker described in the form", async () => {
    renderPlanner();
    await buildWalk();

    expect(walkPlanCalls).toHaveLength(1);
    expect(walkPlanCalls[0]).toMatchObject({
      lat: ORIGIN.lat,
      lng: ORIGIN.lng,
      availableMinutes: 90,
      walkingPaceMinPerKm: 15,
      radiusMeters: 2000,
      pinnedAttractionIds: [],
      fillRemainingTime: false,
    });
  });

  it("moves the walk from idle to planned, and draws the route it got back", async () => {
    renderPlanner();

    // Idle: nothing to start, and no route on the map.
    expect(screen.queryByRole("button", { name: "Start Walk" })).toBeNull();
    expect(mapEl().getAttribute("data-route-points")).toBe("0");

    await buildWalk();

    expect(mapEl().getAttribute("data-route-points")).toBe(String(ROUTE.length));
    // Both surfaces the plan reaches: the results list, and the map's markers,
    // which `showPlan` numbers as it hands them over.
    expect(screen.getByText(/City Museum/)).toBeTruthy();
    expect(screen.getByLabelText("Map marker 1. City Museum")).toBeTruthy();
  });

  it("tells the walker the network failed, rather than showing them no plan and no reason", async () => {
    renderPlanner();
    walkPlanQueue.push(async () => {
      throw new Error("connection reset");
    });
    fillOrigin();
    clickBuild();

    expect(
      await screen.findByText("Network error. Please try again."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start Walk" })).toBeNull();
  });

  it("reports a rejected plan as the server's own reason", async () => {
    renderPlanner();
    walkPlanQueue.push(async () => ({
      ok: false,
      json: async () => ({ error: "Nothing walkable within that radius." }),
    }));
    fillOrigin();
    clickBuild();

    expect(
      await screen.findByText("Nothing walkable within that radius."),
    ).toBeTruthy();
  });

  it("offers more time when the plan came back short of the stops it found", async () => {
    renderPlanner();
    await buildWalk(
      planOf([MUSEUM], { droppedAttractions: [CATHEDRAL, MARKET] }),
    );

    walkPlanQueue.push(respondWith(planOf([MUSEUM, CATHEDRAL, MARKET])));
    fireEvent.click(screen.getByRole("button", { name: "+ 15 min and retry" }));

    await waitFor(() => expect(walkPlanCalls).toHaveLength(2));
    expect(walkPlanCalls[1].availableMinutes).toBe(105);
  });
});

describe("a build that takes too long", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("says the build is still running once it passes the slow mark, and not before", async () => {
    renderPlanner();
    walkPlanQueue.push(
      () => new Promise<StubResponse>(() => {}), // never settles
    );
    fillOrigin();
    clickBuild();
    await act(async () => {});

    expect(screen.queryByRole("status")).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(20_000);
    });

    expect(screen.getByRole("status").textContent).toContain("Still building");
  });

  it("tells the walker to ask for less when its own deadline fires, not to try again", async () => {
    renderPlanner();
    walkPlanQueue.push(
      (signal) =>
        new Promise<StubResponse>((_resolve, reject) => {
          signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    fillOrigin();
    clickBuild();
    await act(async () => {});

    await act(async () => {
      vi.advanceTimersByTime(120_000);
    });

    expect(
      screen.getByText(
        "That took longer than we could wait. Try a smaller search radius or fewer stops.",
      ),
    ).toBeTruthy();
    // The two failures are different advice, and the walker only gets the
    // useful one if they are told apart.
    expect(screen.queryByText("Network error. Please try again.")).toBeNull();
  });
});

describe("what each walk phase wires up", () => {
  it("does not offer a pin tap on the map before a plan exists", () => {
    renderPlanner();

    expect(mapEl().getAttribute("data-pin-tap")).toBe("unwired");
  });

  it("offers the map's pin tap as soon as there is a plan, before the walk starts", async () => {
    renderPlanner();
    await buildWalk();

    // Still on the "planned" screen — Start Walk has not been pressed.
    expect(screen.getByRole("button", { name: "Start Walk" })).toBeTruthy();
    expect(mapEl().getAttribute("data-pin-tap")).toBe("wired");
  });

  it("keeps the stops list and its pin buttons off the planned screen", async () => {
    renderPlanner();
    await buildWalk();

    expect(screen.queryByLabelText("Pin City Museum")).toBeNull();
  });

  it("follows the walker on the map only once they are walking", async () => {
    renderPlanner();
    await buildWalk();

    expect(mapEl().getAttribute("data-following")).toBe("no");

    await startWalk();

    expect(mapEl().getAttribute("data-following")).toBe("yes");
  });

  it("hides the simulate toggle while walking, and offers the stray control instead", async () => {
    renderPlanner();
    await buildWalk();

    expect(screen.getByLabelText(/Simulate this walk/)).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /Stray 80 m off route/ }),
    ).toBeNull();

    await startWalk();

    expect(screen.queryByLabelText(/Simulate this walk/)).toBeNull();
    expect(
      screen.getByRole("button", { name: /Stray 80 m off route/ }),
    ).toBeTruthy();
  });

  it("refuses to start live tracking on a plan ORS could not draw a line for", async () => {
    renderPlanner();
    await buildWalk(
      planOf([MUSEUM], { geometry: [], warnings: ["no geometry available"] }),
    );

    // The plan is real, so the walker is offered Start Walk — and told why the
    // line is missing before they press it.
    expect(
      screen.getByText(
        (_content, element) =>
          element?.tagName === "P" &&
          (element.textContent ?? "").includes(
            "draw the walking route for this plan",
          ),
      ),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Start Walk" }));

    expect(
      screen.getByText("Build a walk plan before starting live tracking."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "End Walk" })).toBeNull();
  });

  it("puts the walk back in the idle phase when the walker ends it", async () => {
    renderPlanner();
    await buildWalk();
    await startWalk();

    fireEvent.click(screen.getByRole("button", { name: "End Walk" }));

    expect(screen.queryByRole("button", { name: "End Walk" })).toBeNull();
    expect(mapEl().getAttribute("data-following")).toBe("no");
  });
});

/**
 * Start the walk on the simulated tracker rather than the real one. Not a
 * convenience: `WalkTracker.start()` throws without `navigator.geolocation`,
 * and the simulator is the app's own answer to that — the same checkbox a
 * developer ticks to watch this flow in a browser.
 */
async function startWalk() {
  fireEvent.click(screen.getByLabelText(/Simulate this walk/));
  fireEvent.click(screen.getByRole("button", { name: "Start Walk" }));
  await screen.findByRole("button", { name: "End Walk" });
}

describe("pinning a stop", () => {
  it("pins from the map, and unpins on a second tap", async () => {
    renderPlanner();
    await buildWalk();

    tapMapMarker("1. City Museum");
    expect(pinnedOnMap()).toEqual(["a1"]);

    tapMapMarker("1. City Museum");
    expect(pinnedOnMap()).toEqual([]);
  });

  it("shows the list and the map the same pin, whichever one set it", async () => {
    renderPlanner();
    await buildWalk();
    await startWalk();
    await tickTracker();

    tapMapMarker("1. City Museum");

    expect(screen.getByLabelText("Unpin City Museum")).toBeTruthy();
    expect(screen.getByLabelText("Pin Old Cathedral")).toBeTruthy();
  });

  // The other half of this — that a pin survives a rebuild the walker did not
  // ask for — is in `tests/walk-planner-silence.test.tsx`, because the only
  // way into an automatic rebuild is a real mid-walk trigger.
  it("clears the pins when the walker builds the walk again themselves", async () => {
    renderPlanner();
    await buildWalk();

    tapMapMarker("1. City Museum");
    expect(pinnedOnMap()).toEqual(["a1"]);

    walkPlanQueue.push(respondWith(planOf([MUSEUM, CATHEDRAL])));
    clickBuild();
    await waitFor(() => expect(walkPlanCalls).toHaveLength(2));

    expect(pinnedOnMap()).toEqual([]);
  });

  /**
   * What the map's own gate comment claims is that a pin set on the planned
   * screen "survives the walker's own retry the same way it survives a mid-walk
   * rebuild". It does not: a build the walker asks for takes the `!autoResume`
   * branch, which clears the pins before the body is built, and no user-facing
   * build path passes `pinnedIds`. Asserted as it actually behaves, and flagged
   * rather than quietly changed — which of the two is wrong is a product call.
   */
  it("does not send a pin set before the walk with the walker's own next build", async () => {
    renderPlanner();
    await buildWalk();

    tapMapMarker("1. City Museum");

    walkPlanQueue.push(respondWith(planOf([MUSEUM, CATHEDRAL])));
    clickBuild();
    await waitFor(() => expect(walkPlanCalls).toHaveLength(2));

    expect(walkPlanCalls[1].pinnedAttractionIds).toEqual([]);
  });

  it("drops the pin when the walker marks that stop done", async () => {
    renderPlanner();
    await buildWalk();
    await startWalk();
    await tickTracker();

    fireEvent.click(screen.getByLabelText("Pin City Museum"));
    expect(pinnedOnMap()).toEqual(["a1"]);

    // A pinned stop costs a second click to skip — that confirmation is
    // `AttractionDistancesPanel`'s, and the pin clearing is this file's.
    fireEvent.click(screen.getByLabelText("Skip City Museum"));
    fireEvent.click(screen.getByLabelText("Confirm skipping pinned City Museum"));

    expect(pinnedOnMap()).toEqual([]);
  });
});

/**
 * Let the simulated tracker emit a few fixes, so the stops list has distances
 * to render — it draws nothing for a stop it has no distance for.
 */
async function tickTracker(ms = 3_000) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}
