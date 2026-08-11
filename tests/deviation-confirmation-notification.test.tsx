import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DeviationConfirmationNotification } from "@/components/walk/DeviationConfirmationNotification";
import { PaceConfirmationNotification } from "@/components/walk/PaceConfirmationNotification";

afterEach(cleanup);

describe("DeviationConfirmationNotification", () => {
  it("shows nothing when there is no question to ask", () => {
    const { container } = render(
      <DeviationConfirmationNotification
        visible={false}
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(container.innerHTML).toBe("");
  });

  it("asks about the actual situation — being off the route", () => {
    render(
      <DeviationConfirmationNotification
        visible
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText(/gone off the planned route/i)).toBeTruthy();
  });

  it("offers a redraw and a way to decline it", () => {
    const onConfirm = vi.fn();
    const onDismiss = vi.fn();
    render(
      <DeviationConfirmationNotification
        visible
        onConfirm={onConfirm}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /redraw from here/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: /i know where i'm going/i }),
    );
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("takes its own row, so it cannot land on top of the pace question", () => {
    // A walker can be off route and behind schedule at the same time, and two
    // banners sharing a row answer neither.
    const { container: deviation } = render(
      <DeviationConfirmationNotification
        visible
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    const { container: pace } = render(
      <PaceConfirmationNotification
        reason="sustained-slow-pace"
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    const rowOf = (container: HTMLElement) =>
      [...(container.firstElementChild?.classList ?? [])].find((c) =>
        c.startsWith("top-"),
      );

    expect(rowOf(deviation)).toBeTruthy();
    expect(rowOf(deviation)).not.toBe(rowOf(pace));
  });
});
