import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WalkHud } from "@/components/walk/WalkHud";
import type { WalkStatsData } from "@/components/walk/WalkStatsBar";

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

  it("needs a second tap within 3 s to end the walk", () => {
    const onEnd = vi.fn();
    render(<WalkHud alert={null} stats={stats} onDetails={vi.fn()} onEndWalk={onEnd} />);
    fireEvent.click(screen.getByRole("button", { name: "End walk" }));
    expect(onEnd).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "End walk?" })).toBeTruthy();
    act(() => void vi.advanceTimersByTime(3100));
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

  it("speaks Hebrew when asked", () => {
    render(<WalkHud alert={null} stats={stats} lang="he" nextStop={{ name: "שוק הכרמל", minutes: 4 }} onDetails={vi.fn()} onEndWalk={vi.fn()} />);
    expect(screen.getByRole("button", { name: "סיום" })).toBeTruthy();
    expect(screen.getByText(/התחנה הבאה/)).toBeTruthy();
  });
});
