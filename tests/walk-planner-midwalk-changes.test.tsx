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

async function startSimulatedWalk(opts: { loop?: boolean; hebrew?: boolean } = {}) {
  render(<WalkPlannerApp />);
  await flush();
  if (opts.hebrew) {
    // The planner form's labels follow the app language; the simulator controls stay English.
    fireEvent.change(screen.getByPlaceholderText("קו רוחב"), { target: { value: String(ORIGIN.lat) } });
    fireEvent.change(screen.getByPlaceholderText("קו אורך"), { target: { value: String(ORIGIN.lng) } });
    fireEvent.click(screen.getByRole("button", { name: "בנה מסלול הליכה" }));
    await flush();
    fireEvent.click(screen.getByLabelText(/Simulate this walk/));
    fireEvent.click(screen.getByRole("button", { name: "התחל הליכה" }));
    await flush();
    return;
  }
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

/** The finish card's numbers: "N min" and "X.Y km". */
function finishCard() {
  const text = screen.getByText("You finished your walk!").closest("div")!.textContent ?? "";
  const minutes = Number(/(\d+) min/.exec(text)?.[1] ?? Number.NaN);
  const km = Number(/(\d+\.\d) km/.exec(text)?.[1] ?? Number.NaN);
  return { minutes, km };
}

async function addStopFromChat() {
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));
  const box = within(screen.getByTestId("walk-chat")).getByRole("textbox");
  fireEvent.change(box, { target: { value: "add a stop" } });
  fireEvent.submit(box.closest("form")!);
  await flush();
  fireEvent.click(screen.getByRole("button", { name: "Add a stop" }));
  await flush();
}

async function endWalk() {
  fireEvent.click(screen.getByRole("button", { name: "End walk" }));
  fireEvent.click(screen.getByRole("button", { name: "End walk?" }));
  await flush();
}

describe("P7: the walk's time and distance carry over a change of route", () => {
  it("the finish card counts the whole walk, not just the leg since the last change", async () => {
    // A walk that is only walked in one leg, for the yardstick.
    await startSimulatedWalk();
    await advance(60_000);
    await endWalk();
    const oneLeg = finishCard();
    cleanup();
    vi.unstubAllGlobals();
    installFetch();

    // The same minute of walking, then a change of route (a stop added from the chat), then the same minute again.
    await startSimulatedWalk();
    await advance(30_000);
    const callsBefore = walkPlanCalls.length;
    await addStopFromChat();
    expect(walkPlanCalls.length).toBe(callsBefore + 1);
    await advance(30_000);
    await endWalk();
    const twoLegs = finishCard();

    // 60 s of fixes at 10x is 10 minutes. The second leg alone would read about 5.
    expect(oneLeg.minutes).toBeGreaterThanOrEqual(9);
    expect(twoLegs.minutes).toBeGreaterThanOrEqual(oneLeg.minutes - 1);
    expect(twoLegs.minutes).toBeGreaterThan(oneLeg.minutes * 0.85);
    expect(twoLegs.km).toBeGreaterThan(oneLeg.km * 0.7);
  });
});

describe("P9: Back to previous route keeps the clock", () => {
  it("minutes already spent still count against the restored plan's budget", async () => {
    await startSimulatedWalk();
    await advance(5_000);
    await redrawFromHere(); // change 1
    await advance(30_000); // five more minutes of walking on the new route
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to previous plan" }));
    await flush();
    await advance(1_000);

    // Another change on the restored plan.
    const before = walkPlanCalls.length;
    await redrawFromHere();
    expect(walkPlanCalls.length).toBeGreaterThan(before);
    const body = walkPlanCalls[walkPlanCalls.length - 1];
    // The plan had 90 minutes; about 8 are gone (5 + 1.5 + the next stray), so about 80 are left. The old wall
    // clock gave nearly the full 90 back because it only saw the seconds, not the simulated minutes.
    expect(body.availableMinutes as number).toBeLessThan(86);
    expect(body.availableMinutes as number).toBeGreaterThan(70);
  });
});

describe("P19: the simulator's fast clock does not make a rebuild's budget too long", () => {
  it("six simulated minutes in, a redraw is given about six fewer minutes, not the whole budget back", async () => {
    await startSimulatedWalk();
    await advance(30_000); // 30 s of wall time is five minutes of fixes at 10x
    const before = walkPlanCalls.length;
    await redrawFromHere(); // 10 more seconds, so about 6.5 simulated minutes in
    expect(walkPlanCalls.length).toBe(before + 1);
    // The plan has 90 minutes. The wall clock saw only 40 seconds and would have said 89.3.
    expect(walkPlanCalls[walkPlanCalls.length - 1].availableMinutes as number).toBeLessThan(86);
    expect(walkPlanCalls[walkPlanCalls.length - 1].availableMinutes as number).toBeGreaterThan(78);
  });
});

describe("P4: discovery is told which places are already done", () => {
  it("a mid-walk rebuild sends the visited stops as excludeIds", async () => {
    await startSimulatedWalk();
    fireEvent.click(screen.getByRole("button", { name: "Fast pace" })); // 0.6x pace: the museum, 1.1 km up, is reached in about a minute
    await flush();
    for (let i = 0; i < 8; i += 1) await advance(10_000);

    const before = walkPlanCalls.length;
    await addStopFromChat();
    expect(walkPlanCalls.length).toBeGreaterThan(before);
    const body = walkPlanCalls[walkPlanCalls.length - 1];
    expect(body.excludeIds as string[]).toContain(MUSEUM.id);
    // Not the stops still ahead.
    expect(body.excludeIds as string[]).not.toContain(MARKET.id);
  });

  it("the very first build of a walk sends no exclusions", async () => {
    await startSimulatedWalk();
    expect(walkPlanCalls[0].excludeIds).toBeUndefined();
  });
});

describe("P13: the Hebrew app shows no English on the update and pace cards", () => {
  it("'Updating your route' and its keep button are Hebrew", async () => {
    settingsStore["walk-settings"] = JSON.stringify({ deviationMode: "ask", routeOrderMode: "reorder", uiLanguage: "he" });
    await startSimulatedWalk({ hebrew: true });
    await advance(2_000);
    fireEvent.click(screen.getByRole("button", { name: /Stray 80 m off route/ }));
    await flush();
    await advance(8_000);
    hangRebuilds = true;
    fireEvent.click(screen.getAllByRole("button").find((b) => /המסלול הכי טוב מכאן|Best route/.test(b.textContent ?? ""))!);
    await flush();

    expect(screen.getByText("מעדכנים את המסלול…")).toBeTruthy();
    expect(screen.getByRole("button", { name: "להישאר במסלול הנוכחי" })).toBeTruthy();
    expect(screen.queryByText("Updating your route…")).toBeNull();
    expect(screen.queryByRole("button", { name: "Keep my current route" })).toBeNull();
  });

  it("the older pace card is Hebrew too", async () => {
    settingsStore["walk-settings"] = JSON.stringify({ deviationMode: "ask", uiLanguage: "he" });
    await startSimulatedWalk({ hebrew: true });
    await advance(3_000);
    fireEvent.click(screen.getByRole("button", { name: "Fast pace" }));
    await flush();
    await advance(50_000);

    expect(screen.getByText("הקצב שלכם מעולה!")).toBeTruthy();
    expect(screen.getByRole("button", { name: "להאריך את ההליכה" })).toBeTruthy();
    expect(screen.queryByText("You're at a great pace!")).toBeNull();
  });
});

describe("P17: 'back to the route' typed in the chat gets the walker back onto the route", () => {
  it("offers Back to my route (not Head back), and tapping it does not ask for a way to the start", async () => {
    await startSimulatedWalk();
    await advance(2_000);
    fireEvent.click(screen.getByRole("button", { name: /Stray 80 m off route/ }));
    await flush();
    await advance(8_000);

    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    const box = within(screen.getByTestId("walk-chat")).getByRole("textbox");
    fireEvent.change(box, { target: { value: "go back to the route" } });
    fireEvent.submit(box.closest("form")!);
    await flush();

    const chat = within(screen.getByTestId("walk-chat"));
    expect(chat.queryByRole("button", { name: "Head back" })).toBeNull();
    const rejoin = chat.getByRole("button", { name: "Back to my route" });
    fireEvent.click(rejoin);
    await flush();
    await advance(1_000);

    const urls = vi.mocked(fetch).mock.calls.map(([url]) => String(url));
    // The way to the start is asked from /api/walk-options; getting back on the line never is.
    expect(urls.some((u) => u.startsWith("/api/walk-options"))).toBe(false);
  });
});

describe("P15: a pace rebuild says what it did", () => {
  async function slowWalkUntilCard() {
    await startSimulatedWalk();
    await advance(3_000);
    fireEvent.click(screen.getByRole("button", { name: "Slow pace" }));
    await flush();
    await advance(50_000);
  }

  it("'Show shorter route' that drops stops says how many, and how long is left", async () => {
    await slowWalkUntilCard();
    planAnswer = () => planOf([MUSEUM], { totalMinutes: 38 });
    fireEvent.click(screen.getByRole("button", { name: "Show shorter route" }));
    await flush();
    expect(screen.getByTestId("walk-notice").textContent).toBe("Shortened: 2 stops fewer · about 38 min left");
  });

  it("'Show shorter route' that comes back with the same stops says it could not shorten", async () => {
    await slowWalkUntilCard();
    fireEvent.click(screen.getByRole("button", { name: "Show shorter route" }));
    await flush();
    expect(screen.getByTestId("walk-notice").textContent).toContain("Couldn't shorten it further");
  });

  it("the Hebrew summary is Hebrew", async () => {
    settingsStore["walk-settings"] = JSON.stringify({ deviationMode: "ask", routeOrderMode: "reorder", uiLanguage: "he" });
    await startSimulatedWalk({ hebrew: true });
    await advance(3_000);
    fireEvent.click(screen.getByRole("button", { name: "Slow pace" }));
    await flush();
    await advance(50_000);
    planAnswer = () => planOf([MUSEUM, CATHEDRAL], { totalMinutes: 50 });
    fireEvent.click(screen.getByRole("button", { name: "להציג מסלול קצר יותר" }));
    await flush();
    expect(screen.getByTestId("walk-notice").textContent).toBe("קוצר: עצירה אחת פחות · נשארו כ-50 דק׳");
  });
});
