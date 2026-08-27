import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Toggle } from "@/components/ui/Toggle";

afterEach(cleanup);

// Wired into WalkSettingsPanel for the first time 2026-08-24 — until then this
// component existed with no caller and no test, which is exactly how the four
// raw checkboxes it replaced went unnoticed as an inconsistency for as long
// as they did.
describe("Toggle", () => {
  it("reports its state through aria-pressed, not through a checkbox", () => {
    render(<Toggle checked={true} onChange={vi.fn()} label="Example" />);

    const toggle = screen.getByLabelText("Example");
    expect(toggle.tagName).toBe("BUTTON");
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
  });

  it("reports off the same way", () => {
    render(<Toggle checked={false} onChange={vi.fn()} label="Example" />);

    expect(screen.getByLabelText("Example").getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  it("calls onChange with the flipped value, not the current one", () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} label="Example" />);

    fireEvent.click(screen.getByLabelText("Example"));

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("flips the other way from on", () => {
    const onChange = vi.fn();
    render(<Toggle checked={true} onChange={onChange} label="Example" />);

    fireEvent.click(screen.getByLabelText("Example"));

    expect(onChange).toHaveBeenCalledWith(false);
  });
});
