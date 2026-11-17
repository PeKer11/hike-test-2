import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HomeView } from "@/components/shell/HomeView";
import { PlannerBridge } from "@/lib/shell/planner-bridge";

afterEach(cleanup);

function setup(over: { greetingName?: string | null; lang?: "he" | "en" } = {}) {
  const onNavigate = vi.fn();
  render(
    <HomeView greetingName={over.greetingName ?? null} lang={over.lang ?? "en"} bridge={new PlannerBridge()} walkLive={false} signedIn={false} onNavigate={onNavigate} />,
  );
  return onNavigate;
}

describe("Home", () => {
  it("offers two big choices that navigate to plan and walks", () => {
    const onNavigate = setup();
    fireEvent.click(screen.getByRole("button", { name: /New route/ }));
    expect(onNavigate).toHaveBeenLastCalledWith("plan");
    fireEvent.click(screen.getByRole("button", { name: /My walks/ }));
    expect(onNavigate).toHaveBeenLastCalledWith("walks");
  });

  it("greets by name when there is one, and never shows an email", () => {
    setup({ greetingName: "Dana" });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Dana");
    cleanup();
    setup();
    expect(screen.getByRole("heading", { level: 1 }).textContent).not.toMatch(/@/);
  });

  it("has at most four blocks", () => {
    setup();
    // greeting + the choice grid (signed out: no walk to continue, no context card)
    expect(document.querySelectorAll("h1, section, [aria-label='New route']").length).toBeLessThanOrEqual(4);
  });

  it("speaks Hebrew", () => {
    setup({ lang: "he" });
    expect(screen.getByRole("button", { name: /ההליכות שלי/ })).toBeTruthy();
  });
});
