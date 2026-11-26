import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { WalkStatsBar, type WalkStatsData } from "@/components/walk/WalkStatsBar";

const STATS: WalkStatsData = {
  kmh: 5.4,
  speedState: "moving",
  plannedPaceMinPerKm: 12,
  timeToFinishMin: 30,
  elapsedMin: 4,
  overBudget: false,
  distanceToFinishKm: 2.1,
  walkedM: 300,
  remainingM: 2100,
};
const speedCell = () => screen.getByTestId("walk-stats").querySelectorAll("p.text-\\[28px\\]")[2]!.textContent;

afterEach(cleanup);

describe("WalkStatsBar: low location accuracy", () => {
  it("shows the Hebrew chip and an ≈ on the speed while the accuracy is low", () => {
    render(<WalkStatsBar stats={{ ...STATS, lowAccuracy: true }} lang="he" />);
    expect(screen.getByText("דיוק מיקום נמוך — המיקום משוער")).toBeTruthy();
    expect(speedCell()).toMatch(/^≈5\.4/);
  });
  it("English copy", () => {
    render(<WalkStatsBar stats={{ ...STATS, lowAccuracy: true }} lang="en" />);
    expect(screen.getByText("Low location accuracy, position is approximate")).toBeTruthy();
  });
  it("an approximate (position-derived) speed gets the ≈ without the chip", () => {
    render(<WalkStatsBar stats={{ ...STATS, speedApprox: true }} lang="he" />);
    expect(screen.queryByText("דיוק מיקום נמוך — המיקום משוער")).toBeNull();
    expect(speedCell()).toMatch(/^≈5\.4/);
  });
  it("good accuracy: no chip, no ≈; a pause is never marked approximate", () => {
    render(<WalkStatsBar stats={STATS} lang="he" />);
    expect(screen.queryByText("דיוק מיקום נמוך — המיקום משוער")).toBeNull();
    expect(speedCell()).toMatch(/^5\.4/);
    cleanup();
    render(<WalkStatsBar stats={{ ...STATS, speedState: "paused", kmh: 0, lowAccuracy: true }} lang="he" />);
    expect(speedCell()).toBe("עצירה");
  });
});
