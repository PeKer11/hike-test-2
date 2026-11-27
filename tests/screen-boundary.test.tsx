/**
 * Section 3 / C4-C5 of docs/PHONE-FEEDBACK-BEAM-TRAIL-CRASH-PLAN-2026-11-24.md: a screen that throws shows a
 * fallback instead of a blank frame, and a panel that throws does not take the live walk down with it.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ScreenBoundary } from "@/components/ui/ScreenBoundary";
import { DEFAULT_WALK_SETTINGS } from "@/lib/types/walk-settings";

vi.mock("@/components/map", () => ({ DynamicMap: () => <div data-testid="map" /> }));
let signedIn = false;
vi.mock("@/lib/hooks/useIsSignedIn", () => ({ useIsSignedIn: () => signedIn }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/assistant/AssistantChat", () => ({ AssistantChat: () => null }));
let panelThrows = true;
vi.mock("@/components/walks/MyWalksPanel", () => ({
  MyWalksPanel: () => {
    if (panelThrows) throw new Error("walks panel exploded");
    return <div data-testid="my-walks" />;
  },
}));

const { WalkPlannerApp } = await import("@/components/planner/WalkPlannerApp");

let shouldThrow = true;
function Bomb() {
  if (shouldThrow) throw new Error("boom");
  return <p>fine now</p>;
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  shouldThrow = true;
  panelThrows = true;
  signedIn = false;
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ScreenBoundary", () => {
  it("a child that throws shows 'משהו השתבש במסך הזה' and 'נסו שוב' re-mounts it", () => {
    render(
      <ScreenBoundary name="test" lang="he">
        <Bomb />
      </ScreenBoundary>,
    );
    expect(screen.getByText("משהו השתבש במסך הזה")).toBeTruthy();
    expect(screen.getByText("אפשר לנסות שוב.")).toBeTruthy();
    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: "נסו שוב" }));
    expect(screen.getByText("fine now")).toBeTruthy();
    expect(screen.queryByText("משהו השתבש במסך הזה")).toBeNull();
  });

  it("says the walk continues, and offers a way back to it, while a walk is live", () => {
    const back = vi.fn();
    render(
      <ScreenBoundary name="test" lang="he" walkLive onBack={back}>
        <Bomb />
      </ScreenBoundary>,
    );
    expect(screen.getByText("ההליכה שלך ממשיכה ונשמרת.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "חזרה להליכה" }));
    expect(back).toHaveBeenCalled();
  });

  it("has English copy", () => {
    render(
      <ScreenBoundary name="test" lang="en">
        <Bomb />
      </ScreenBoundary>,
    );
    expect(screen.getByText("Something went wrong on this screen")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });
});

describe("a throwing walks panel during a live walk", () => {
  it("leaves the walk running: the fallback shows, the walk screen still has its HUD", async () => {
    vi.useFakeTimers();
    const store: Record<string, string> = { "walk-settings": JSON.stringify({ ...DEFAULT_WALK_SETTINGS, uiLanguage: "he" }) };
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => void (store[k] = v), removeItem: (k: string) => void delete store[k], clear: () => {} },
    });
    const ORIGIN = { lat: 32.08, lng: 34.78 };
    const stopA = { id: "a1", name: "City Museum", coordinates: { lat: 32.09, lng: 34.78 }, category: "museum", avgVisitMinutes: 5, tags: {} };
    const plan = {
      orderedAttractions: [stopA],
      segments: [{ from: { name: "origin", coordinates: ORIGIN }, to: stopA, distanceMeters: 900, walkingMinutes: 13 }],
      totalDistanceMeters: 1000,
      totalMinutes: 30,
      feasible: true,
      droppedAttractions: [],
      geometry: [ORIGIN, { lat: 32.1, lng: 34.78 }],
    };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (url.startsWith("/api/walk-plan") ? { ok: true, json: async () => plan } : { ok: false, status: 404, json: async () => ({}) })));
    const nav = vi.fn();
    const r = render(<WalkPlannerApp view="plan" onNavigate={nav} />);
    await act(async () => {});
    fireEvent.change(screen.getByPlaceholderText("קו רוחב"), { target: { value: String(ORIGIN.lat) } });
    fireEvent.change(screen.getByPlaceholderText("קו אורך"), { target: { value: String(ORIGIN.lng) } });
    fireEvent.click(screen.getByRole("button", { name: "בנה מסלול הליכה" }));
    await act(async () => {});
    fireEvent.click(screen.getByLabelText(/Simulate this walk|הדמיית הליכה/));
    fireEvent.click(screen.getByRole("button", { name: "התחל הליכה" }));
    await act(async () => {});
    signedIn = true;
    await act(async () => void vi.advanceTimersByTime(2_000));

    r.rerender(<WalkPlannerApp view="walks" onNavigate={nav} />);
    await act(async () => void vi.advanceTimersByTime(500));
    expect(screen.getByText("משהו השתבש במסך הזה")).toBeTruthy();
    expect(screen.getByText("ההליכה שלך ממשיכה ונשמרת.")).toBeTruthy();

    r.rerender(<WalkPlannerApp view="walk" onNavigate={nav} />);
    await act(async () => void vi.advanceTimersByTime(500));
    expect(screen.getByTestId("walk-logo")).toBeTruthy();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
});
