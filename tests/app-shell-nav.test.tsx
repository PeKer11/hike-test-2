import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MeView } from "@/components/shell/MeView";
import { TabBar } from "@/components/shell/TabBar";
import { PlannerBridge } from "@/lib/shell/planner-bridge";

vi.mock("@/components/auth/LogoutButton", () => ({ LogoutButton: () => <button type="button">Log out</button> }));
vi.mock("@/components/theme/ThemeToggle", () => ({ ThemeToggle: () => <div /> }));
vi.mock("@/components/WalkSettingsPanel", () => ({ WalkSettingsPanel: () => <div /> }));
vi.mock("@/components/StandingFactsPanel", () => ({ StandingFactsPanel: () => <div /> }));

afterEach(cleanup);

describe("tab bar", () => {
  it("has the five destinations, marks the current one, and shows the friend badge on Walks", () => {
    const onNavigate = vi.fn();
    render(<TabBar view="walks" lang="en" friendBadge={2} onNavigate={onNavigate} />);
    expect(screen.getAllByRole("button")).toHaveLength(5);
    expect(screen.getByRole("button", { name: /Walks/ }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("button", { name: /Home/ }).getAttribute("aria-current")).toBeNull();
    expect(screen.getByText("2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Plan" }));
    expect(onNavigate).toHaveBeenCalledWith("plan");
  });

  it("lights Walks for the Friends screen, and Walk opens the live walk only when one is running", () => {
    const onNavigate = vi.fn();
    const { rerender } = render(<TabBar view="social" lang="en" friendBadge={0} onNavigate={onNavigate} />);
    expect(screen.getByRole("button", { name: "Walks" }).getAttribute("aria-current")).toBe("page");
    fireEvent.click(screen.getByRole("button", { name: "Walk" }));
    expect(onNavigate).toHaveBeenLastCalledWith("plan");
    rerender(<TabBar view="home" lang="en" friendBadge={0} walkLive onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("button", { name: "Walk" }));
    expect(onNavigate).toHaveBeenLastCalledWith("walk");
  });

  it("puts a live dot on the Walk tab only while a walk is running", () => {
    const { rerender } = render(<TabBar view="home" lang="en" friendBadge={0} onNavigate={vi.fn()} />);
    expect(screen.queryByTestId("walk-live-dot")).toBeNull();
    rerender(<TabBar view="home" lang="en" friendBadge={0} walkLive onNavigate={vi.fn()} />);
    const dot = screen.getByTestId("walk-live-dot");
    expect(screen.getByRole("button", { name: "Walk" }).contains(dot)).toBe(true);
    expect(dot.getAttribute("aria-hidden")).toBe("true");
  });

  it("speaks Hebrew", () => {
    render(<TabBar view="home" lang="he" friendBadge={0} onNavigate={vi.fn()} />);
    expect(screen.getByRole("button", { name: "מסלולים" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "תכנון" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "פרופיל" })).toBeTruthy();
  });
});

describe("Me: refresh", () => {
  const reload = vi.fn();
  const setup = (walkLive: boolean) => {
    vi.stubGlobal("location", { ...window.location, reload });
    render(<MeView lang="en" settings={null} bridge={new PlannerBridge()} signedIn={false} walkLive={walkLive} />);
  };

  it("refreshes at once when no walk is live", () => {
    reload.mockClear();
    setup(false);
    fireEvent.click(screen.getByText("Refresh the app"));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("asks first when a walk is live, and Keep walking cancels", () => {
    reload.mockClear();
    setup(true);
    fireEvent.click(screen.getByText("Refresh the app"));
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByText("A walk is live. Refresh anyway?")).toBeTruthy();
    fireEvent.click(screen.getByText("Keep walking"));
    expect(screen.queryByText("A walk is live. Refresh anyway?")).toBeNull();
    fireEvent.click(screen.getByText("Refresh the app"));
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
