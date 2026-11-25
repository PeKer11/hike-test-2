/**
 * P18 / P19 of docs/PACE-AND-MIDWALK-REROUTE-REVIEW-2026-11-22.md: what the planner chat (Sol) changes in the middle
 * of a walk. The chat itself is stood in for by a component that hands the test its props; the walk is the real thing
 * (a SimulatedWalkTracker feeding the real planner), and `fetch` is the only fake.
 */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Attraction, Coordinates, WalkPlan, WalkSegment } from "@/lib/types";
import { DEFAULT_WALK_SETTINGS } from "@/lib/types/walk-settings";

vi.mock("@/components/map", () => ({ DynamicMap: () => <div data-testid="map" /> }));
// Signed out while the walk is planned from the form; signed in once it is under way (the chat only exists then).
let signedIn = false;
vi.mock("@/lib/hooks/useIsSignedIn", () => ({ useIsSignedIn: () => signedIn }));
// A signed-in screen has a sign-out button and links; there is no app router in a unit test.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

type ChatProps = {
  onBuild: (build: Record<string, unknown>) => Promise<boolean>;
  getCurrentWalk: () => { source: string; remainingMin?: number; pace?: { plannedMinPerKm: number } } | null;
};
let chat: ChatProps | null = null;
vi.mock("@/components/assistant/AssistantChat", () => ({
  AssistantChat: (props: ChatProps) => {
    chat = props;
    return null;
  },
}));

const { WalkPlannerApp } = await import("@/components/planner/WalkPlannerApp");

const ORIGIN: Coordinates = { lat: 32.08, lng: 34.78 };
const ROUTE: Coordinates[] = [ORIGIN, { lat: 32.116, lng: 34.78 }];
const stop = (id: string, name: string, lat: number): Attraction => ({
  id,
  name,
  coordinates: { lat, lng: 34.78 },
  category: "museum",
  avgVisitMinutes: 5,
  tags: {},
});
const STOPS = [stop("a1", "City Museum", 32.09), stop("a2", "Old Cathedral", 32.11)];
const segmentTo = (to: Attraction): WalkSegment => ({
  from: { name: "origin", coordinates: ORIGIN },
  to,
  distanceMeters: 900,
  walkingMinutes: 13,
});
const PLAN: WalkPlan = {
  orderedAttractions: STOPS,
  segments: STOPS.map(segmentTo),
  totalDistanceMeters: 4000,
  totalMinutes: 99,
  feasible: true,
  droppedAttractions: [],
  geometry: ROUTE,
};

type Body = Record<string, unknown>;
let walkPlanCalls: Body[];
/** What the walk chat's model answers (/api/walk-assistant). */
let assistantAnswer: { reply: string; proposal?: unknown };
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
  fireEvent.change(screen.getByPlaceholderText("Latitude"), { target: { value: String(ORIGIN.lat) } });
  fireEvent.change(screen.getByPlaceholderText("Longitude"), { target: { value: String(ORIGIN.lng) } });
  fireEvent.click(screen.getByRole("button", { name: "Build walking route" }));
  await flush();
  fireEvent.click(screen.getByLabelText(/Simulate this walk/));
  fireEvent.click(screen.getByRole("button", { name: "Start Walk" }));
  await flush();
  signedIn = true;
  await advance(2_000); // the next tick renders the signed-in screen, chat included
}

beforeEach(() => {
  vi.useFakeTimers();
  signedIn = false;
  chat = null;
  walkPlanCalls = [];
  assistantAnswer = { reply: "ok" };
  settingsStore = { "walk-settings": JSON.stringify({ ...DEFAULT_WALK_SETTINGS, deviationMode: "ask" }) };
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
    vi.fn(async (url: string, init?: RequestInit) => {
      if (typeof url === "string" && url.startsWith("/api/walk-plan")) {
        const body = JSON.parse(String(init?.body)) as Body;
        walkPlanCalls.push(body);
        // A rebuild that is handed its stops answers with them (the planner keeps what it is asked to keep).
        const kept = body.explicitAttractions as Attraction[] | undefined;
        return { ok: true, json: async () => (kept?.length ? { ...PLAN, orderedAttractions: kept, segments: kept.map(segmentTo) } : PLAN) };
      }
      if (url === "/api/walk-assistant") return { ok: true, status: 200, json: async () => assistantAnswer };
      if (url === "/api/nearby") return { ok: true, json: async () => ({ places: [] }) };
      return { ok: false, status: 404, json: async () => ({ error: "not stubbed here" }) };
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const build = (over: Record<string, unknown> = {}) => ({
  origin: ORIGIN,
  availableMinutes: 90,
  walkingPaceMinPerKm: 15,
  radiusMeters: 3000,
  stops: [STOPS[1]],
  ...over,
});

describe("the planner chat changing a live walk", () => {
  it("applies an end limit the walker stated (0 is back where I started), and a loop closes at the real start", async () => {
    await startSimulatedWalk();
    await advance(20_000);
    expect(chat).not.toBeNull();

    // The walk was built one-way (no end limit); now the walker says "end back where I started".
    expect(walkPlanCalls[0].maxEndDistanceFromOriginMeters).toBeUndefined();
    await act(async () => {
      await chat!.onBuild(build({ endExplicit: true, maxEndDistanceFromOriginMeters: 0 }));
    });
    const sol = walkPlanCalls[walkPlanCalls.length - 1];
    expect(sol.maxEndDistanceFromOriginMeters).toBe(0);
    expect(sol.returnTo).toEqual(ORIGIN);
    // The walker is some way up the route, so this really is a rebuild from where they are.
    expect(sol.lat as number).toBeGreaterThan(ORIGIN.lat);
  });

  it("does not apply an end limit that was only left in the chat's stored limits", async () => {
    await startSimulatedWalk();
    await advance(20_000);
    await act(async () => {
      await chat!.onBuild(build({ maxEndDistanceFromOriginMeters: 5000 }));
    });
    // A default left in the chat's gear-menu limits is not something the walker just said: the walk keeps its own.
    expect(walkPlanCalls[walkPlanCalls.length - 1].maxEndDistanceFromOriginMeters).toBeUndefined();
  });

  it("describes the walk with the time left on the fix clock (the simulator's 10x), not the wall clock", async () => {
    await startSimulatedWalk();
    await advance(36_000); // about six minutes of fixes
    const current = chat!.getCurrentWalk()!;
    expect(current.source).toBe("walking");
    // Budget 90 (the plan's 99 is longer): six minutes in, so about 84 left. The wall clock would have said 89.
    expect(current.remainingMin).toBeLessThan(87);
    expect(current.remainingMin).toBeGreaterThan(80);
  });
});

describe("P21: a place added from the walk chat stays pinned", () => {
  async function say(text: string) {
    const ask = screen.queryByRole("button", { name: "Ask" });
    if (ask) fireEvent.click(ask);
    const box = within(screen.getByTestId("walk-chat")).getByRole("textbox");
    fireEvent.change(box, { target: { value: text } });
    fireEvent.submit(box.closest("form")!);
    await flush();
    await advance(500);
  }

  it("the next rebuild still pins it (it used to be pinned for the build that added it only)", async () => {
    await startSimulatedWalk();
    await advance(5_000);
    const kiosk = { lat: 32.1, lng: 34.7805 };
    assistantAnswer = { reply: "", proposal: { adds: [{ name: "Corner Kiosk", coordinates: kiosk, distM: 300 }], skipStopIndexes: [], headBack: false } };
    await say("anything to drink ahead?");
    fireEvent.click(within(screen.getByTestId("walk-chat")).getByRole("button", { name: "Approve" }));
    await flush();
    const id = `chat-${Math.round(kiosk.lat * 1e5)}-${Math.round(kiosk.lng * 1e5)}`;
    const adding = walkPlanCalls[walkPlanCalls.length - 1];
    expect((adding.explicitAttractions as Attraction[]).map((a) => a.id)).toContain(id);

    // A later change of route, asked for separately: the kiosk is still one of the walker's pinned stops.
    assistantAnswer = { reply: "", proposal: { adds: [], skipStopIndexes: [0], headBack: false } };
    await advance(3_000); // the new leg's first fix: the chat has the walk in view again
    const callsBefore = walkPlanCalls.length;
    await say("is the first one worth it?");
    fireEvent.click(within(screen.getByTestId("walk-chat")).getByRole("button", { name: "Approve" }));
    await flush();
    expect(walkPlanCalls).toHaveLength(callsBefore + 1);
    const later = walkPlanCalls[walkPlanCalls.length - 1];
    expect((later.explicitAttractions as Attraction[]).map((a) => a.id)).not.toContain("a1"); // it is the skip
    expect(later.pinnedAttractionIds as string[]).toContain(id);
  });
});
