import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WalkHud } from "@/components/walk/WalkHud";
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

describe("the walk sheet", () => {
  it("steps peek, half, details with the handle", () => {
    const onDetails = vi.fn();
    render(<WalkHud alert={null} stats={stats} half={<p>half content</p>} onDetails={onDetails} onEndWalk={vi.fn()} />);
    expect(screen.queryByText("half content")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(screen.getByText("half content")).toBeTruthy();
    expect(onDetails).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(onDetails).toHaveBeenCalledTimes(1);
  });

  it("drags up to half and back down to peek", () => {
    render(<WalkHud alert={null} stats={stats} half={<p>half content</p>} onDetails={vi.fn()} onEndWalk={vi.fn()} />);
    const handle = screen.getByRole("button", { name: "Details" });
    fireEvent.pointerDown(handle, { clientY: 400 });
    fireEvent.pointerUp(handle, { clientY: 340 });
    fireEvent.click(handle); // the click that follows a drag is not a tap
    expect(screen.getByText("half content")).toBeTruthy();
    fireEvent.pointerDown(handle, { clientY: 340 });
    fireEvent.pointerUp(handle, { clientY: 400 });
    fireEvent.click(handle);
    expect(screen.queryByText("half content")).toBeNull();
  });

  it("needs a second tap within 5 s to end the walk", () => {
    const onEnd = vi.fn();
    render(<WalkHud alert={null} stats={stats} onDetails={vi.fn()} onEndWalk={onEnd} />);
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
