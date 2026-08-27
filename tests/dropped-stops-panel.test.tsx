import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DroppedStopsPanel } from "@/components/walk/DroppedStopsPanel";
import type { Attraction } from "@/lib/types";
import type { LostStop } from "@/lib/walk/planner-actions";

function attraction(id: string, name: string): Attraction {
  return {
    id,
    name,
    coordinates: { lat: 32.08, lng: 34.78 },
    category: "museum",
    avgVisitMinutes: 20,
    tags: {},
  };
}

const museum: LostStop = {
  attraction: attraction("a1", "City Museum"),
  reason: "nofit",
};
const cathedral: LostStop = {
  attraction: attraction("a2", "Old Cathedral"),
  reason: "behind",
};

afterEach(cleanup);

describe("DroppedStopsPanel", () => {
  it("renders nothing at all when the rebuild cost the walker nothing", () => {
    const { container } = render(
      <DroppedStopsPanel stops={[]} onRecall={vi.fn()} onDismiss={vi.fn()} />,
    );

    expect(container.textContent).toBe("");
  });

  it("names every stop that went, not just the last one", () => {
    render(
      <DroppedStopsPanel
        stops={[museum, cathedral]}
        onRecall={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText("City Museum")).toBeTruthy();
    expect(screen.getByText("Old Cathedral")).toBeTruthy();
  });

  // The two losses are not the same thing and must not read as one: a stop that
  // no longer fits costs time to get back, a stop behind the walker costs a turn.
  it("says a stop no longer fits the clock, separately from one left behind", () => {
    render(
      <DroppedStopsPanel
        stops={[museum, cathedral]}
        onRecall={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText(/Didn't fit the time you have left/)).toBeTruthy();
    expect(screen.getByText(/Behind you now/)).toBeTruthy();
  });

  it("asks for the tapped stop back, by id", () => {
    const onRecall = vi.fn();
    render(
      <DroppedStopsPanel
        stops={[museum, cathedral]}
        onRecall={onRecall}
        onDismiss={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText("Put Old Cathedral back in the walk"));

    expect(onRecall).toHaveBeenCalledWith("a2");
  });

  // Recall pins, and a pin is the one thing the planner refuses to drop, so it
  // can push the walk over budget. Said before the tap, not discovered after it.
  it("warns that putting a stop back can run the walk over time", () => {
    render(
      <DroppedStopsPanel stops={[museum]} onRecall={vi.fn()} onDismiss={vi.fn()} />,
    );

    expect(screen.getByText(/over your remaining time/)).toBeTruthy();
  });

  it("can be dismissed by a walker who is happy to lose the stop", () => {
    const onDismiss = vi.fn();
    render(
      <DroppedStopsPanel stops={[museum]} onRecall={vi.fn()} onDismiss={onDismiss} />,
    );

    fireEvent.click(screen.getByLabelText("Dismiss dropped stops"));

    expect(onDismiss).toHaveBeenCalled();
  });
});
