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
let walkPlanSignals: AbortSignal[];
let settingsStore: Record<string, string>;
let hangRebuilds: boolean;

function installFetch() {
  walkPlanCalls = [];
  walkPlanSignals = [];
  hangRebuilds = false;

  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      if (typeof url === "string" && url.startsWith("/api/walk-plan")) {
        walkPlanCalls.push(
          init?.body ? (JSON.parse(String(init.body)) as WalkPlanBody) : {},
        );
        // The first build is the walker's own and answers; every later one is
        // a rebuild that never does, and settles only when it is aborted.
        if (hangRebuilds && init?.signal) {
          const signal = init.signal;
          walkPlanSignals.push(signal);
          return new Promise((_resolve, reject) => {
            signal.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError")),
            );
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => planOf([MUSEUM, CATHEDRAL, MARKET]),
        });
      }

      if (url === "/api/directions") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            routes: [{ geometry: encodePolyline(SIDE_STREET) }],
          }),
        });
      }

      return Promise.resolve({
        ok: false,
        json: async () => ({ error: "not stubbed here" }),
      });
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

/** Stray, get asked, say yes to the redraw — and the redraw never answers. */
async function startHangingRebuild() {
  await startSimulatedWalk();
  await advance(2_000);
  fireEvent.click(screen.getByRole("button", { name: /Stray 80 m off route/ }));
  await flush();
  await advance(8_000);

  hangRebuilds = true;
  fireEvent.click(screen.getByRole("button", { name: "Redraw from here" }));
  await flush();
}

beforeEach(() => {
  vi.useFakeTimers();
  settingsStore = { "walk-settings": JSON.stringify({ deviationMode: "ask" }) };
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

const FAILED = /Couldn't build an updated route just now/;
const CANCELLED = "Kept your current route.";

describe("a mid-walk rebuild that never answers", () => {
  it("gives up after 45 s, keeps the old route and still offers End walk", async () => {
    await startHangingRebuild();
    expect(screen.getByText("Updating your route…")).toBeTruthy();

    await advance(44_000);
    expect(screen.queryByText(FAILED)).toBeNull();
    await advance(1_500);

    expect(screen.getByText(FAILED)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /End walk/i }).length).toBeGreaterThan(0);
    expect(screen.queryByText("Updating your route…")).toBeNull();
  });

  it("lets the walker keep the current route instead of waiting", async () => {
    await startHangingRebuild();

    fireEvent.click(
      screen.getByRole("button", { name: "Keep my current route" }),
    );
    await flush();

    expect(screen.getByText(CANCELLED)).toBeTruthy();
    expect(screen.queryByText(FAILED)).toBeNull();
    expect(screen.queryByText("Updating your route…")).toBeNull();
  });

  it("aborts the request when the walk is ended", async () => {
    await startHangingRebuild();
    expect(walkPlanSignals).toHaveLength(1);
    expect(walkPlanSignals[0].aborted).toBe(false);

    fireEvent.click(screen.getAllByRole("button", { name: /End walk/i })[0]);
    await flush();

    expect(walkPlanSignals[0].aborted).toBe(true);
  });
});
