/**
 * Collapse, direction options, "Show me something different", the off-route
 * "While you're here" line and callouts from the Discovery Collection, driven
 * through the real component with a real `SimulatedWalkTracker`. `fetch` is the
 * only fake, and `/api/walk-options` runs the REAL route handler (ORS mocked),
 * so the overlap and de-duplication rules are exercised, not stubbed.
 */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Attraction, Coordinates, WalkPlan, WalkSegment } from "@/lib/types";
import type { Announcement } from "@/lib/walk/poi-announcer";
import { haversineDistance } from "@/lib/utils/geo";
import { SimulatedWalkTracker } from "@/lib/walk/simulated-walk-tracker";

interface MapProps {
  routeGeometry: Coordinates[];
  previewRoutes?: Array<{ id: string; geometry: Coordinates[]; highlighted: boolean }>;
  callouts?: Announcement[];
  /** Set after commit: whether an alert card was in the DOM with this render. */
  alertUp?: boolean;
}
const mapRenders: MapProps[] = [];
let selectCallout: ((a: Announcement) => void) | undefined;

vi.mock("@/components/map", () => ({
  DynamicMap: (props: MapProps) => {
    const entry: MapProps = {
      routeGeometry: props.routeGeometry,
      previewRoutes: props.previewRoutes,
      callouts: props.callouts,
    };
    mapRenders.push(entry);
    selectCallout = (props as { onCalloutSelect?: (a: Announcement) => void }).onCalloutSelect;
    useEffect(() => {
      entry.alertUp = document.querySelector('[role="alert"], [role="alertdialog"]') !== null;
    });
    return <div data-testid="map" data-previews={props.previewRoutes?.length ?? 0} />;
  },
}));

/** When set, the planner offers one stop-less route (a loop from here) and nothing else. */
let forceStoplessOption = false;
vi.mock("@/lib/walk/direction-options", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/walk/direction-options")>();
  return {
    ...actual,
    buildDirectionOptions: (input: Parameters<typeof actual.buildDirectionOptions>[0]) =>
      forceStoplessOption
        ? [
            {
              theme: "nature" as const,
              mode: "roundtrip" as const,
              stops: [],
              sector: null,
              score: 0,
              estMinutes: 20,
              seed: 0,
              roundTripLengthM: 1500,
            },
          ]
        : actual.buildDirectionOptions(input),
  };
});

const mockGetDirections = vi.fn();
vi.mock("@/lib/api/ors-client", () => ({
  getDirections: (...args: unknown[]) => mockGetDirections(...args),
}));

const { WalkPlannerApp } = await import("@/components/planner/WalkPlannerApp");
const { POST: walkOptionsPost } = await import("@/app/api/walk-options/route");

const ORIGIN: Coordinates = { lat: 32.08, lng: 34.78 };
const M_LAT = 111_195;
const M_LNG = M_LAT * Math.cos((ORIGIN.lat * Math.PI) / 180);
/** `east` / `north` metres from the origin. */
const at = (east: number, north: number): Coordinates => ({
  lat: ORIGIN.lat + north / M_LAT,
  lng: ORIGIN.lng + east / M_LNG,
});

const ROUTE: Coordinates[] = [ORIGIN, { lat: 32.35, lng: 34.78 }];
const SIDE_STREET: Coordinates[] = [ORIGIN, { lat: 32.08, lng: 34.99 }];

function attraction(id: string, name: string, lat: number): Attraction {
  return { id, name, coordinates: { lat, lng: 34.78 }, category: "museum", avgVisitMinutes: 20, tags: {} };
}
const MUSEUM = attraction("a1", "City Museum", 32.09);
const CATHEDRAL = attraction("a2", "Old Cathedral", 32.11);

function planOf(attractions: Attraction[]): WalkPlan {
  const segment = (to: Attraction): WalkSegment => ({
    from: { name: "origin", coordinates: ORIGIN },
    to,
    distanceMeters: 900,
    walkingMinutes: 13,
  });
  return {
    orderedAttractions: attractions,
    segments: attractions.map(segment),
    totalDistanceMeters: 900 * attractions.length,
    totalMinutes: 33 * attractions.length,
    feasible: true,
    droppedAttractions: [],
    geometry: ROUTE,
  };
}

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
  for (const c of coords) {
    const lat = Math.round(c.lat * 1e5);
    const lng = Math.round(c.lng * 1e5);
    encoded += encodeSignedValue(lat - lastLat) + encodeSignedValue(lng - lastLng);
    lastLat = lat;
    lastLng = lng;
  }
  return encoded;
}

function place(id: string, name: string, c: Coordinates, category: string, over: Record<string, unknown> = {}) {
  return {
    id,
    name,
    coordinates: c,
    category,
    avgVisitMinutes: 15,
    tags: {},
    source: "osm",
    verification: "registered",
    kind: "poi",
    ...over,
  };
}

type Json = Record<string, unknown>;
let scanPlaces: ReturnType<typeof place>[];
let walkPlanCalls: Json[];
let nearbyCalls: Json[];
let optionsRequests: Json[];
let optionsResponses: Array<{ options: Array<{ theme: string; overlapWalked: number; stops: Coordinates[] }> }>;
let holdOptions: boolean;
let heldOptions: (() => void) | null;
let settingsStore: Record<string, string>;
let rerouteMode: "ok" | "fail";
/** While set, /api/walk-plan calls after the first settle only when released or aborted. */
let holdWalkPlan: boolean;
let heldWalkPlans: Array<() => void>;

function installFetch() {
  walkPlanCalls = [];
  nearbyCalls = [];
  optionsRequests = [];
  optionsResponses = [];
  holdOptions = false;
  heldOptions = null;
  rerouteMode = "ok";
  holdWalkPlan = false;
  heldWalkPlans = [];
  forceStoplessOption = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith("/api/walk-plan")) {
        walkPlanCalls.push(JSON.parse(String(init?.body)) as Json);
        if (holdWalkPlan && init?.signal) {
          const signal = init.signal;
          return new Promise((resolve, reject) => {
            signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
            heldWalkPlans.push(() => resolve({ ok: true, json: async () => planOf([MUSEUM, CATHEDRAL]) }));
          });
        }
        return { ok: true, json: async () => planOf([MUSEUM, CATHEDRAL]) };
      }
      if (url === "/api/directions") {
        return { ok: true, json: async () => ({ routes: [{ geometry: encodePolyline(SIDE_STREET) }] }) };
      }
      if (url === "/api/nearby") {
        nearbyCalls.push(JSON.parse(String(init?.body)) as Json);
        return {
          ok: true,
          json: async () => ({ places: scanPlaces, ring: [], wikipedia: [], commons: [] }),
        };
      }
      if (url === "/api/reroute") {
        const body = JSON.parse(String(init?.body)) as { from: Coordinates; candidates: Coordinates[] };
        if (rerouteMode === "fail") {
          return { ok: false, status: 422, json: async () => ({ error: "none" }) };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ geometry: [body.from, body.candidates[0]], distanceMeters: 100, candidateIndex: 0 }),
        };
      }
      if (url === "/api/walk-options") {
        optionsRequests.push(JSON.parse(String(init?.body)) as Json);
        if (holdOptions) {
          await new Promise<void>((resolve) => {
            heldOptions = resolve;
          });
        }
        const res = await walkOptionsPost(
          new Request("http://localhost/api/walk-options", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-forwarded-for": "10.7.0.1" },
            body: String(init?.body),
          }),
        );
        const clone = res.clone();
        if (res.ok) optionsResponses.push((await clone.json()) as (typeof optionsResponses)[number]);
        return res;
      }
      return { ok: false, json: async () => ({ error: "not stubbed here" }) };
    }),
  );
  // ORS: straight lines through the waypoints (a one-point round trip is a small loop).
  mockGetDirections.mockReset();
  mockGetDirections.mockImplementation(async ({ coordinates }: { coordinates: number[][] }) => {
    let pts = coordinates.map(([lng, lat]) => ({ lat, lng }));
    if (pts.length === 1) {
      pts = [pts[0], { lat: pts[0].lat + 0.003, lng: pts[0].lng - 0.003 }, pts[0]];
    }
    let d = 0;
    for (let i = 1; i < pts.length; i += 1) d += haversineDistance(pts[i - 1], pts[i]);
    return { routes: [{ geometry: encodePolyline(pts), summary: { distance: d, duration: d / 1.3 } }] };
  });
}

async function flush(times = 1) {
  for (let i = 0; i < times; i += 1) await act(async () => {});
}
async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
  await flush(6);
}

async function startSimulatedWalk() {
  render(<WalkPlannerApp />);
  await flush();
  fireEvent.change(screen.getByPlaceholderText("Latitude"), { target: { value: String(ORIGIN.lat) } });
  fireEvent.change(screen.getByPlaceholderText("Longitude"), { target: { value: String(ORIGIN.lng) } });
  fireEvent.click(screen.getByRole("button", { name: "Build walking route" }));
  await flush();
  fireEvent.click(screen.getByLabelText(/Simulate this walk/));
  fireEvent.click(screen.getByRole("button", { name: "Start Walk" }));
  await flush(3);
}

/** The simulator's stray, 600 m off the line and never coming back. */
function strayForever() {
  vi.spyOn(SimulatedWalkTracker.prototype, "strayOffRoute").mockImplementation(async function (
    this: SimulatedWalkTracker,
  ) {
    (this as unknown as { stray: unknown }).stray = { offsetMeters: 600, untilDistance: Infinity };
    return false;
  });
}

async function clickStray() {
  await advance(2_000);
  fireEvent.click(screen.getByRole("button", { name: /Stray 80 m off route/ }));
  await flush(3);
}

const sheet = () => screen.queryByTestId("direction-options");

beforeEach(() => {
  vi.useFakeTimers();
  mapRenders.length = 0;
  // These suites exercise the ask-mode flow; the app default is now auto.
  settingsStore = { "walk-settings": JSON.stringify({ deviationMode: "ask", routeOrderMode: "reorder" }) };
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => settingsStore[k] ?? null,
      setItem: (k: string, v: string) => {
        settingsStore[k] = v;
      },
      removeItem: (k: string) => {
        delete settingsStore[k];
      },
      clear: () => {
        settingsStore = {};
      },
    },
  });
  // The walker ends up ~600 m west of the line: nature to the west, sights to the north.
  scanPlaces = [
    place("park-w", "Western Park", at(-1600, 250), "park"),
    place("park-n", "Northern Garden", at(-600, 1200), "park"),
    place("museum-e", "Eastern Museum", at(100, 700), "museum"),
    place("cafe-w", "West Cafe", at(-1700, 550), "food"),
  ];
  installFetch();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("a walker who has gone a different way (collapse)", () => {
  it("collapses ~60 simulated seconds after the stray, offers >=2 directions, and never picks for them", async () => {
    strayForever();
    await startSimulatedWalk();
    await clickStray();

    // 30 simulated seconds after the stray: not yet.
    await advance(3_000);
    expect(sheet()).toBeNull();
    expect(optionsRequests).toHaveLength(0);

    // ~60 s of fix time later (<= 90 simulated seconds in all) the options are up.
    await advance(6_000);
    const card = sheet();
    expect(card).not.toBeNull();
    const cards = card!.querySelectorAll("button[aria-pressed]");
    expect(cards.length).toBeGreaterThanOrEqual(2);
    expect(cards.length).toBeLessThanOrEqual(3);

    // One card: the sheet takes the alert's slot; no alert alongside it.
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
    expect(screen.queryByTestId("off-route-card")).toBeNull();
    expect(screen.queryAllByRole("alertdialog")).toHaveLength(0);
    expect(within(card!).getByRole("button", { name: "Back to my plan" })).toBeTruthy();

    // Every option the server let through avoids the walked track (<= 25% overlap).
    const response = optionsResponses[0];
    expect(response.options.length).toBeGreaterThanOrEqual(2);
    for (const o of response.options) expect(o.overlapWalked).toBeLessThanOrEqual(0.25);
    // <= 4 directions calls, never a matrix.
    expect(mockGetDirections.mock.calls.length).toBeLessThanOrEqual(4);
    // Dashed previews on the map, one per option.
    expect(screen.getByTestId("map").getAttribute("data-previews")).toBe(String(cards.length));

    // Nothing chooses for the walker, however long they leave it.
    await advance(60_000);
    expect(sheet()).not.toBeNull();
    expect(walkPlanCalls).toHaveLength(1);
  });

  it("tapping a card highlights its preview; choosing rebuilds through exactly its stops", async () => {
    strayForever();
    await startSimulatedWalk();
    await clickStray();
    await advance(9_000);
    const card = sheet()!;
    const cardButtons = [...card.querySelectorAll("button[aria-pressed]")] as HTMLButtonElement[];
    const lastIndex = cardButtons.length - 1;

    const highlighted = () => mapRenders[mapRenders.length - 1].previewRoutes!.findIndex((r) => r.highlighted);
    expect(highlighted()).toBe(0);
    fireEvent.click(cardButtons[lastIndex]);
    await flush();
    expect(highlighted()).toBe(lastIndex);
    expect(walkPlanCalls).toHaveLength(1);

    const chosen = optionsResponses[0].options[lastIndex];
    fireEvent.click(within(sheet()!).getByRole("button", { name: "Go this way" }));
    await flush(4);

    expect(sheet()).toBeNull();
    if (chosen.stops.length > 0) {
      expect(walkPlanCalls).toHaveLength(2);
      const kept = (walkPlanCalls[1].explicitAttractions ?? []) as Attraction[];
      expect(kept.map((a) => a.coordinates)).toEqual(chosen.stops);
      expect(walkPlanCalls[1].fillRemainingTime).toBe(false);
      // From where the walker is, and anchored where the walk began.
      expect(walkPlanCalls[1].endAnchor).toEqual(ORIGIN);
    } else {
      // A route-engine option is walked as drawn, not rebuilt by /api/walk-plan.
      expect(walkPlanCalls).toHaveLength(1);
    }
    expect(chosen.overlapWalked).toBeLessThanOrEqual(0.25);
  });

  // P6 of docs/PACE-AND-MIDWALK-REROUTE-REVIEW-2026-11-22.md: a route with no stops (the way home, a loop) is
  // swapped in directly. An update that was already running used to land afterwards and replace it.
  it("a stop-less direction chosen while an update is still running stays the route", async () => {
    forceStoplessOption = true; // a loop from here, with no stops, is what is offered
    strayForever();
    await startSimulatedWalk();
    await clickStray();
    await advance(3_000);
    holdWalkPlan = true;
    fireEvent.click(screen.getByRole("button", { name: "Best route from here" }));
    await flush(3);
    expect(walkPlanCalls).toHaveLength(2);
    expect(heldWalkPlans).toHaveLength(1);

    await advance(6_000);
    const card = sheet();
    expect(card).not.toBeNull();
    const options = optionsResponses[0].options;
    const index = options.findIndex((o) => o.stops.length === 0);
    expect(index).toBeGreaterThanOrEqual(0);
    const cardButtons = [...card!.querySelectorAll("button[aria-pressed]")] as HTMLButtonElement[];
    fireEvent.click(cardButtons[index]);
    await flush();
    fireEvent.click(within(sheet()!).getByRole("button", { name: "Go this way" }));
    await flush(4);
    const endOf = () => mapRenders[mapRenders.length - 1].routeGeometry.at(-1)!;
    const chosenEnd = endOf();
    expect(chosenEnd).not.toEqual(ROUTE[ROUTE.length - 1]);
    expect(walkPlanCalls).toHaveLength(2);

    // The update that was asked for before the choice answers late: it must not replace the chosen route.
    await act(async () => heldWalkPlans[0]());
    await advance(1_000);
    expect(endOf()).toEqual(chosenEnd);
    expect(screen.queryByText("Updating your route…")).toBeNull();
    expect(screen.queryByTestId("walk-hud")).not.toBeNull();
  });

  // P16 of docs/PACE-AND-MIDWALK-REROUTE-REVIEW-2026-11-22.md: a walker who is late and far from the start, and asks
  // to head back, used to get "Couldn't find a shorter way back" because the way home did not fit in 60% of the time left.
  it("'Head back' from a late, far walker still takes them home, even over the way they came", async () => {
    render(<WalkPlannerApp />);
    await flush();
    fireEvent.change(screen.getByPlaceholderText("Latitude"), { target: { value: String(ORIGIN.lat) } });
    fireEvent.change(screen.getByPlaceholderText("Longitude"), { target: { value: String(ORIGIN.lng) } });
    fireEvent.change(document.querySelector('input[type="number"][min="15"]') as HTMLInputElement, { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "Build walking route" }));
    await flush();
    fireEvent.click(screen.getByLabelText(/Simulate this walk/));
    fireEvent.click(screen.getByRole("button", { name: "Start Walk" }));
    await flush(3);
    await advance(110_000); // about 18 simulated minutes: 1.2 km out, 20-minute walk used up

    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    const box = within(screen.getByTestId("walk-chat")).getByRole("textbox");
    fireEvent.change(box, { target: { value: "head back" } });
    fireEvent.submit(box.closest("form")!);
    await flush();
    fireEvent.click(within(screen.getByTestId("walk-chat")).getByRole("button", { name: "Approve" }));
    await flush(6);
    await advance(1_000);

    expect(screen.queryByTestId("walk-notice")?.textContent ?? "").not.toContain("shorter way back");
    // The route the walker is on now ends at the start.
    const end = mapRenders[mapRenders.length - 1].routeGeometry.at(-1)!;
    expect(haversineDistance(end, ORIGIN)).toBeLessThan(30);
    expect(optionsRequests.some((r) => (r.options as Array<{ theme: string }>).some((o) => o.theme === "back"))).toBe(true);
  });

  it("never draws a straight line from the GPS dot to a route vertex", async () => {
    strayForever();
    await startSimulatedWalk();
    await clickStray();
    await advance(9_000);
    fireEvent.click(within(sheet()!).getByRole("button", { name: "Back to my plan" }));
    await flush(4);
    await advance(3_000);

    // The walker is ~600 m west of the line. Every drawn route starts ON the line.
    const drawn = mapRenders.map((r) => r.routeGeometry).filter((g) => g.length >= 2);
    expect(drawn.length).toBeGreaterThan(5);
    for (const g of drawn) expect(Math.abs(g[0].lng - ORIGIN.lng)).toBeLessThan(1e-5);
    // The preview lines are real ORS geometry, not a stub of the dot.
    const previews = mapRenders.flatMap((r) => r.previewRoutes ?? []);
    expect(previews.length).toBeGreaterThan(0);
  });

  it("'Back to my plan' is the existing redraw-from-here, not an option", async () => {
    strayForever();
    await startSimulatedWalk();
    await clickStray();
    await advance(9_000);
    fireEvent.click(within(sheet()!).getByRole("button", { name: "Back to my plan" }));
    await flush(4);
    expect(sheet()).toBeNull();
    expect(walkPlanCalls).toHaveLength(2);
    expect(walkPlanCalls[1].fillRemainingTime).toBe(false);
    expect(((walkPlanCalls[1].explicitAttractions ?? []) as Attraction[]).map((a) => a.id)).toEqual([
      "a1",
      "a2",
    ]);
  });

  it("End walk during an in-flight options request does not restart the walk", async () => {
    strayForever();
    await startSimulatedWalk();
    await clickStray();
    holdOptions = true;
    await advance(9_000);
    expect(optionsRequests).toHaveLength(1);
    expect(heldOptions).not.toBeNull();
    expect(sheet()).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "End walk" }));
    fireEvent.click(screen.getByRole("button", { name: /End walk/ })); // second tap confirms
    await flush(2);
    expect(screen.queryByTestId("walk-hud")).toBeNull();
    expect(screen.getByRole("button", { name: "Build walking route" })).toBeTruthy();

    // A NEW walk starts while the old request is still in flight. Only the
    // request-id guard keeps the stale answer from showing its sheet in it.
    holdOptions = false;
    const plansBefore = walkPlanCalls.length;
    fireEvent.click(screen.getByRole("button", { name: "Build walking route" }));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Start Walk" }));
    await flush(3);
    expect(screen.queryByTestId("walk-hud")).not.toBeNull();
    expect(walkPlanCalls).toHaveLength(plansBefore + 1);

    await act(async () => heldOptions!());
    await advance(1_000);

    expect(sheet()).toBeNull();
    expect(screen.queryByTestId("walk-hud")).not.toBeNull();
    expect(walkPlanCalls).toHaveLength(plansBefore + 1);
  });

  // Item 6 of docs/FEEDBACK-ROUND-2026-11-22.md: the collapse starts fetching directions while the off-route
  // card is still up, and a tap on "Back to my route" in that window used to return without a word.
  it("'Back to my route' tapped while the direction options are still loading is not a dead button", async () => {
    strayForever();
    await startSimulatedWalk();
    await clickStray();
    holdOptions = true;
    await advance(9_000);
    expect(optionsRequests).toHaveLength(1);
    expect(sheet()).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Back to my route" }));
    await flush(3);

    // The walker is 600 m away, so the honest answer is a re-plan from here, and the sheet says so.
    expect(walkPlanCalls).toHaveLength(2);
    expect(screen.getByTestId("walk-notice").textContent).toContain("You're far from the route");

    // The options answer that was in flight is dropped: it never shows over the walker's own choice.
    holdOptions = false;
    await act(async () => heldOptions!());
    await advance(1_000);
    expect(sheet()).toBeNull();
  });

  it("with nothing to offer it leaves the route alone (ask mode) rather than re-planning", async () => {
    scanPlaces = [];
    // No anchor either: a walker with no start point cannot be sent "back".
    strayForever();
    await startSimulatedWalk();
    await clickStray();
    // Make routing fail so no option survives.
    mockGetDirections.mockRejectedValue(new Error("ors down"));
    await advance(9_000);
    expect(sheet()).toBeNull();
    expect(walkPlanCalls).toHaveLength(1);
    expect(screen.getByRole("button", { name: "End walk" })).toBeTruthy();
  });
});

describe("Show me something different", () => {
  it("offers directions from the Details sheet without leaving the plan; Back just closes", async () => {
    await startSimulatedWalk();
    await advance(3_000);

    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    fireEvent.click(screen.getByRole("button", { name: "Details" })); // peek, half, details
    fireEvent.click(screen.getByRole("button", { name: "Show me something different" }));
    await flush(6);

    const card = sheet();
    expect(card).not.toBeNull();
    expect(card!.querySelectorAll("button[aria-pressed]").length).toBeGreaterThanOrEqual(1);
    // The current plan's remaining line travels as the overlapPlan reference.
    expect((optionsRequests[0].abandonedPlan as unknown[]).length).toBeGreaterThanOrEqual(2);
    expect(optionsRequests[0].endAnchor).toEqual(ORIGIN);

    fireEvent.click(within(card!).getByRole("button", { name: "Back to my plan" }));
    await flush(2);
    expect(sheet()).toBeNull();
    expect(walkPlanCalls).toHaveLength(1);
  });
});

describe("Show me something different while a collapse is pending (A7)", () => {
  it("is disabled once the options are up, so a second request cannot replace the sheet", async () => {
    await startSimulatedWalk();
    await advance(3_000);
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    fireEvent.click(screen.getByRole("button", { name: "Details" })); // peek, half, details
    const different = () => screen.getByRole("button", { name: "Show me something different" }) as HTMLButtonElement;
    expect(different().disabled).toBe(false);
    fireEvent.click(different());
    await flush(6);
    expect(sheet()).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    fireEvent.click(screen.getByRole("button", { name: "Details" })); // peek, half, details
    expect(different().disabled).toBe(true);
  });
});

describe("what the collection adds on the way", () => {
  it("scans once for the plan, and a local splice causes no new scan", async () => {
    settingsStore["walk-settings"] = JSON.stringify({ deviationMode: "auto" });
    await startSimulatedWalk();
    await advance(1_000);
    expect(nearbyCalls).toHaveLength(1);
    expect(nearbyCalls[0]).toMatchObject({ ringRadiusMeters: 600, signals: true });

    await clickStray();
    await advance(8_000);
    // The way back was spliced in locally...
    expect(walkPlanCalls).toHaveLength(1);
    // ...and the collection already covered it: still just the one scan.
    expect(nearbyCalls.length).toBeLessThanOrEqual(1);
  });

  it("announces a scanned place on the cross-track side, from the collection", async () => {
    scanPlaces = [place("bench", "Dizengoff Fountain", at(40, 120), "viewpoint")];
    await startSimulatedWalk();
    // One second at a time: React batches every state change inside one `act`, and
    // a callout is up for only a few fixes.
    for (let i = 0; i < 12; i += 1) await advance(1_000);
    const seen = mapRenders.flatMap((r) => r.callouts ?? []).filter((c) => c.place.id === "bench");
    expect(seen.length).toBeGreaterThan(0);
    expect(new Set(seen.map((c) => c.relation)).has("right")).toBe(true);
    expect(seen.some((c) => c.relation === "left")).toBe(false);
  });

  // Round 2: the centred off-route card carries no "While you're here" line (a distraction when lost);
  // the callout system announces those places once the card is gone.
  it("keeps the 'While you're here' line off the centred off-route card", async () => {
    scanPlaces = [
      place("fountain", "Old Fountain", at(150, 5), "landmark", { tags: { historic: "fountain" } }),
      place("kiosk", "Corner Kiosk", at(160, 8), "food"),
    ];
    await startSimulatedWalk();
    await clickStray();
    await advance(8_000);

    const card = screen.getByRole("alertdialog");
    expect(card.textContent).toMatch(/You've gone off the planned route/);
    expect(screen.queryAllByText(/While you're here:/)).toHaveLength(0);
  });
  it("announces nothing while the off-route ask card is up, and answering it lets them walk, with a rebuild button", async () => {
    // ~100 m off the line and staying there, so the 400 m collapse never triggers.
    vi.spyOn(SimulatedWalkTracker.prototype, "strayOffRoute").mockImplementation(async function (
      this: SimulatedWalkTracker,
    ) {
      (this as unknown as { stray: unknown }).stray = { offsetMeters: 100, untilDistance: Infinity };
      return false;
    });
    // A is just ahead of where the walker leaves the line, B further along the stray line.
    scanPlaces = [
      place("placeA", "Place A", at(-200, 60), "museum"),
      place("placeB", "Place B", at(-200, 230), "food"),
    ];
    await startSimulatedWalk();
    await clickStray();
    const knowButton = () => screen.queryByRole("button", { name: /I know where I'm going/ });
    // Step one second at a time until the off-route card is up; remember the render count then.
    for (let i = 0; i < 20 && !mapRenders.some((r) => r.alertUp); i += 1) await advance(1_000);
    const firstOffRouteIdx = mapRenders.findIndex((r) => r.alertUp);
    expect(firstOffRouteIdx).toBeGreaterThanOrEqual(0);
    const idsFrom = (from: number) =>
      new Set(mapRenders.slice(from).flatMap((r) => r.callouts ?? []).map((c) => c.place.id));
    // The whole run while the card is up (well under the 8-minute collapse).
    for (let i = 0; i < 12; i += 1) await advance(1_000);
    expect(knowButton()).not.toBeNull();
    expect(sheet()).toBeNull();
    expect(mapRenders[firstOffRouteIdx].callouts ?? []).toEqual([]);
    expect(idsFrom(firstOffRouteIdx).has("placeA")).toBe(false);
    expect(idsFrom(firstOffRouteIdx).has("placeB")).toBe(false);

    // "I know where I'm going" lets the walker walk: no re-plan, the card goes away, and a
    // "Off route" pill stays; it reopens the card, where "Best route from here" rebuilds.
    const plansBefore = walkPlanCalls.length;
    fireEvent.click(knowButton()!);
    await flush(3);
    expect(walkPlanCalls.length).toBe(plansBefore);
    expect(screen.queryByRole("button", { name: /Off route · / })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Off route · / }));
    await flush(3);
    expect(walkPlanCalls.length).toBe(plansBefore);
    fireEvent.click(screen.getByRole("button", { name: /Best route from here/ }));
    await flush(3);
    expect(walkPlanCalls.length).toBe(plansBefore + 1);
    expect(knowButton()).toBeNull();
  });

  // A6: a dismissal belongs to one excursion. Rejoining the route re-arms the
  // card, so the next stray raises it again.
  it("re-arms the off-route card after the walker rejoins: dismiss, rejoin, stray again, card returns", async () => {
    settingsStore["walk-settings"] = JSON.stringify({ deviationMode: "off" });
    vi.spyOn(SimulatedWalkTracker.prototype, "strayOffRoute").mockImplementation(async function (
      this: SimulatedWalkTracker,
    ) {
      (this as unknown as { stray: unknown }).stray = { offsetMeters: 100, untilDistance: Infinity };
      return false;
    });
    await startSimulatedWalk();
    await clickStray();
    const dismiss = () => screen.queryByRole("button", { name: /I know where I'm going/ });
    for (let i = 0; i < 20 && dismiss() === null; i += 1) await advance(1_000);
    expect(dismiss()).not.toBeNull();

    fireEvent.click(dismiss()!);
    await flush(3);
    // Still off the route: the dismissed card stays down.
    for (let i = 0; i < 6; i += 1) await advance(1_000);
    expect(dismiss()).toBeNull();

    // Rejoin, let the on-route fix re-arm, then stray again.
    fireEvent.click(screen.getByRole("button", { name: "Rejoin the route" }));
    await flush(3);
    for (let i = 0; i < 4; i += 1) await advance(1_000);
    fireEvent.click(screen.getByRole("button", { name: /Stray 80 m off route/ }));
    await flush(3);
    for (let i = 0; i < 20 && dismiss() === null; i += 1) await advance(1_000);
    expect(dismiss()).not.toBeNull();
  });

  for (const mode of ["auto", "off"] as const) {
    it(`${mode} mode: the plain off-route card can be dismissed and callouts resume`, async () => {
      settingsStore["walk-settings"] = JSON.stringify({ deviationMode: mode });
      vi.spyOn(SimulatedWalkTracker.prototype, "strayOffRoute").mockImplementation(async function (
        this: SimulatedWalkTracker,
      ) {
        (this as unknown as { stray: unknown }).stray = { offsetMeters: 100, untilDistance: Infinity };
        return false;
      });
      scanPlaces = [
        place("placeA", "Place A", at(-200, 60), "museum"),
        place("placeB", "Place B", at(-200, 230), "food"),
      ];
      await startSimulatedWalk();
      await clickStray();
      const dismiss = () => screen.queryByRole("button", { name: /I know where I'm going/ });
      for (let i = 0; i < 20 && !mapRenders.some((r) => r.alertUp); i += 1) await advance(1_000);
      const firstIdx = mapRenders.findIndex((r) => r.alertUp);
      expect(firstIdx).toBeGreaterThanOrEqual(0);
      const idsFrom = (from: number) =>
        new Set(mapRenders.slice(from).flatMap((r) => r.callouts ?? []).map((c) => c.place.id));
      for (let i = 0; i < 12; i += 1) await advance(1_000);
      expect(dismiss()).not.toBeNull();
      expect(idsFrom(firstIdx).has("placeB")).toBe(false);

      fireEvent.click(dismiss()!);
      await flush(3);
      const dismissIndex = mapRenders.length;
      for (let i = 0; i < 15; i += 1) await advance(1_000);
      expect(idsFrom(dismissIndex).has("placeB")).toBe(true);
    });
  }

  it("visit card: a place ~200 m aside in urban mode offers only 'Not now'", async () => {
    // Dense places along the line make the walk read as urban (detour limit 150 m).
    scanPlaces = Array.from({ length: 200 }, (_, k) => place(`d${k}`, `Dense ${k}`, at(10, 100 + 40 * k), "food"));
    await startSimulatedWalk();
    await advance(2_000);
    const aside = place("aside", "Far Fountain", at(200, 50), "landmark");
    await act(async () => {
      selectCallout!({
        place: aside as never,
        relation: "right",
        distanceM: 200,
        announcedAt: 0,
        isPlanStop: false,
      } as Announcement);
    });
    await flush(2);
    expect(screen.getByRole("button", { name: "Not now" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Add to walk/ })).toBeNull();
  });
  // Walk-feedback 2026-11, issue 3: the rebuild pill is always there while off route and no card is up.
  describe("rebuild pill and the 4-minute re-ask", () => {
    const pill = () => screen.queryByRole("button", { name: /Off route · / });
    const straySmall = () =>
      vi.spyOn(SimulatedWalkTracker.prototype, "strayOffRoute").mockImplementation(async function (
        this: SimulatedWalkTracker,
      ) {
        (this as unknown as { stray: unknown }).stray = { offsetMeters: 100, untilDistance: Infinity };
        return false;
      });

    it("is hidden while the ask card is up and shown once it is answered", async () => {
      straySmall();
      await startSimulatedWalk();
      await clickStray();
      for (let i = 0; i < 20 && screen.queryByRole("button", { name: /I know where I'm going/ }) === null; i += 1) {
        await advance(1_000);
      }
      expect(pill()).toBeNull(); // the card is up: no second control
      fireEvent.click(screen.getByRole("button", { name: /I know where I'm going/ }));
      await flush(3);
      expect(pill()).not.toBeNull();
    });

    it("after 'I know where I'm going', 5 minutes off route raises no question and no reroute", async () => {
      straySmall();
      await startSimulatedWalk();
      await clickStray();
      for (let i = 0; i < 20 && screen.queryByRole("button", { name: /I know where I'm going/ }) === null; i += 1) {
        await advance(1_000);
      }
      fireEvent.click(screen.getByRole("button", { name: /I know where I'm going/ }));
      await flush(3);
      const plans = walkPlanCalls.length;
      const reroutes = (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.filter(
        (c) => c[0] === "/api/reroute",
      ).length;
      for (let i = 0; i < 5 * 60; i += 5) await advance(5_000);
      expect(screen.queryByRole("button", { name: /I know where I'm going/ })).toBeNull();
      expect(walkPlanCalls.length).toBe(plans);
      const reroutesAfter = (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.filter(
        (c) => c[0] === "/api/reroute",
      ).length;
      expect(reroutesAfter).toBe(reroutes);
    });
  });
  // Walk-feedback 2026-11, D4: "Best route from here" asks keep-order vs re-order, unless the setting says.
  describe("best route from here: stop order", () => {
    async function offRouteWith(routeOrderMode: string | undefined) {
      settingsStore["walk-settings"] = JSON.stringify({ deviationMode: "ask", ...(routeOrderMode ? { routeOrderMode } : {}) });
      vi.spyOn(SimulatedWalkTracker.prototype, "strayOffRoute").mockImplementation(async function (
        this: SimulatedWalkTracker,
      ) {
        (this as unknown as { stray: unknown }).stray = { offsetMeters: 100, untilDistance: Infinity };
        return false;
      });
      await startSimulatedWalk();
      await clickStray();
      for (let i = 0; i < 20 && screen.queryByRole("button", { name: /Best route from here/ }) === null; i += 1) {
        await advance(1_000);
      }
    }
    const best = () => screen.getByRole("button", { name: /Best route from here/ });

    it("asks each time by default; 'Keep my stop order' sends fixedOrder, re-order does not", async () => {
      await offRouteWith(undefined);
      const plans = walkPlanCalls.length;
      fireEvent.click(best());
      await flush(3);
      expect(walkPlanCalls.length).toBe(plans); // nothing yet: the question is up
      expect(screen.getByTestId("route-order-ask")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Keep my stop order" }));
      await flush(4);
      expect(walkPlanCalls.length).toBe(plans + 1);
      expect(walkPlanCalls[plans].fixedOrder).toBe(true);
      expect(((walkPlanCalls[plans].explicitAttractions ?? []) as Attraction[]).map((a) => a.id)).toEqual(["a1", "a2"]);
    });

    it("re-order from the question leaves the order to the planner", async () => {
      await offRouteWith("ask");
      const plans = walkPlanCalls.length;
      fireEvent.click(best());
      await flush(3);
      fireEvent.click(screen.getByRole("button", { name: "Let Traike re-order for the shortest route" }));
      await flush(4);
      expect(walkPlanCalls.length).toBe(plans + 1);
      expect(walkPlanCalls[plans].fixedOrder).toBeUndefined();
    });

    it("setting 'keep' skips the question and keeps the order; 'reorder' skips it and re-orders", async () => {
      await offRouteWith("keep");
      const plans = walkPlanCalls.length;
      fireEvent.click(best());
      await flush(4);
      expect(screen.queryByTestId("route-order-ask")).toBeNull();
      expect(walkPlanCalls.length).toBe(plans + 1);
      expect(walkPlanCalls[plans].fixedOrder).toBe(true);
    });

    it("setting 'reorder' skips the question and re-orders", async () => {
      await offRouteWith("reorder");
      const plans = walkPlanCalls.length;
      fireEvent.click(best());
      await flush(4);
      expect(screen.queryByTestId("route-order-ask")).toBeNull();
      expect(walkPlanCalls.length).toBe(plans + 1);
      expect(walkPlanCalls[plans].fixedOrder).toBeUndefined();
    });
  });
});
