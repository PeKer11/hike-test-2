import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WalkChatBox } from "@/components/walk/WalkChatBox";
import { WalkHud } from "@/components/walk/WalkHud";
import type { WalkChat } from "@/lib/hooks/useWalkChat";
import { WalkStatsBar, type WalkStatsData } from "@/components/walk/WalkStatsBar";

const stats: WalkStatsData = {
  kmh: 4.6,
  speedState: "moving",
  plannedPaceMinPerKm: 13,
  timeToFinishMin: 117,
  elapsedMin: 30,
  overBudget: false,
  distanceToFinishKm: 3.8,
  walkedM: 1000,
  remainingM: 3800,
  allowedMin: 150,
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function chatWith(over: Partial<WalkChat> = {}): WalkChat {
  return { messages: [], pending: false, llmUsed: 0, send: vi.fn(), openTick: 0, openWith: vi.fn(), runAction: vi.fn(), decline: vi.fn(), reset: vi.fn(), ...over };
}
const withChat = (chat: WalkChat) => (
  <WalkHud
    alert={null}
    stats={stats}
    nextStop={{ name: "Bauhaus Center", minutes: 6 }}
    half={<p>half content</p>}
    openTick={chat.openTick}
    onDetails={vi.fn()}
    onEndWalk={vi.fn()}
    chat={(c) => <WalkChatBox chat={chat} lang="en" open={c.open} onOpenChange={c.setOpen} />}
  />
);
const sheetState = () => screen.getByTestId("walk-hud").getAttribute("data-sheet");
const handle = () => screen.getByRole("button", { name: "Expand or collapse" });
const drag = (el: Element, from: number, to: number) => {
  fireEvent.pointerDown(el, { clientY: from });
  fireEvent.pointerUp(el, { clientY: to });
};

// One owner holds the sheet's state, and the chat's open state is derived from it.
describe("the three sheet states", () => {
  it("opens the chat (full) from Ask, and the chevron goes back to half with the chat hidden", () => {
    render(withChat(chatWith()));
    fireEvent.click(handle());
    expect(sheetState()).toBe("half");
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(sheetState()).toBe("full");
    expect(screen.getByTestId("walk-chat")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Minimize" }));
    expect(sheetState()).toBe("half");
    expect(screen.queryByTestId("walk-chat")).toBeNull();
  });

  it("drags down one step at a time: full, half, peek", () => {
    render(withChat(chatWith()));
    fireEvent.click(handle());
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(sheetState()).toBe("full");
    drag(handle(), 300, 380);
    expect(sheetState()).toBe("half");
    expect(screen.queryByTestId("walk-chat")).toBeNull();
    drag(handle(), 300, 380);
    expect(sheetState()).toBe("peek");
  });

  it("drags up one step at a time: peek, half, full", () => {
    render(withChat(chatWith()));
    drag(handle(), 400, 330);
    expect(sheetState()).toBe("half");
    drag(handle(), 400, 330);
    expect(sheetState()).toBe("full");
    expect(screen.getByTestId("walk-chat")).toBeTruthy();
  });

  it("a tap on the handle toggles peek and half, and steps full back to half", () => {
    render(withChat(chatWith()));
    expect(sheetState()).toBe("peek");
    fireEvent.click(handle());
    expect(sheetState()).toBe("half");
    fireEvent.click(handle());
    expect(sheetState()).toBe("peek");
    fireEvent.click(handle());
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    fireEvent.click(handle());
    expect(sheetState()).toBe("half");
  });

  it("goes to full when the chat is opened from outside (openTick), even from peek", () => {
    const view = render(withChat(chatWith()));
    expect(sheetState()).toBe("peek");
    view.rerender(withChat(chatWith({ openTick: 1 })));
    expect(sheetState()).toBe("full");
    expect(screen.getByTestId("walk-chat")).toBeTruthy();
  });

  it("does not reopen the chat on its own when the sheet comes back up after an earlier open", () => {
    render(withChat(chatWith({ openTick: 1 })));
    expect(sheetState()).toBe("peek");
    fireEvent.click(handle());
    expect(sheetState()).toBe("half");
    expect(screen.queryByTestId("walk-chat")).toBeNull();
  });

  it("leaves the sheet at peek when an app message arrives", () => {
    const view = render(withChat(chatWith()));
    const messages = [{ id: 1, role: "app" as const, text: "Found a cafe", actions: [], used: false }];
    view.rerender(withChat(chatWith({ messages })));
    expect(sheetState()).toBe("peek");
    expect(screen.queryByTestId("walk-chat")).toBeNull();
  });

  it("drags from anywhere on the deck, not only the handle", () => {
    render(withChat(chatWith()));
    const deck = screen.getByTestId("walk-turn-deck");
    drag(deck, 400, 330);
    expect(sheetState()).toBe("half");
    drag(deck, 300, 380);
    expect(sheetState()).toBe("peek");
  });

  it("a cancelled touch drag leaves nothing behind: the next pointer up is not a drag", () => {
    render(withChat(chatWith()));
    const deck = screen.getByTestId("walk-turn-deck");
    fireEvent.pointerDown(deck, { clientY: 400 });
    fireEvent.pointerCancel(deck);
    fireEvent.pointerUp(deck, { clientY: 300 });
    expect(sheetState()).toBe("peek");
  });

  it("holds the pointer for the drag and does not let the browser scroll the header", () => {
    render(withChat(chatWith()));
    const header = screen.getByTestId("walk-sheet-header");
    expect(header.className.split(/\s+/)).toContain("touch-none");
    const capture = vi.fn();
    (header as unknown as { setPointerCapture: typeof capture }).setPointerCapture = capture;
    fireEvent.pointerDown(header, { clientY: 400, pointerId: 7 });
    expect(capture).toHaveBeenCalledWith(7);
  });

  it("peek shows the deck, the numbers and the credits only; Ask and End walk wait in half", () => {
    render(withChat(chatWith()));
    expect(sheetState()).toBe("peek");
    expect(screen.queryByRole("button", { name: "End walk" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ask" })).toBeNull();
    expect(screen.getByTestId("walk-turn-deck")).toBeTruthy();
    expect(screen.getByRole("progressbar")).toBeTruthy();
    expect(screen.getByTestId("map-credits")).toBeTruthy();
    fireEvent.click(handle());
    expect(screen.getByRole("button", { name: "End walk" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ask" })).toBeTruthy();
  });

  it("caps the sheet by state: half at 45%, peek and full at 62%", () => {
    render(withChat(chatWith()));
    const cap = () => screen.getByTestId("walk-hud").className.split(/\s+/).filter((c) => /^max-h-\[\d+%\]$/.test(c));
    expect(cap()).toEqual(["max-h-[62%]"]);
    fireEvent.click(handle());
    expect(cap()).toEqual(["max-h-[45%]"]);
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(cap()).toEqual(["max-h-[62%]"]);
  });

  it("opens Details from the Details button in half, not from another tap on the handle", () => {
    const onDetails = vi.fn();
    render(<WalkHud alert={null} stats={stats} half={<p>half content</p>} onDetails={onDetails} onEndWalk={vi.fn()} />);
    fireEvent.click(handle());
    expect(onDetails).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(onDetails).toHaveBeenCalledTimes(1);
  });
});

describe("the walk sheet", () => {
  it("shows the half content after one tap on the handle", () => {
    render(<WalkHud alert={null} stats={stats} half={<p>half content</p>} onDetails={vi.fn()} onEndWalk={vi.fn()} />);
    expect(screen.queryByText("half content")).toBeNull();
    fireEvent.click(handle());
    expect(screen.getByText("half content")).toBeTruthy();
  });

  it("keeps the handle and the deck in a header that never scrolls; only the body scrolls", () => {
    render(<WalkHud alert={null} stats={stats} nextStop={{ name: "Bauhaus Center", minutes: 6 }} half={<p>half content</p>} onDetails={vi.fn()} onEndWalk={vi.fn()} />);
    const header = screen.getByTestId("walk-sheet-header");
    const body = screen.getByTestId("walk-sheet-body");
    expect(header.contains(handle())).toBe(true);
    expect(header.contains(screen.getByTestId("walk-turn-deck"))).toBe(true);
    expect(header.className.split(/\s+/)).toContain("flex-none");
    expect(header.closest(".overflow-y-auto")).toBeNull();
    expect(body.className.split(/\s+/)).toEqual(expect.arrayContaining(["min-h-0", "flex-1", "overflow-y-auto"]));
    expect(screen.getByTestId("walk-hud").className.split(/\s+/)).not.toContain("overflow-y-auto");
  });

  it("drags up to half and back down to peek", () => {
    render(<WalkHud alert={null} stats={stats} half={<p>half content</p>} onDetails={vi.fn()} onEndWalk={vi.fn()} />);
    drag(handle(), 400, 340);
    fireEvent.click(handle()); // the click that follows a drag is not a tap
    expect(screen.getByText("half content")).toBeTruthy();
    drag(handle(), 340, 400);
    fireEvent.click(handle());
    expect(screen.queryByText("half content")).toBeNull();
  });

  it("needs a second tap within 5 s to end the walk", () => {
    const onEnd = vi.fn();
    render(<WalkHud alert={null} stats={stats} onDetails={vi.fn()} onEndWalk={onEnd} />);
    fireEvent.click(screen.getByRole("button", { name: "Expand or collapse" }));
    fireEvent.click(screen.getByRole("button", { name: "End walk" }));
    expect(onEnd).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "End walk?" })).toBeTruthy();
    act(() => void vi.advanceTimersByTime(5100));
    expect(screen.getByRole("button", { name: "End walk" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "End walk" }));
    fireEvent.click(screen.getByRole("button", { name: "End walk?" }));
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("shows the next stop, three numbers, ONE progress bar, and the over-plan line only when over", () => {
    const { rerender } = render(
      <WalkHud alert={null} stats={stats} nextStop={{ name: "Bauhaus Center", minutes: 6 }} onDetails={vi.fn()} onEndWalk={vi.fn()} />,
    );
    expect(screen.getByTestId("walk-next-stop").textContent).toContain("Bauhaus Center");
    expect(screen.getAllByRole("progressbar")).toHaveLength(1);
    expect(screen.queryByText(/over plan/)).toBeNull();
    rerender(<WalkHud alert={null} stats={{ ...stats, overBudget: true, timeToFinishMin: 140 }} onDetails={vi.fn()} onEndWalk={vi.fn()} />);
    expect(screen.getByText("+20 min over plan")).toBeTruthy();
  });

  it("puts the minutes to the next stop and its arrival time on the sunset deck", () => {
    vi.setSystemTime(new Date(2026, 10, 21, 18, 30, 0));
    render(<WalkHud alert={null} stats={stats} nextStop={{ name: "Carmel Market", minutes: 6 }} onDetails={vi.fn()} onEndWalk={vi.fn()} />);
    const deck = screen.getByTestId("walk-turn-deck");
    expect(deck.textContent).toContain("6");
    expect(deck.textContent).toContain("min");
    expect(deck.textContent).toContain("Carmel Market");
    expect(deck.textContent).toContain("18:36");
  });

  it("keeps a deck without the big number when the distance to the next stop is not known", () => {
    render(<WalkHud alert={null} stats={stats} nextStop={{ name: "Carmel Market", minutes: null }} onDetails={vi.fn()} onEndWalk={vi.fn()} />);
    expect(screen.getByTestId("walk-next-stop").textContent).toContain("Carmel Market");
    expect(screen.getByTestId("walk-turn-deck").textContent).not.toMatch(/\d\d:\d\d/);
  });

  it("floats the Traike mark and the stop chip over the map, with the finish time", () => {
    vi.setSystemTime(new Date(2026, 10, 21, 18, 0, 0));
    render(<WalkHud alert={null} stats={{ ...stats, timeToFinishMin: 80 }} stopProgress={{ index: 2, total: 4 }} onDetails={vi.fn()} onEndWalk={vi.fn()} />);
    expect(screen.getByText("Traike")).toBeTruthy();
    expect(screen.getByTestId("walk-stop-chip").textContent).toBe("Stop 2 of 4 · 19:20");
  });

  it("draws the Traike mark as a logo, not a control: no button, no hit area, one drawing", () => {
    render(<WalkHud alert={null} stats={stats} onDetails={vi.fn()} onEndWalk={vi.fn()} />);
    const logo = screen.getByTestId("walk-logo");
    expect(logo.textContent).toBe("Traike");
    expect(logo.className).toContain("pointer-events-none");
    expect(logo.className).not.toContain("tk-paper-tag");
    expect(logo.closest("button, a")).toBeNull();
    // The same app-icon art as every header (next/image serves it as /_next/image?url=%2Ftraike-icon.png).
    expect(decodeURIComponent(logo.querySelector("img")!.getAttribute("src") ?? "")).toContain("/traike-icon.png");
  });

  it("leads End walk with the stop square", () => {
    render(<WalkHud alert={null} stats={stats} onDetails={vi.fn()} onEndWalk={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Expand or collapse" }));
    expect(screen.getByRole("button", { name: "End walk" }).querySelector("svg rect")).not.toBeNull();
  });

  it("speaks the stop chip in Hebrew and hides it when there are no stops", () => {
    const { rerender } = render(<WalkHud alert={null} stats={stats} lang="he" stopProgress={{ index: 1, total: 3 }} onDetails={vi.fn()} onEndWalk={vi.fn()} />);
    expect(screen.getByTestId("walk-stop-chip").textContent).toContain("תחנה 1 מתוך 3");
    rerender(<WalkHud alert={null} stats={stats} lang="he" stopProgress={null} onDetails={vi.fn()} onEndWalk={vi.fn()} />);
    expect(screen.queryByTestId("walk-stop-chip")).toBeNull();
  });

  it("speaks Hebrew when asked", () => {
    render(<WalkHud alert={null} stats={stats} lang="he" nextStop={{ name: "שוק הכרמל", minutes: 4 }} onDetails={vi.fn()} onEndWalk={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "הרחבה או כיווץ" }));
    expect(screen.getByRole("button", { name: "סיום הליכה" })).toBeTruthy();
    expect(screen.getByText(/התחנה הבאה/)).toBeTruthy();
  });
});

// Tablet and desktop (feedback round 2026-11-22, item 8): from md the sheet floats over the map instead of owning its bottom edge.
describe("the walk sheet on a tablet and a desktop", () => {
  const original = window.matchMedia;
  // jsdom has no layout: give the sheet a size so "ends above the sheet" is a number to compare.
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(300);
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(400);
  });
  afterEach(() => {
    window.matchMedia = original;
    vi.restoreAllMocks();
  });

  /** A matchMedia that says yes to every `(min-width: N px)` query up to `width`. */
  function viewport(width: number) {
    window.matchMedia = ((query: string) => {
      const min = Number(/min-width:\s*(\d+)px/.exec(query)?.[1] ?? Infinity);
      return { matches: width >= min, media: query, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false, onchange: null } as unknown as MediaQueryList;
    }) as typeof window.matchMedia;
  }
  const hudHost = () => screen.getByTestId("walk-hud").parentElement!.parentElement as HTMLElement;

  it("keeps the phone bottom sheet classes and adds the floating ones behind md and lg", () => {
    render(<WalkHud alert={null} stats={stats} onDetails={vi.fn()} onEndWalk={vi.fn()} />);
    const cls = screen.getByTestId("walk-hud").className;
    // The phone sheet is still edge to edge at the bottom.
    for (const c of ["inset-x-0", "bottom-0", "rounded-t-[6px]", "border-t-[1.5px]"]) expect(cls.split(/\s+/)).toContain(c);
    // Tablet: centred, 560px. Desktop: a 400px panel at the start side. Both leave the map's own bottom strip free.
    for (const c of ["md:w-[560px]", "md:mx-auto", "md:bottom-8", "lg:start-4", "lg:w-[400px]"]) expect(cls.split(/\s+/)).toContain(c);
  });

  it("a phone: the map ends above the sheet", () => {
    viewport(390);
    render(<WalkHud alert={null} stats={stats} onDetails={vi.fn()} onEndWalk={vi.fn()} />);
    expect(hudHost().style.getPropertyValue("--hud-h")).toBe("300px");
    expect(hudHost().style.getPropertyValue("--hud-o")).toBe("");
    expect(hudHost().style.getPropertyValue("--hud-w")).toBe("");
  });

  it("a tablet: the map keeps its whole height and the off-route card clears the sheet from above", () => {
    viewport(768);
    render(<WalkHud alert={null} stats={stats} onDetails={vi.fn()} onEndWalk={vi.fn()} />);
    expect(hudHost().style.getPropertyValue("--hud-h")).toBe("0px");
    expect(hudHost().style.getPropertyValue("--hud-o")).toBe("340px");
    expect(hudHost().style.getPropertyValue("--hud-w")).toBe("");
  });

  it("a desktop: the map keeps its whole height and the off-route card clears the panel from the side", () => {
    viewport(1280);
    render(<WalkHud alert={null} stats={stats} onDetails={vi.fn()} onEndWalk={vi.fn()} />);
    expect(hudHost().style.getPropertyValue("--hud-h")).toBe("0px");
    expect(hudHost().style.getPropertyValue("--hud-o")).toBe("0px");
    expect(hudHost().style.getPropertyValue("--hud-w")).toBe("432px");
  });
});

describe("the speed dot", () => {
  const dot = (c: HTMLElement) => c.querySelector("span[aria-hidden].rounded-full");
  it("is grey, not red, when the walker has stopped", () => {
    const { container } = render(<WalkStatsBar stats={{ ...stats, speedState: "paused", kmh: 0 }} lang="en" />);
    expect(dot(container)).not.toBeNull();
    expect(dot(container)!.className).not.toContain("bg-terra");
    expect(dot(container)!.className).toContain("bg-charcoal/30");
  });
  it("is still red when walking far slower than the plan", () => {
    const { container } = render(<WalkStatsBar stats={{ ...stats, speedState: "moving", kmh: 2, plannedPaceMinPerKm: 12 }} lang="en" />);
    expect(dot(container)!.className).toContain("bg-terra");
  });
});

describe("a direction offer", () => {
  it("steps a half sheet down to peek so the whole card is on screen", () => {
    const view = render(<WalkHud alert={null} stats={stats} half={<p>half content</p>} onDetails={vi.fn()} onEndWalk={vi.fn()} />);
    fireEvent.click(handle());
    expect(sheetState()).toBe("half");
    view.rerender(<WalkHud alert={null} stats={stats} half={<p>half content</p>} sheet={<p>pick a direction</p>} onDetails={vi.fn()} onEndWalk={vi.fn()} />);
    expect(sheetState()).toBe("peek");
    expect(screen.getByText("pick a direction")).toBeTruthy();
  });

  it("does the same when the off-route card goes up over the map", () => {
    const view = render(<WalkHud alert={null} stats={stats} onDetails={vi.fn()} onEndWalk={vi.fn()} />);
    fireEvent.click(handle());
    expect(sheetState()).toBe("half");
    view.rerender(<WalkHud alert={null} stats={stats} center={<p>off route</p>} onDetails={vi.fn()} onEndWalk={vi.fn()} />);
    expect(sheetState()).toBe("peek");
  });
});
