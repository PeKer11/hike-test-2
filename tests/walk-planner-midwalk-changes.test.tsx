/**
 * Changing the route in the middle of a Live Walk (review 2026-11-22).
 *
 * Same method as `walk-planner-rebuild-timeout.test.tsx`: a real
 * `SimulatedWalkTracker` walks a real route inside the real component, and
 * `fetch` is the only fake. Each test pins one problem from
 * `docs/PACE-AND-MIDWALK-REROUTE-REVIEW-2026-11-22.md`.
 */

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Attraction, Coordinates, WalkPlan, WalkSegment } from "@/lib/types";

vi.mock("@/components/map", () => ({
  DynamicMap: ({
    waypoints,
  }: {
    waypoints: { id: string; name: string }[];
  }) => (
    <div data-testid="map">
      {waypoints.map((waypoint) => (
        <span key={waypoint.id} aria-label={`Map marker ${waypoint.name}`} />
      ))}
    </div>
  ),
}));

const { WalkPlannerApp } = await import("@/components/planner/WalkPlannerApp");

const ORIGIN: Coordinates = { lat: 32.08, lng: 34.78 };
const ROUTE: Coordinates[] = [ORIGIN, { lat: 32.35, lng: 34.78 }];
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
  return { from: { name: "origin", coordinates: ORIGIN }, to, distanceMeters: 900, walkingMinutes: 13 };
}

function planOf(attractions: Attraction[], overrides: Partial<WalkPlan> = {}): WalkPlan {
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
    encoded += encodeSignedValue(lat - lastLat) + encodeSignedValue(lng - lastLng);
    lastLat = lat;
    lastLng = lng;
  }
  return encoded;
}

type WalkPlanBody = Record<string, unknown>;

let walkPlanCalls: WalkPlanBody[];
let settingsStore: Record<string, string>;
/** While true, every /api/walk-plan call settles only when aborted or released through `releaseHeld`. */
let hangRebuilds: boolean;
let releaseHeld: Array<() => void>;
let planAnswer: () => WalkPlan;

function installFetch() {
  walkPlanCalls = [];
  hangRebuilds = false;
  releaseHeld = [];
  planAnswer = () => planOf([MUSEUM, CATHEDRAL, MARKET]);
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      if (typeof url === "string" && url.startsWith("/api/walk-plan")) {
        walkPlanCalls.push(init?.body ? (JSON.parse(String(init.body)) as WalkPlanBody) : {});
        if (hangRebuilds && init?.signal) {
          const signal = init.signal;
          return new Promise((resolve, reject) => {
            signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
            releaseHeld.push(() => resolve({ ok: true, json: async () => planAnswer() }));
          });
        }
        return Promise.resolve({ ok: true, json: async () => planAnswer() });
      }
      if (url === "/api/directions") {
        return Promise.resolve({ ok: true, json: async () => ({ routes: [{ geometry: encodePolyline(SIDE_STREET) }] }) });
      }
      if (url === "/api/nearby") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ places: [{ ...CAFE, source: "osm", verification: "registered", kind: "poi" }] }),
        });
      }
      return Promise.resolve({ ok: false, json: async () => ({ error: "not stubbed here" }) });
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

async function startSimulatedWalk(opts: { loop?: boolean } = {}) {
  render(<WalkPlannerApp />);
  await flush();
  fireEvent.change(screen.getByPlaceholderText("Latitude"), { target: { value: String(ORIGIN.lat) } });
  fireEvent.change(screen.getByPlaceholderText("Longitude"), { target: { value: String(ORIGIN.lng) } });
  if (opts.loop) fireEvent.change(screen.getByPlaceholderText("Any"), { target: { value: "0" } });
  fireEvent.click(screen.getByRole("button", { name: "Build walking route" }));
  await flush();
  fireEvent.click(screen.getByLabelText(/Simulate this walk/));
  fireEvent.click(screen.getByRole("button", { name: "Start Walk" }));
  await flush();
}

/** Stray, get asked, and say yes to the redraw: the walker changes the route mid-walk. */
async function redrawFromHere() {
  await advance(2_000);
  fireEvent.click(screen.getByRole("button", { name: /Stray 80 m off route/ }));
  await flush();
  await advance(8_000);
  fireEvent.click(screen.getByRole("button", { name: "Best route from here" }));
  await flush();
}

beforeEach(() => {
  vi.useFakeTimers();
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
  installFetch();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("P3: a loop walk keeps its real start after a mid-walk change", () => {
  it("sends the original start as returnTo, not the walker's current position", async () => {
    await startSimulatedWalk({ loop: true });
    await redrawFromHere();

    expect(walkPlanCalls.length).toBeGreaterThanOrEqual(2);
    const first = walkPlanCalls[0];
    const rebuild = walkPlanCalls[1];
    // The first build is the walker's own: nothing to close at but its own origin.
    expect(first.returnTo).toBeUndefined();
    expect(first.maxEndDistanceFromOriginMeters).toBe(0);
    // The rebuild starts from where the walker stands, and still closes at the real start.
    expect(rebuild.maxEndDistanceFromOriginMeters).toBe(0);
    expect(rebuild.lng as number).toBeGreaterThan(ORIGIN.lng);
    expect(rebuild.returnTo).toEqual(ORIGIN);
  });
});

const CAFE: Attraction = {
  id: "osm-node-777",
  name: "Café Ahead",
  coordinates: { lat: 32.09, lng: 34.7806 }, // ~60 m east of the route, ahead of the start
  category: "food",
  avgVisitMinutes: 20,
  tags: { name: "Café Ahead" },
};

/** A walk at a fast pace, where "Extend the hike" adds the café ahead. */
async function startFastWalk() {
  await startSimulatedWalk();
  await advance(3_000);
  fireEvent.click(screen.getByRole("button", { name: "Fast pace" }));
  await flush();
  await advance(45_000);
}

describe("P5: a change asked for while an update is running is not lost silently", () => {
  it("tells the walker when a change from the walk chat cannot run yet", async () => {
    await startFastWalk();
    hangRebuilds = true;
    fireEvent.click(screen.getByRole("button", { name: "Extend the hike" }));
    await flush();
    const callsWhileRunning = walkPlanCalls.length;
    expect(screen.getByText("Updating your route…")).toBeTruthy();

    // Another change, asked through the walk chat while the first answer has not come back.
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    const box = within(screen.getByTestId("walk-chat")).getByRole("textbox");
    fireEvent.change(box, { target: { value: "add a stop" } });
    fireEvent.submit(box.closest("form")!);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Add a stop" }));
    await flush();
    expect(walkPlanCalls).toHaveLength(callsWhileRunning);
    expect(screen.getByTestId("walk-notice").textContent).toContain("Still updating your route");
  });

  it("End walk during an update, then a new walk: a later change still runs", async () => {
    await startSimulatedWalk();
    await advance(2_000);
    fireEvent.click(screen.getByRole("button", { name: /Stray 80 m off route/ }));
    await flush();
    await advance(8_000);
    hangRebuilds = true;
    fireEvent.click(screen.getByRole("button", { name: "Best route from here" }));
    await flush();
    expect(screen.getByText("Updating your route…")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "End walk" }));
    fireEvent.click(screen.getByRole("button", { name: "End walk?" }));
    await flush();

    // A fresh walk. The update that was cut short must not leave its "running" flag behind.
    hangRebuilds = false;
    fireEvent.click(screen.getByRole("button", { name: "Build walking route" }));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Start Walk" }));
    await flush();
    await advance(2_000);
    const callsBefore = walkPlanCalls.length;
    fireEvent.click(screen.getByRole("button", { name: /Stray 80 m off route/ }));
    await flush();
    await advance(8_000);
    fireEvent.click(screen.getByRole("button", { name: "Best route from here" }));
    await flush();

    expect(walkPlanCalls.length).toBe(callsBefore + 1);
    expect(screen.queryByTestId("walk-notice")?.textContent ?? "").not.toContain("Still updating");
  });
});
