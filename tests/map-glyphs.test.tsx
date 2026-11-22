import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MapGlyphs } from "@/components/map/MapGlyphs";

afterEach(cleanup);

describe("MapGlyphs", () => {
  it("shows three controls while following: re-centre, whole route, layers (in that order)", () => {
    render(<MapGlyphs showFollow following onFollow={vi.fn()} onFitRoute={vi.fn()} onLayers={vi.fn()} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual(["Re-centre on me", "Show whole route", "Map layers"]);
  });

  it("has no whole-route control unless it was given something to do", () => {
    render(<MapGlyphs showFollow following onFollow={vi.fn()} onLayers={vi.fn()} />);
    expect(screen.queryByLabelText("Show whole route")).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("calls the right handler for each button", () => {
    const onFollow = vi.fn();
    const onFitRoute = vi.fn();
    const onLayers = vi.fn();
    render(<MapGlyphs showFollow following onFollow={onFollow} onFitRoute={onFitRoute} onLayers={onLayers} />);
    fireEvent.click(screen.getByLabelText("Show whole route"));
    expect(onFitRoute).toHaveBeenCalledTimes(1);
    expect(onFollow).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("Re-centre on me"));
    fireEvent.click(screen.getByLabelText("Map layers"));
    expect(onFollow).toHaveBeenCalledTimes(1);
    expect(onLayers).toHaveBeenCalledTimes(1);
  });

  it("marks the whole-route control pressed only while that view is up", () => {
    const { rerender } = render(<MapGlyphs showFollow following onFollow={vi.fn()} onFitRoute={vi.fn()} fitting={false} />);
    expect(screen.getByLabelText("Show whole route").getAttribute("aria-pressed")).toBe("false");
    rerender(<MapGlyphs showFollow following={false} onFollow={vi.fn()} onFitRoute={vi.fn()} fitting />);
    expect(screen.getByLabelText("Show whole route").getAttribute("aria-pressed")).toBe("true");
    // ...and re-centre is then the one that is not pressed: the map is off the walker.
    expect(screen.getByLabelText("Re-centre on me").getAttribute("aria-pressed")).toBe("false");
  });

  it("draws re-centre as a navigation arrow, filled only while following; the other two are different drawings", () => {
    const { rerender } = render(<MapGlyphs showFollow following onFollow={vi.fn()} onFitRoute={vi.fn()} onLayers={vi.fn()} />);
    const arrow = () => screen.getByLabelText("Re-centre on me").querySelector("svg path")!;
    expect(arrow().getAttribute("fill")).toBe("currentColor");
    expect(screen.getByLabelText("Re-centre on me").querySelector("svg circle")).toBeNull(); // no crosshair
    const drawings = ["Re-centre on me", "Show whole route", "Map layers"].map((l) => screen.getByLabelText(l).querySelector("svg")!.innerHTML);
    expect(new Set(drawings).size).toBe(3);
    rerender(<MapGlyphs showFollow following={false} onFollow={vi.fn()} onFitRoute={vi.fn()} onLayers={vi.fn()} />);
    expect(arrow().getAttribute("fill")).toBe("none");
  });

  it("is 44 px and in the same column as the others", () => {
    render(<MapGlyphs showFollow following onFollow={vi.fn()} onFitRoute={vi.fn()} onLayers={vi.fn()} />);
    const fit = screen.getByLabelText("Show whole route");
    expect(fit.className).toContain("h-11");
    expect(fit.className).toContain("w-11");
    expect(fit.parentElement).toBe(screen.getByLabelText("Re-centre on me").parentElement);
  });

  it("speaks Hebrew on every control", () => {
    render(<MapGlyphs showFollow following onFollow={vi.fn()} onFitRoute={vi.fn()} onLayers={vi.fn()} lang="he" />);
    expect(screen.getByLabelText("הצגת כל המסלול")).toBeTruthy();
    expect(screen.getByLabelText("מרכזו אותי במפה")).toBeTruthy();
    expect(screen.getByLabelText("שכבות מפה")).toBeTruthy();
    expect(screen.queryByLabelText("Show whole route")).toBeNull();
  });

  it("sits at the end side of the map, so it mirrors in Hebrew", () => {
    const { container } = render(<MapGlyphs showFollow following onFollow={vi.fn()} onFitRoute={vi.fn()} />);
    const column = container.firstElementChild as HTMLElement;
    expect(column.className).toContain("end-3");
    expect(column.className).not.toMatch(/\b(left|right)-/);
  });
});
