/**
 * The live-walk HUD and the local way-back, driven the same way as
 * `walk-planner-silence.test.tsx`: a real `SimulatedWalkTracker` feeding the real
 * component, `fetch` the only fake.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WalkHud } from "@/components/walk/WalkHud";
import type { Attraction, Coordinates, WalkPlan, WalkSegment } from "@/lib/types";
import { DEFAULT_WALK_SETTINGS } from "@/lib/types/walk-settings";
import { SimulatedWalkTracker } from "@/lib/walk/simulated-walk-tracker";

// Same stand-in, and the same reason, as `tests/walk-planner-app.test.tsx`.
vi.mock("@/components/map", () => ({
  DynamicMap: ({
    waypoints,
    pinnedIds = [],
    onTogglePin,
    routeGeometry,
    headingStore,
  }: {
    waypoints: { id: string; name: string }[];
    pinnedIds?: string[];
    onTogglePin?: (id: string) => void;
    routeGeometry?: { lat: number; lng: number }[];
    headingStore?: { get(): number | null; subscribe(fn: () => void): () => void };
  }) => (
    <div
      data-testid="map"
      ref={(el) => {
        // The live heading arrives through a store (the beam turns without React): mirror it into an attribute.
        if (!el || !headingStore) return;
        const show = () => el.setAttribute("data-heading", String(headingStore.get() ?? ""));
        show();
        (el as HTMLElement & { _off?: () => void })._off?.();
        (el as HTMLElement & { _off?: () => void })._off = headingStore.subscribe(show);
      }}
      data-pinned={pinnedIds.join(",")}
      data-route-first={routeGeometry?.[0] ? `${routeGeometry[0].lat.toFixed(5)},${routeGeometry[0].lng.toFixed(5)}` : ""}
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
// What /api/reroute answers in "fail" mode (422 none plausible, 429 rate limit, 502 ORS down).
let rerouteFailStatus: number;
// The connector starts this many metres south of the walker, as when ORS snaps them to a street away from their feet.
let rerouteStartGapM: number;
// When set, /api/reroute stays pending until `releaseReroute()`.
let holdReroute: boolean;
let releaseReroute: (() => void) | null;
let settingsStore: Record<string, string>;
// When set, the next `/api/walk-plan` call stays pending until settled.
let holdPlan: boolean;
// A short route for the end-of-walk tests (the default one is 30 km).
let shortRoute = false;
let heldPlan: { resolve: () => void; reject: () => void } | null;

function installFetch() {
  walkPlanCalls = [];
  rerouteCalls = [];
  rerouteMode = "ok";
  rerouteFailStatus = 422;
  rerouteStartGapM = 0;
  holdReroute = false;
  releaseReroute = null;
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
        return {
          ok: true,
          json: async () =>
            shortRoute
              ? planOf([MUSEUM], { geometry: [ORIGIN, { lat: 32.095, lng: 34.78 }] })
              : planOf([MUSEUM, CATHEDRAL, MARKET]),
        };
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
        if (holdReroute) {
          await new Promise<void>((resolve) => {
            releaseReroute = resolve;
          });
        }
        if (rerouteMode === "fail") {
          return { ok: false, status: rerouteFailStatus, json: async () => ({ error: "none" }) };
        }
        const start = { lat: body.from.lat - rerouteStartGapM / 111_195, lng: body.from.lng };
        return {
          ok: true,
          status: 200,
          json: async () => ({
            geometry: [start, body.candidates[0]],
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
  fireEvent.change(screen.getByPlaceholderText(/^(Latitude|קו רוחב)$/), {
    target: { value: String(ORIGIN.lat) },
  });
  fireEvent.change(screen.getByPlaceholderText(/^(Longitude|קו אורך)$/), {
    target: { value: String(ORIGIN.lng) },
  });
  fireEvent.click(screen.getByRole("button", { name: /^(Build walking route|בנה מסלול הליכה)$/ }));
  await flush();
  fireEvent.click(screen.getByLabelText(/Simulate this walk/));
  fireEvent.click(screen.getByRole("button", { name: /^(Start Walk|התחל הליכה)$/ }));
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
  // These suites exercise the ask-mode flow; the app default is now auto.
  settingsStore = { "walk-settings": JSON.stringify({ deviationMode: "ask", routeOrderMode: "reorder" }) };
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
  shortRoute = false;
  installFetch();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
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

  it("is one opaque full-width sheet that owns the safe-area padding", async () => {
    await startSimulatedWalk();
    const cls = screen.getByTestId("walk-hud").className;
    expect(cls).toContain("bg-paper");
    expect(cls).toContain("inset-x-0");
    expect(cls).toContain("env(safe-area-inset-bottom)");
    expect(cls).not.toContain("#0b1a2b");
  });

  it("gives the whole frame to the map: the form is hidden until Details, and not unmounted", async () => {
    await startSimulatedWalk();
    const aside = document.querySelector("aside") as HTMLElement;
    expect(aside.className).toContain("hidden");
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    fireEvent.click(screen.getByRole("button", { name: "Details" })); // peek, half, details
    expect(aside.className).not.toMatch(/(^| )hidden( |$)/);
    expect(aside.className).toContain("z-[700]");
  });

  it("asks the frame to expand when the walk starts", async () => {
    const onRequestExpand = vi.fn();
    render(<WalkPlannerApp onRequestExpand={onRequestExpand} />);
    await flush();
    fireEvent.change(screen.getByPlaceholderText("Latitude"), { target: { value: String(ORIGIN.lat) } });
    fireEvent.change(screen.getByPlaceholderText("Longitude"), { target: { value: String(ORIGIN.lng) } });
    fireEvent.click(screen.getByRole("button", { name: "Build walking route" }));
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

describe("the openrouteservice credit sits off the map (feedback 2026-11-22, item 4)", () => {
  const CREDIT = "© openrouteservice.org by HeiGIT | Map data © OpenStreetMap contributors";
  const creditText = () => screen.getByTestId("ors-credit").textContent?.replace(/\s+/g, " ").trim();

  it("is one always-visible line under the map on Plan, outside the map itself", async () => {
    render(<WalkPlannerApp />);
    await flush();
    fireEvent.change(screen.getByPlaceholderText(/^(Latitude|קו רוחב)$/), { target: { value: String(ORIGIN.lat) } });
    fireEvent.change(screen.getByPlaceholderText(/^(Longitude|קו אורך)$/), { target: { value: String(ORIGIN.lng) } });
    fireEvent.click(screen.getByRole("button", { name: /^(Build walking route|בנה מסלול הליכה)$/ }));
    await flush();

    expect(screen.getAllByTestId("ors-credit")).toHaveLength(1);
    expect(creditText()).toBe(CREDIT);
    const credit = screen.getByTestId("ors-credit");
    // Not on the map's edge: neither inside the map nor inside its section, but right after it.
    expect(screen.getByTestId("map").contains(credit)).toBe(false);
    expect(credit.closest("section")).toBeNull();
    const mapSection = screen.getByTestId("map").closest("section")!;
    expect(mapSection.parentElement).toBe(credit.closest("[data-testid=map-credits]")!.parentElement);
    expect(screen.queryByRole("button", { name: "Map credits" })).toBeNull();
    // The link OSM asks for.
    expect(screen.getByRole("link", { name: "OpenStreetMap contributors" }).getAttribute("href")).toBe("https://www.openstreetmap.org/copyright");
  });

  it("moves to the bottom of the walk sheet on Live Walk, still exactly once, still always visible", async () => {
    await startSimulatedWalk();
    await advance(2_000);
    expect(screen.getAllByTestId("ors-credit")).toHaveLength(1);
    expect(creditText()).toBe(CREDIT);
    expect(screen.getByTestId("walk-hud").contains(screen.getByTestId("ors-credit"))).toBe(true);
    expect(screen.getByTestId("map").contains(screen.getByTestId("ors-credit"))).toBe(false);
    // The last thing in the sheet, under Ask / End walk.
    const sheet = screen.getByTestId("walk-hud");
    expect(sheet.lastElementChild).toBe(screen.getByTestId("map-credits"));
  });

  it("is on screen whenever the sheet is, whatever state it is in", async () => {
    await startSimulatedWalk();
    fireEvent.click(screen.getByRole("button", { name: "Details" })); // peek -> half
    expect(screen.getByTestId("walk-hud").getAttribute("data-sheet")).toBe("half");
    expect(creditText()).toBe(CREDIT);
  });
});

describe("the walker's heading on the map (feedback 2026-11-22, item 1)", () => {
  const heading = () => screen.getByTestId("map").getAttribute("data-heading");

  it("has no arrowhead before the first fix, then faces the way the simulated walker is going (north)", async () => {
    await startSimulatedWalk();
    expect(heading()).toBe("");
    await advance(4_000);
    expect(Number(heading())).toBeCloseTo(0, 0); // the stub route runs due north
  });

  it("turns with the walker when the route turns, and not before", async () => {
    // Off the planned line along the side street, which runs due east.
    await startSimulatedWalk();
    await advance(2_000);
    expect(Number(heading())).toBeCloseTo(0, 0);
    fireEvent.click(screen.getByRole("button", { name: /Stray 80 m off route/ }));
    await flush();
    await advance(10_000);
    // The smoother follows the east-bound detour: well round from north and heading for 90.
    expect(Number(heading())).toBeGreaterThan(60);
    expect(Number(heading())).toBeLessThanOrEqual(90.5);
  });

  it("drops the arrowhead when the walk ends", async () => {
    await startSimulatedWalk();
    await advance(4_000);
    expect(heading()).not.toBe("");
    fireEvent.click(screen.getByRole("button", { name: "End walk" }));
    fireEvent.click(screen.getByRole("button", { name: /End walk/ })); // second tap confirms
    await flush();
    expect(heading()).toBe("");
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
    expect(screen.getByRole("button", { name: "Build walking route" })).toBeTruthy();
  }

  it("does not restart the walk when the held rebuild later succeeds", async () => {
    await startRebuild();
    fireEvent.click(screen.getByRole("button", { name: "End walk" }));
    fireEvent.click(screen.getByRole("button", { name: /End walk/ })); // second tap confirms
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
    fireEvent.click(screen.getByRole("button", { name: /End walk/ })); // second tap confirms
    await flush();
    expectWalkEnded();
    await act(async () => heldPlan!.reject());
    await advance(5_000);
    expectWalkEnded();
  });
});

describe("the local way back", () => {
  it("auto mode asks first too, and Back to my route falls back to the full re-plan when no way back can be routed", async () => {
    settingsStore["walk-settings"] = JSON.stringify({
      ...DEFAULT_WALK_SETTINGS,
      deviationMode: "auto",
    });
    rerouteMode = "fail";
    await startSimulatedWalk();
    await stray();
    expect(walkPlanCalls).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Back to my route" }));
    await flush();

    expect(rerouteCalls.length).toBeGreaterThanOrEqual(1);
    expect(walkPlanCalls).toHaveLength(2);
  });

  it("in ask mode offers Back to my route, which routes locally instead of re-planning", async () => {
    await startSimulatedWalk();
    await stray();

    expect(screen.getByText(/You've gone off the planned route/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back to my route" }));
    await flush();
    expect(rerouteCalls).toHaveLength(1);
    expect(rerouteCalls[0].candidates.length).toBeGreaterThanOrEqual(1);
    expect(rerouteCalls[0].candidates.length).toBeLessThanOrEqual(2);
    expect(walkPlanCalls).toHaveLength(1);
    // And it is seen to work: the card is answered and the walk sheet says what was drawn.
    expect(screen.queryByTestId("off-route-card")).toBeNull();
    expect(screen.getByTestId("walk-notice").textContent).toContain("Way back drawn");
  });
});

/** The synthetic stray: 100 m beside the route from the first fix on, and it stays there until "Rejoin the route". */
function strayBesideRoute() {
  vi.spyOn(SimulatedWalkTracker.prototype, "strayOffRoute").mockImplementation(async function (this: SimulatedWalkTracker) {
    (this as unknown as { stray: unknown }).stray = { offsetMeters: 100, untilDistance: Infinity };
    return false;
  });
}

async function clickStray() {
  await advance(2_000);
  fireEvent.click(screen.getByRole("button", { name: /Stray 80 m off route/ }));
  await flush();
}

const backButton = () => screen.queryByRole("button", { name: /^(Back to my route|חזרה למסלול)$/ });
async function waitForCard() {
  for (let i = 0; i < 20 && backButton() === null; i += 1) await advance(1_000);
  expect(backButton()).not.toBeNull();
}
const noticeText = () => screen.queryByTestId("walk-notice")?.textContent ?? "";
const routeFirst = () => screen.getByTestId("map").getAttribute("data-route-first");

describe("Back to my route: every tap shows what happened (feedback 2026-11-22, item 6)", () => {
  it("draws the way back, answers the card, says so, and replaces the line even when the street is 60 m from the walker", async () => {
    rerouteStartGapM = 60;
    await startSimulatedWalk();
    await stray();
    const before = routeFirst();
    expect(before).toBe(`${ORIGIN.lat.toFixed(5)},${ORIGIN.lng.toFixed(5)}`);

    fireEvent.click(screen.getByRole("button", { name: "Back to my route" }));
    await flush();

    expect(rerouteCalls).toHaveLength(1);
    // The walker is still off the old road, but the question is answered: the card is down.
    expect(screen.queryByTestId("off-route-card")).toBeNull();
    // The line the map draws now starts where the router put the connector, not where the old route began.
    expect(routeFirst()).not.toBe(before);
    expect(Number(routeFirst()!.split(",")[0])).toBeCloseTo(rerouteCalls[0].from.lat - 60 / 111_195, 4);
    // The notice names the one thing left to do: walk to the road first.
    const text = noticeText();
    expect(text).toContain("Way back drawn");
    expect(text).toContain("Walk to the road first");
    expect(text).toContain("green line");
    expect(screen.getByTestId("walk-notice").className).toContain("bg-forest/10"); // success tone
    // No re-plan, no "Updating your route".
    expect(walkPlanCalls).toHaveLength(1);
    expect(screen.queryByText("Updating your route…")).toBeNull();
  });

  it("a connector that starts at the walker's feet just says to follow the green line, with its length", async () => {
    await startSimulatedWalk();
    await stray();
    fireEvent.click(screen.getByRole("button", { name: "Back to my route" }));
    await flush();
    expect(noticeText()).toMatch(/^Way back drawn\. Follow the green line \(\d+ m\)\.$/);
    expect(noticeText()).not.toContain("Walk to the road first");
  });

  it("speaks Hebrew on the sheet too", async () => {
    settingsStore["walk-settings"] = JSON.stringify({ deviationMode: "ask", uiLanguage: "he" });
    await startSimulatedWalk();
    await stray();
    fireEvent.click(screen.getByRole("button", { name: "חזרה למסלול" }));
    await flush();
    expect(noticeText()).toMatch(/סימנו את הדרך חזרה/);
    expect(noticeText()).toContain("מ׳");
  });

  it("a second tap while the way back is still being routed says so instead of doing nothing", async () => {
    holdReroute = true;
    await startSimulatedWalk();
    await stray();
    fireEvent.click(screen.getByRole("button", { name: "Back to my route" }));
    await flush();
    expect(rerouteCalls).toHaveLength(1);
    expect(screen.getAllByText("Finding the way back…").length).toBeGreaterThan(0); // the card's own busy line

    fireEvent.click(screen.getByRole("button", { name: "Back to my route" }));
    await flush();
    expect(rerouteCalls).toHaveLength(1); // still just the one request
    expect(noticeText()).toContain("Still finding the way back");

    holdReroute = false;
    await act(async () => releaseReroute!());
    await flush();
    expect(noticeText()).toContain("Way back drawn");
    expect(screen.queryByTestId("off-route-card")).toBeNull();
  });

  it("a tap within a minute of the last way back still runs it, and a new stray brings the card back", async () => {
    strayBesideRoute();
    await startSimulatedWalk();
    await clickStray();
    await waitForCard();

    fireEvent.click(backButton()!);
    await flush();
    expect(rerouteCalls).toHaveLength(1);
    expect(noticeText()).toContain("Way back drawn");
    expect(backButton()).toBeNull();

    // Back on a line for half a minute (a real rejoin re-arms the card), then straying again.
    fireEvent.click(screen.getByRole("button", { name: "Rejoin the route" }));
    await flush();
    for (let i = 0; i < 8; i++) await advance(4_000);
    fireEvent.click(screen.getByRole("button", { name: /Stray 80 m off route/ }));
    await flush();
    await waitForCard();

    // Still inside the 60 s fix-clock cooldown of the first success: the old code returned here without a word.
    fireEvent.click(backButton()!);
    await flush();
    expect(rerouteCalls).toHaveLength(2);
    expect(noticeText()).toContain("Way back drawn");
  });

  it.each([
    [422, "no plausible way"],
    [429, "rate limited"],
    [502, "routing service down"],
  ])("when /api/reroute says %i (%s) it explains, then rebuilds from here, never a silent no-op", async (status) => {
    rerouteMode = "fail";
    rerouteFailStatus = status;
    await startSimulatedWalk();
    await stray();
    fireEvent.click(screen.getByRole("button", { name: "Back to my route" }));
    await flush();

    expect(rerouteCalls).toHaveLength(1);
    expect(noticeText()).toContain("No street way back found");
    expect(noticeText()).toContain("Rebuilding your route from here");
    expect(screen.getByTestId("walk-notice").className).toContain("bg-warn/15");
    // The full re-plan the notice promised.
    expect(walkPlanCalls).toHaveLength(2);
  });

  it("a stale fix says it is waiting for GPS and does not route from where the walker was", async () => {
    await startSimulatedWalk();
    await stray();
    // 30 s pass with no fix getting through (the clock moves, the position stream does not).
    vi.setSystemTime(Date.now() + 30_000);
    fireEvent.click(screen.getByRole("button", { name: "Back to my route" }));
    await flush();

    expect(rerouteCalls).toHaveLength(0);
    expect(walkPlanCalls).toHaveLength(1);
    expect(noticeText()).toContain("Waiting for a fresh GPS fix");
    // Nothing was answered: the card is still up for the next tap.
    expect(backButton()).not.toBeNull();
  });

  it("a preview deployment names the outcome in the notice; production does not", async () => {
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "preview");
    await startSimulatedWalk();
    await stray();
    fireEvent.click(screen.getByRole("button", { name: "Back to my route" }));
    await flush();
    expect(noticeText()).toMatch(/\[routed\]$/);
    cleanup();

    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "production");
    installFetch();
    await startSimulatedWalk();
    await stray();
    fireEvent.click(screen.getByRole("button", { name: "Back to my route" }));
    await flush();
    expect(noticeText()).toContain("Way back drawn");
    expect(noticeText()).not.toContain("[");
  });
});

describe("the centred off-route card", () => {
  it("is an alertdialog outside the sheet, with 56px actions and a quiet dismiss", async () => {
    await startSimulatedWalk();
    await stray();

    const card = screen.getByTestId("off-route-card");
    expect(card.getAttribute("role")).toBe("alertdialog");
    expect(screen.getByTestId("walk-hud").contains(card)).toBe(false);
    for (const name of ["Back to my route", "Best route from here"]) {
      expect(screen.getByRole("button", { name }).className).toContain("min-h-14");
    }
    expect(screen.getByRole("button", { name: "I know where I'm going" }).className).toContain("min-h-11");
    // Ask mode: the silent return is shown as a countdown bar.
    expect(screen.getByTestId("off-route-countdown")).toBeTruthy();
  });

  it("folds into a pill when the scrim is tapped, and opens again from the pill", async () => {
    await startSimulatedWalk();
    await stray();

    fireEvent.click(screen.getByTestId("off-route-scrim"));
    expect(screen.queryByTestId("off-route-card")).toBeNull();
    fireEvent.click(screen.getByTestId("off-route-pill"));
    expect(screen.getByTestId("off-route-card")).toBeTruthy();
  });

  it("buzzes once per episode: answering the ask card does not raise a second card or a second buzz", async () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: vibrate });
    await startSimulatedWalk();
    await stray();
    expect(vibrate).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Back to my route" }));
    await flush();
    await advance(2_000);
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(screen.queryAllByTestId("off-route-card").length).toBeLessThanOrEqual(1);
  });

  it("speaks Hebrew with a Hebrew turn hint", async () => {
    settingsStore["walk-settings"] = JSON.stringify({ deviationMode: "ask", uiLanguage: "he" });
    await startSimulatedWalk();
    await stray();

    const card = screen.getByTestId("off-route-card");
    expect(card.textContent).toContain("סטיתם מהמסלול");
    expect(screen.getByRole("button", { name: "חזרה למסלול" })).toBeTruthy();
    expect(card.textContent).toMatch(/פנו|המשיכו|הסתובבו|לכו/);
  });
});

describe("ending the walk (walk feedback 2026-11)", () => {
  it("End takes two taps, the confirm lasts 5 s, and the finish card is in the map section, not the aside", async () => {
    await startSimulatedWalk();
    await advance(2_000);
    fireEvent.click(screen.getByRole("button", { name: "End walk" }));
    await advance(4_000);
    expect(screen.getByRole("button", { name: "End walk?" })).toBeTruthy(); // still asking after 4 s
    await advance(1_500);
    expect(screen.queryByRole("button", { name: "End walk?" })).toBeNull(); // lapsed after 5 s

    fireEvent.click(screen.getByRole("button", { name: "End walk" }));
    fireEvent.click(screen.getByRole("button", { name: "End walk?" }));
    await flush();
    const finish = screen.getByText(/You finished your walk/);
    expect(finish.closest("aside")).toBeNull();
    expect(finish.closest("section")).not.toBeNull();
  });

  it("asks 'Finish walk / Keep walking' at the end of the route with every stop visited, and never ends it by itself", async () => {
    shortRoute = true;
    await startSimulatedWalk();
    for (let i = 0; i < 400 && screen.queryByRole("button", { name: "Finish walk" }) === null; i += 1) {
      await advance(5_000);
    }
    expect(screen.getByRole("button", { name: "Finish walk" })).toBeTruthy();
    expect(screen.getByTestId("walk-hud")).toBeTruthy();

    // Keep walking: the card goes and does not come back.
    fireEvent.click(screen.getByRole("button", { name: "Keep walking" }));
    await advance(30_000);
    expect(screen.queryByRole("button", { name: "Finish walk" })).toBeNull();
    expect(screen.getByTestId("walk-hud")).toBeTruthy();
  });

  it("Finish walk ends the walk and shows the finish card", async () => {
    shortRoute = true;
    await startSimulatedWalk();
    for (let i = 0; i < 400 && screen.queryByRole("button", { name: "Finish walk" }) === null; i += 1) {
      await advance(5_000);
    }
    fireEvent.click(screen.getByRole("button", { name: "Finish walk" }));
    await flush();
    expect(screen.queryByTestId("walk-hud")).toBeNull();
    expect(screen.getByText(/You finished your walk/)).toBeTruthy();
  });

  it("uses the clear Hebrew labels", () => {
    render(<WalkHud alert={null} stats={null} lang="he" onDetails={() => {}} onEndWalk={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "סיום הליכה" }));
    expect(screen.getByRole("button", { name: "לסיים את ההליכה?" })).toBeTruthy();
  });
});
