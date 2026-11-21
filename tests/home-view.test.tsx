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
  it("offers the plan button in the hero and a way to the walks list", () => {
    const onNavigate = setup();
    fireEvent.click(screen.getByRole("button", { name: /Plan my walk/ }));
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
    // greeting + the walks bar (signed out: no walk to continue, no timeline, no context row)
    expect(document.querySelectorAll("h1, section").length).toBeLessThanOrEqual(4);
  });

  it("speaks Hebrew", () => {
    setup({ lang: "he" });
    expect(screen.getByRole("button", { name: /ההליכות שלי/ })).toBeTruthy();
  });
});
