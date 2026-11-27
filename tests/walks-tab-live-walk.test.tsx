/**
 * Section 3 of docs/PHONE-FEEDBACK-BEAM-TRAIL-CRASH-PLAN-2026-11-24.md: the Walks tab during a live walk was blank,
 * and the undo bugs found on the same path. The walk is the real thing (a SimulatedWalkTracker feeding the real
 * planner); `fetch` and the heavy children are the fakes.
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

vi.mock("@/components/assistant/AssistantChat", () => ({ AssistantChat: () => null }));
type PanelProps = { onShowOnMap?: unknown; onOpenOnMap?: unknown; onWalkAgain?: (w: never) => void; onEditAsNew?: (w: never) => void; onNewRoute?: () => void };
let panelProps: PanelProps | null = null;
vi.mock("@/components/walks/MyWalksPanel", () => ({
  MyWalksPanel: (props: PanelProps) => {
    panelProps = props;
    return <div data-testid="my-walks" />;
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
/** While set, /api/walk-plan waits for it (a rebuild that is still running). */
let holdPlan: Promise<void> | null;
/** Ids the stubbed planner leaves out of its answer (a place that did not fit). */
let omitIds: string[];

async function flush() {
  await act(async () => {});
}
async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
  await flush();
}

let rerenderApp: (ui: React.ReactElement) => void;
const nav = vi.fn();

async function startSimulatedWalk() {
  const r = render(<WalkPlannerApp view="plan" onNavigate={nav} />);
  rerenderApp = r.rerender;
  await flush();
  fireEvent.change(screen.getByPlaceholderText("קו רוחב"), { target: { value: String(ORIGIN.lat) } });
  fireEvent.change(screen.getByPlaceholderText("קו אורך"), { target: { value: String(ORIGIN.lng) } });
  fireEvent.click(screen.getByRole("button", { name: "בנה מסלול הליכה" }));
  await flush();
  fireEvent.click(screen.getByLabelText(/Simulate this walk|הדמיית הליכה/));
  fireEvent.click(screen.getByRole("button", { name: "התחל הליכה" }));
  await flush();
  raiseSheet();
  signedIn = true;
  await advance(2_000);
  rerenderApp(<WalkPlannerApp view="walk" onNavigate={nav} />);
  await advance(500);
}

/** True when a bare `hidden` class token (not `@4xl:block`-style) is on the element or an ancestor: it is display:none on a phone. */
function hiddenOnPhone(el: Element | null): boolean {
  for (let n = el; n; n = n.parentElement) if ((n.getAttribute("class") ?? "").split(/\s+/).includes("hidden")) return true;
  return false;
}

beforeEach(() => {
  vi.useFakeTimers();
  signedIn = false;
  nav.mockClear();
  panelProps = null;
  walkPlanCalls = [];
  holdPlan = null;
  omitIds = [];
  assistantAnswer = { reply: "ok" };
  settingsStore = { "walk-settings": JSON.stringify({ ...DEFAULT_WALK_SETTINGS, deviationMode: "ask", uiLanguage: "he" }) };
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
        if (holdPlan) await holdPlan;
        // A rebuild that is handed its stops answers with them (the planner keeps what it is asked to keep).
        const kept = (body.explicitAttractions as Attraction[] | undefined)?.filter((a) => !omitIds.includes(a.id));
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


describe("the Walks tab during a live walk", () => {
  it("shows the walks list and 'חזרה להליכה' (phone width), and the button goes back to the walk", async () => {
    await startSimulatedWalk();
    rerenderApp(<WalkPlannerApp view="walks" onNavigate={nav} />);
    await advance(500);
    expect(screen.getByTestId("my-walks")).toBeTruthy();
    expect(hiddenOnPhone(screen.getByTestId("my-walks"))).toBe(false);
    const back = screen.getByRole("button", { name: "חזרה להליכה" });
    expect(hiddenOnPhone(back)).toBe(false);
    fireEvent.click(back);
    expect(nav).toHaveBeenCalledWith("walk");
  });

  it("the walk's own screen still shows the map after visiting Walks", async () => {
    await startSimulatedWalk();
    rerenderApp(<WalkPlannerApp view="walks" onNavigate={nav} />);
    await advance(500);
    rerenderApp(<WalkPlannerApp view="walk" onNavigate={nav} />);
    await advance(500);
    expect(hiddenOnPhone(screen.getByTestId("map"))).toBe(false);
    expect(screen.queryByTestId("my-walks")).toBeNull();
  });

  it("does not offer 'show on map' or a silent 'walk again' over a live walk (they would replace it)", async () => {
    await startSimulatedWalk();
    rerenderApp(<WalkPlannerApp view="walks" onNavigate={nav} />);
    await advance(500);
    expect(panelProps).not.toBeNull();
    expect(panelProps!.onShowOnMap).toBeUndefined();
    expect(panelProps!.onOpenOnMap).toBeUndefined();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    panelProps!.onWalkAgain!({ id: "w" } as never);
    expect(confirm).toHaveBeenCalledWith("לסיים את ההליכה הנוכחית ולהתחיל את זו?");
    expect(walkPlanCalls).toHaveLength(1); // declined: no new build
    confirm.mockRestore();
  });
});

describe("undo and refusals after 'לבצע הכול' (the owner's sequence)", () => {
  const A = { lat: 32.1, lng: 34.7805 };
  const B = { lat: 32.101, lng: 34.7806 };
  const C = { lat: 32.102, lng: 34.7807 };
  const idOf = (c: { lat: number; lng: number }) => `chat-${Math.round(c.lat * 1e5)}-${Math.round(c.lng * 1e5)}`;
  const add = (name: string, coordinates: { lat: number; lng: number }) => ({ name, coordinates, distM: 300 });
  /** What the assistant route answers when the model proposes one change. */
  const plan = (adds: unknown[], skipStopIndexes: number[] = []) => ({ reply: "", proposal: { adds, skipStopIndexes, headBack: false } });

  async function say(text: string) {
    const ask = screen.queryByRole("button", { name: /^(Ask|שאלו|לשאול)/ });
    if (ask) fireEvent.click(ask);
    const box = within(screen.getByTestId("walk-chat")).getByRole("textbox");
    fireEvent.change(box, { target: { value: text } });
    fireEvent.submit(box.closest("form")!);
    await flush();
    await advance(500);
  }
  const chatButton = (name: string | RegExp) => within(screen.getByTestId("walk-chat")).getByRole("button", { name });
  const last = () => walkPlanCalls[walkPlanCalls.length - 1];
  const pinned = () => last().pinnedAttractionIds as string[];

  async function applyAllTwoAdds() {
    await startSimulatedWalk();
    await advance(5_000);
    assistantAnswer = plan([add("Alush Garden", A), add("Haruv Garden", B)]);
    await say("anything nice ahead?");
    fireEvent.click(chatButton("אשר"));
    await flush();
    expect(screen.getByTestId("walk-notice").textContent).toContain("נוסף: Alush Garden, Haruv Garden");
  }

  it("U1: 'ביטול' unpins every added place, not only the first", async () => {
    await applyAllTwoAdds();
    expect((last().explicitAttractions as Attraction[]).map((a) => a.id)).toEqual(expect.arrayContaining([idOf(A), idOf(B)]));
    fireEvent.click(within(screen.getByTestId("walk-notice")).getByRole("button", { name: "ביטול" }));
    await flush();
    // The next rebuild (a third place, asked for separately) carries neither of the undone pins.
    await advance(3_000);
    assistantAnswer = plan([add("Corner Kiosk", C)]);
    await say("and a drink?");
    fireEvent.click(chatButton("אשר"));
    await flush();
    expect(pinned()).toContain(idOf(C));
    expect(pinned()).not.toContain(idOf(A));
    expect(pinned()).not.toContain(idOf(B));
  });

  it("U4: says 'nothing fit' only when none of the added places made it onto the walk", async () => {
    await startSimulatedWalk();
    await advance(5_000);
    assistantAnswer = plan([add("Alush Garden", A), add("Haruv Garden", B)]);
    await say("anything nice ahead?");
    omitIds = [idOf(A)]; // the first did not fit, the second did
    fireEvent.click(chatButton("אשר"));
    await flush();
    const text = screen.getByTestId("walk-notice").textContent ?? "";
    expect(text).not.toContain("לא נמצא מקום שנכנס");
    expect(text).toContain("Alush Garden, Haruv Garden");
  });

  it("U2: undo makes the stops it had dropped offerable again (no longer excluded from discovery)", async () => {
    await startSimulatedWalk();
    await advance(5_000);
    assistantAnswer = plan([add("Alush Garden", A)], [0]);
    await say("swap the museum");
    fireEvent.click(chatButton("אשר"));
    await flush();
    expect(last().excludeIds as string[]).toContain("a1");
    fireEvent.click(within(screen.getByTestId("walk-notice")).getByRole("button", { name: "ביטול" }));
    await flush();
    await advance(3_000);
    assistantAnswer = plan([add("Corner Kiosk", C)]);
    await say("and a drink?");
    fireEvent.click(chatButton("אשר"));
    await flush();
    expect((last().excludeIds as string[]) ?? []).not.toContain("a1");
  });

  it("U5: a second chat edit in the same walk can still be undone", async () => {
    await applyAllTwoAdds(); // the first edit starts the undo chain
    await advance(9_000); // its notice is gone
    assistantAnswer = plan([add("Corner Kiosk", C)]);
    await say("and a drink?");
    fireEvent.click(chatButton("אשר"));
    await flush();
    const notice = screen.getByTestId("walk-notice");
    expect(notice.textContent).toContain("Corner Kiosk");
    fireEvent.click(within(notice).getByRole("button", { name: "ביטול" }));
    await flush();
    expect(screen.queryByTestId("walk-notice")).toBeNull();
  });

  it("U6: a typed remove asks first; approving removes, names the stop, and can be undone", async () => {
    await startSimulatedWalk();
    await advance(5_000);
    assistantAnswer = plan([], [0]);
    await say("תוריד את המוזיאון");
    expect(screen.queryByTestId("walk-notice")).toBeNull(); // nothing changes until the card is approved
    fireEvent.click(chatButton("אשר"));
    await flush();
    const notice = screen.getByTestId("walk-notice");
    expect(notice.textContent).toContain("הוסר: City Museum");
    expect(last().excludeIds as string[]).toContain("a1");
    fireEvent.click(within(notice).getByRole("button", { name: "ביטול" }));
    await flush();
    expect(screen.queryByTestId("walk-notice")).toBeNull();
  });

  it("U3: a change refused while an update is running marks nothing as dropped", async () => {
    await startSimulatedWalk();
    await advance(5_000);
    assistantAnswer = plan([add("Corner Kiosk", C)]);
    await say("a drink?");
    let release!: () => void;
    holdPlan = new Promise<void>((r) => (release = r));
    fireEvent.click(chatButton("אשר")); // a rebuild now running
    await flush();
    // The approved card is refused while the update is still running.
    assistantAnswer = plan([], [0]);
    await say("תוריד את המוזיאון");
    const before = walkPlanCalls.length; // the card's own dry run is already in (held, like the rest)
    await say("כן"); // approves by typing: the card's button is still waiting for its numbers
    expect(walkPlanCalls).toHaveLength(before);
    expect(within(screen.getByTestId("walk-chat")).queryByText(/מטפלים בזה/)).toBeNull();
    expect(chatButton("אשר")).toBeTruthy(); // the card is still open: the tap was not lost
    holdPlan = null;
    release();
    await flush();
    await advance(3_000);
    assistantAnswer = plan([add("Haruv Garden", B)]);
    await say("one more?");
    fireEvent.click(chatButton("אשר"));
    await flush();
    expect((last().excludeIds as string[]) ?? []).not.toContain("a1");
  });
});

describe("the proposal card computes a real route before anything changes", () => {
  const A = { lat: 32.1, lng: 34.7805 };
  const idOf = (c: { lat: number; lng: number }) => `chat-${Math.round(c.lat * 1e5)}-${Math.round(c.lng * 1e5)}`;
  const plan = (adds: unknown[], skipStopIndexes: number[] = []) => ({ reply: "", proposal: { adds, skipStopIndexes, headBack: false } });
  const chatEl = () => screen.getByTestId("walk-chat");
  const chatButton = (name: string | RegExp) => within(chatEl()).getByRole("button", { name });
  const last = () => walkPlanCalls[walkPlanCalls.length - 1];

  async function say(text: string) {
    const ask = screen.queryByRole("button", { name: /^(Ask|שאלו|לשאול)/ });
    if (ask) fireEvent.click(ask);
    const box = within(screen.getByTestId("walk-chat")).getByRole("textbox");
    fireEvent.change(box, { target: { value: text } });
    fireEvent.submit(box.closest("form")!);
    await flush();
    await advance(500);
  }

  it("C1: asking sends a dry-run to /api/walk-plan with the kept stops plus the new one, changes nothing, and shows real numbers", async () => {
    await startSimulatedWalk();
    await advance(5_000);
    const before = walkPlanCalls.length;
    assistantAnswer = plan([{ name: "Alush Garden", coordinates: A, distM: 300 }]);
    await say("תוסיף משהו");
    expect(walkPlanCalls).toHaveLength(before + 1);
    const dry = last();
    expect((dry.explicitAttractions as Attraction[]).map((a) => a.id)).toContain(idOf(A));
    expect(dry.fixedOrder).toBeUndefined();
    expect(dry.returnTo).toBeDefined();
    expect(screen.queryByTestId("walk-notice")).toBeNull();
    const text = chatEl().textContent ?? "";
    expect(text).toMatch(/דק׳ · .*ק״מ · סיום \d\d:\d\d/);
    expect(text).not.toContain("~");
    expect((chatButton("אשר") as HTMLButtonElement).disabled).toBe(false);
  });

  it("C2: approving builds exactly what the card showed (fixed order, the previewed route) and the notice is from the real numbers", async () => {
    await startSimulatedWalk();
    await advance(5_000);
    assistantAnswer = plan([{ name: "Alush Garden", coordinates: A, distM: 300 }]);
    await say("תוסיף משהו");
    const dry = last();
    fireEvent.click(chatButton("אשר"));
    await flush();
    const built = last();
    expect(built).not.toBe(dry);
    expect(built.fixedOrder).toBe(true);
    expect(built.presetGeometry).toEqual(ROUTE);
    expect((built.explicitAttractions as Attraction[]).map((a) => a.id)).toEqual((dry.explicitAttractions as Attraction[]).map((a) => a.id));
    expect(screen.getByTestId("walk-notice").textContent).toContain("נוסף: Alush Garden");
    expect(within(chatEl()).getByText("✓ אושר")).toBeTruthy();
  });

  it("C3: 'לא' closes the card silently: no build, no notice", async () => {
    await startSimulatedWalk();
    await advance(5_000);
    assistantAnswer = plan([{ name: "Alush Garden", coordinates: A, distM: 300 }]);
    await say("תוסיף משהו");
    const calls = walkPlanCalls.length;
    fireEvent.click(chatButton("לא"));
    await flush();
    expect(walkPlanCalls).toHaveLength(calls);
    expect(screen.queryByTestId("walk-notice")).toBeNull();
    expect(within(chatEl()).getByText("בוטל")).toBeTruthy();
  });

  it("C4: with no answer from the planner for 6 s the card shows ~ numbers and can still be approved", async () => {
    await startSimulatedWalk();
    await advance(5_000);
    holdPlan = new Promise<void>(() => undefined);
    assistantAnswer = plan([{ name: "Alush Garden", coordinates: A, distM: 300 }]);
    await say("תוסיף משהו");
    expect(chatEl().textContent).toContain("מחשב מסלול");
    expect((chatButton("אשר") as HTMLButtonElement).disabled).toBe(true);
    await advance(6_100);
    expect(chatEl().textContent).toMatch(/~\+\d+ דק׳/);
    expect((chatButton("אשר") as HTMLButtonElement).disabled).toBe(false);
  });

  it("C5: when the planner can't place the new stop at all, the card says so and has no buttons", async () => {
    await startSimulatedWalk();
    await advance(5_000);
    omitIds = [idOf(A)];
    assistantAnswer = plan([{ name: "Alush Garden", coordinates: A, distM: 300 }]);
    await say("תוסיף משהו");
    expect(chatEl().textContent).toContain("Alush Garden לא נכנס בזמן שנשאר.");
    expect(within(chatEl()).queryByRole("button", { name: "אשר" })).toBeNull();
  });
});
