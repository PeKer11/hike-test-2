import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WalkHud } from "@/components/walk/WalkHud";

afterEach(cleanup);

const props = { alert: null, stats: null, onDetails: vi.fn(), onEndWalk: vi.fn() };

describe("walk sheet sharing chip", () => {
  it("is absent unless a position is really being shared", () => {
    render(<WalkHud {...props} />);
    expect(screen.queryByTestId("walk-sharing")).toBeNull();
  });

  it("shows who it is shared with and hides in one tap", () => {
    const onHide = vi.fn();
    render(<WalkHud {...props} sharing={{ label: "Sharing · friends", hideLabel: "Hide", onHide }} />);
    expect(screen.getByTestId("walk-sharing").textContent).toContain("Sharing · friends");
    fireEvent.click(screen.getByRole("button", { name: "Hide" }));
    expect(onHide).toHaveBeenCalledTimes(1);
  });
});
