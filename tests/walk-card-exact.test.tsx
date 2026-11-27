/**
 * The approved card is exactly what is built: the places it lists, the stops it skips, nothing else. The walk is the
 * real planner (a simulated walk); `fetch` is the only fake, and its dry run is made to misbehave.
 */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Attraction, Coordinates, WalkPlan, WalkSegment } from "@/lib/types";
import { DEFAULT_WALK_SETTINGS } from "@/lib/types/walk-settings";

/** A walk starts at peek (deck, numbers, credits); Ask and End walk wait in half. Tests that use them raise the sheet first. */
function raiseSheet() {
  if (screen.getByTestId("walk-hud").getAttribute("data-sheet") === "peek") fireEvent.click(screen.getByRole("button", { name: /^(Expand or collapse|הרחבה או כיווץ)$/ }));
}

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
/** What the planner answers with, given the stops it was handed; null = the stops as handed. */
let dryRun: ((kept: Attraction[]) => Attraction[]) | null;

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
  fireEvent.click(screen.getByLabelText(/Simulate this walk|הדמיית הליכה/));
  fireEvent.click(screen.getByRole("button", { name: "Start Walk" }));
  await flush();
  raiseSheet();
  signedIn = true;
  await advance(2_000); // the next tick renders the signed-in screen, chat included
}

beforeEach(() => {
  vi.useFakeTimers();
  signedIn = false;
  chat = null;
  dryRun = null;
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
        const kept = (body.explicitAttractions as Attraction[] | undefined) ?? STOPS;
        const plan = dryRun ? dryRun(kept) : kept;
        return { ok: true, json: async () => ({ ...PLAN, orderedAttractions: plan, segments: plan.map(segmentTo) }) };
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


async function say(text: string) {
  const ask = screen.queryByRole("button", { name: "Ask" });
  if (ask) fireEvent.click(ask);
  const box = within(screen.getByTestId("walk-chat")).getByRole("textbox");
  fireEvent.change(box, { target: { value: text } });
  fireEvent.submit(box.closest("form")!);
  await flush();
  await advance(500);
}
const KIOSK = { lat: 32.1, lng: 34.7805 };
const CAFE = { lat: 32.1005, lng: 34.7807 };
const idOf = (c: { lat: number; lng: number }) => `chat-${Math.round(c.lat * 1e5)}-${Math.round(c.lng * 1e5)}`;

describe("the card is exactly what is built", () => {
  it("a dry run with an extra stop: approve builds without it", async () => {
    await startSimulatedWalk();
    await advance(5_000);
    const extra = stop("extra", "Surprise Fountain", 32.105);
    dryRun = (kept) => [...kept, extra];
    assistantAnswer = { reply: "", proposal: { adds: [{ name: "Corner Kiosk", coordinates: KIOSK, distM: 300 }], skipStopIndexes: [], headBack: false } };
    await say("add a kiosk");
    const box = screen.getByTestId("walk-chat");
    expect(within(box).getByText(/Corner Kiosk/)).toBeTruthy();
    expect(within(box).queryByText(/Surprise Fountain/)).toBeNull();
    fireEvent.click(within(box).getByRole("button", { name: "Approve" }));
    await flush();
    const ids = (walkPlanCalls[walkPlanCalls.length - 1].explicitAttractions as Attraction[]).map((a) => a.id);
    expect(ids).toContain(idOf(KIOSK));
    expect(ids).not.toContain("extra");
  });

  it("two adds with one placed: the card lists one and says the other does not fit; approve adds one", async () => {
    await startSimulatedWalk();
    await advance(5_000);
    dryRun = (kept) => kept.filter((a) => a.id !== idOf(CAFE));
    assistantAnswer = {
      reply: "",
      proposal: { adds: [{ name: "Corner Kiosk", coordinates: KIOSK, distM: 300 }, { name: "Quiet Cafe", coordinates: CAFE, distM: 350 }], skipStopIndexes: [], headBack: false },
    };
    await say("add two places");
    const box = screen.getByTestId("walk-chat");
    expect(within(box).getByText(/Corner Kiosk/)).toBeTruthy();
    expect(within(box).queryByText(/\+ Quiet Cafe/)).toBeNull();
    expect(within(box).getByText(/Quiet Cafe doesn't fit/)).toBeTruthy();
    fireEvent.click(within(box).getByRole("button", { name: "Approve" }));
    await flush();
    const ids = (walkPlanCalls[walkPlanCalls.length - 1].explicitAttractions as Attraction[]).map((a) => a.id);
    expect(ids).toContain(idOf(KIOSK));
    expect(ids).not.toContain(idOf(CAFE));
  });

  it("a place within 40 m of a stop on the walk is that stop: the card says so and offers no approve", async () => {
    await startSimulatedWalk();
    await advance(5_000);
    const nearCathedral = { lat: 32.11 + 15 / 111_320, lng: 34.78 };
    assistantAnswer = { reply: "", proposal: { adds: [{ name: "Cathedral Plaza", coordinates: nearCathedral, distM: 900 }], skipStopIndexes: [], headBack: false } };
    await say("add the plaza");
    const box = screen.getByTestId("walk-chat");
    expect(within(box).getByText(/Cathedral Plaza is already on the walk/)).toBeTruthy();
    expect(within(box).queryByRole("button", { name: "Approve" })).toBeNull();
  });

  it("a place 80 m from every stop is still a new stop", async () => {
    await startSimulatedWalk();
    await advance(5_000);
    assistantAnswer = { reply: "", proposal: { adds: [{ name: "Corner Kiosk", coordinates: KIOSK, distM: 300 }], skipStopIndexes: [], headBack: false } };
    await say("add a kiosk");
    expect(within(screen.getByTestId("walk-chat")).getByRole("button", { name: "Approve" })).toBeTruthy();
  });
});
