import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AttractionDistancesPanel } from "@/components/walk/AttractionDistancesPanel";
import type { Attraction } from "@/lib/types";

function attraction(id: string): Attraction {
  return {
    id,
    name: `Stop ${id}`,
    coordinates: { lat: 32.08, lng: 34.78 },
    category: "landmark",
    avgVisitMinutes: 10,
    tags: {},
  };
}

const attractions = [attraction("a1"), attraction("a2"), attraction("a3")];
const distances = { a1: 0, a2: 200, a3: 900 };

function renderPanel(props: Partial<Parameters<typeof AttractionDistancesPanel>[0]> = {}) {
  return render(
    <AttractionDistancesPanel
      attractions={attractions}
      attractionDistances={distances}
      {...props}
    />,
  );
}

afterEach(cleanup);

describe("AttractionDistancesPanel progress", () => {
  it("counts stops already passed against the total", () => {
    renderPanel();

    expect(screen.getByText("1 of 3 stops")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("1");
    expect(screen.getByRole("progressbar").getAttribute("aria-valuemax")).toBe("3");
  });

  it("counts a skipped stop as done even though it still has distance left", () => {
    renderPanel({ visitedIds: ["a2"] });

    expect(screen.getByText("2 of 3 stops")).toBeTruthy();
    expect(screen.getByText("Stop a2").className).toContain("line-through");
  });
});

describe("AttractionDistancesPanel skip", () => {
  it("offers skip on the first stop still ahead, not on a passed one", () => {
    renderPanel({ onSkip: vi.fn() });

    expect(screen.queryByLabelText("Skip Stop a1")).toBeNull();
    expect(screen.getByLabelText("Skip Stop a2")).toBeTruthy();
    expect(screen.queryByLabelText("Stop a3")).toBeNull();
  });

  it("skips an unpinned stop on a single click", () => {
    const onSkip = vi.fn();
    renderPanel({ onSkip });

    fireEvent.click(screen.getByLabelText("Skip Stop a2"));

    expect(onSkip).toHaveBeenCalledWith("a2");
  });

  it("asks for a second click before skipping a pinned stop", () => {
    const onSkip = vi.fn();
    renderPanel({ onSkip, pinnedIds: ["a2"] });

    fireEvent.click(screen.getByLabelText("Skip Stop a2"));
    expect(onSkip).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText("Confirm skipping pinned Stop a2"));
    expect(onSkip).toHaveBeenCalledWith("a2");
  });

  it("moves the next marker to the following stop once one is skipped", () => {
    const { rerender } = renderPanel({ onSkip: vi.fn() });

    rerender(
      <AttractionDistancesPanel
        attractions={attractions}
        attractionDistances={distances}
        visitedIds={["a2"]}
        onSkip={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText("Skip Stop a2")).toBeNull();
    expect(screen.getByLabelText("Skip Stop a3")).toBeTruthy();
  });
});
