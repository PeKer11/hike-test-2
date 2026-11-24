/**
 * Section 3 of docs/PHONE-FEEDBACK-BEAM-TRAIL-CRASH-PLAN-2026-11-24.md: the Walks tab during a live walk was blank,
 * and the undo bugs found on the same path. The walk is the real thing (a SimulatedWalkTracker feeding the real
 * planner); `fetch` and the heavy children are the fakes.
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
let assistantAnswer: { reply: string; actions: unknown[] };
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
  fireEvent.click(screen.getByLabelText(/Simulate this walk/));
  fireEvent.click(screen.getByRole("button", { name: "התחל הליכה" }));
  await flush();
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
  assistantAnswer = { reply: "ok", actions: [] };
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
  const add = (name: string, coordinates: { lat: number; lng: number }) => ({ kind: "add-place", name, coordinates });

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
    assistantAnswer = { reply: "Two places ahead.", actions: [add("Alush Garden", A), add("Haruv Garden", B)] };
    await say("anything nice ahead?");
    fireEvent.click(chatButton("לבצע הכול (2 הוספות, 0 דילוגים)"));
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
    assistantAnswer = { reply: "One more.", actions: [add("Corner Kiosk", C)] };
    await say("and a drink?");
    fireEvent.click(chatButton("להוסיף את Corner Kiosk"));
    await flush();
    expect(pinned()).toContain(idOf(C));
    expect(pinned()).not.toContain(idOf(A));
    expect(pinned()).not.toContain(idOf(B));
  });

  it("U4: says 'nothing fit' only when none of the added places made it onto the walk", async () => {
    await startSimulatedWalk();
    await advance(5_000);
    assistantAnswer = { reply: "Two places ahead.", actions: [add("Alush Garden", A), add("Haruv Garden", B)] };
    await say("anything nice ahead?");
    omitIds = [idOf(A)]; // the first did not fit, the second did
    fireEvent.click(chatButton("לבצע הכול (2 הוספות, 0 דילוגים)"));
    await flush();
    const text = screen.getByTestId("walk-notice").textContent ?? "";
    expect(text).not.toContain("לא נמצא מקום שנכנס");
    expect(text).toContain("Alush Garden, Haruv Garden");
  });

  it("U2: undo makes the stops it had dropped offerable again (no longer excluded from discovery)", async () => {
    await startSimulatedWalk();
    await advance(5_000);
    assistantAnswer = { reply: "Swap?", actions: [add("Alush Garden", A), { kind: "skip-stop", stopIndex: 0 }] };
    await say("swap the museum");
    fireEvent.click(chatButton(/^לבצע הכול/));
    await flush();
    expect(last().excludeIds as string[]).toContain("a1");
    fireEvent.click(within(screen.getByTestId("walk-notice")).getByRole("button", { name: "ביטול" }));
    await flush();
    await advance(3_000);
    assistantAnswer = { reply: "One more.", actions: [add("Corner Kiosk", C)] };
    await say("and a drink?");
    fireEvent.click(chatButton("להוסיף את Corner Kiosk"));
    await flush();
    expect((last().excludeIds as string[]) ?? []).not.toContain("a1");
  });

  it("U3: a change refused while an update is running marks nothing as dropped", async () => {
    await startSimulatedWalk();
    await advance(5_000);
    assistantAnswer = { reply: "Skip the museum?", actions: [{ kind: "skip-stop", stopIndex: 0 }] };
    await say("skip it");
    const skip = chatButton(/^לדלג על City Museum/);
    assistantAnswer = { reply: "A kiosk.", actions: [add("Corner Kiosk", C)] };
    await say("a drink?");
    let release!: () => void;
    holdPlan = new Promise<void>((r) => (release = r));
    fireEvent.click(chatButton("להוסיף את Corner Kiosk")); // a rebuild now running
    await flush();
    const before = walkPlanCalls.length;
    fireEvent.click(skip); // refused: "still updating"
    await flush();
    expect(walkPlanCalls).toHaveLength(before);
    holdPlan = null;
    release();
    await flush();
    await advance(3_000);
    assistantAnswer = { reply: "Another.", actions: [add("Haruv Garden", B)] };
    await say("one more?");
    fireEvent.click(chatButton("להוסיף את Haruv Garden"));
    await flush();
    expect((last().excludeIds as string[]) ?? []).not.toContain("a1");
  });
});
