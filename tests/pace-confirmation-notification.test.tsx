import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PaceConfirmationNotification } from "@/components/walk/PaceConfirmationNotification";

afterEach(cleanup);

describe("PaceConfirmationNotification", () => {
  it("shows nothing when there is no question to ask", () => {
    const { container } = render(
      <PaceConfirmationNotification
        reason={null}
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(container.innerHTML).toBe("");
  });

  // The point of the slow-pace question: it asks what the walker intends,
  // rather than asking them to predict what a shortened route would feel like.
  it("asks a slow walker about their intent, not about the route", () => {
    render(
      <PaceConfirmationNotification
        reason="sustained-slow-pace"
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText(/do you plan to speed back up/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /i'll speed up/i })).toBeTruthy();
  });

  it("asks an ahead-of-plan walker whether to add a stop", () => {
    render(
      <PaceConfirmationNotification
        reason="sustained-fast-pace"
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText(/ahead of plan/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /add a stop/i })).toBeTruthy();
  });

  it("rebuilds only when the walker says so", () => {
    const onConfirm = vi.fn();
    const onDismiss = vi.fn();
    render(
      <PaceConfirmationNotification
        reason="sustained-slow-pace"
        onConfirm={onConfirm}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /i'll speed up/i }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: /adjust my route/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
