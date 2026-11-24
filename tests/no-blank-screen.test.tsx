/**
 * C5 of docs/PHONE-FEEDBACK-BEAM-TRAIL-CRASH-PLAN-2026-11-24.md: no planner screen is ever blank on a phone, with or
 * without a live walk. jsdom has no layout, so "visible" means: no ancestor carries a bare `hidden` class (a token like
 * `hidden @4xl:block` is display:none below 896px).
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
vi.mock("@/components/walks/MyWalksPanel", () => ({ MyWalksPanel: () => <div data-testid="my-walks" /> }));

const { WalkPlannerApp } = await import("@/components/planner/WalkPlannerApp");


function hiddenOnPhone(el: Element | null): boolean {
  for (let n = el; n; n = n.parentElement) if ((n.getAttribute("class") ?? "").split(/\s+/).includes("hidden")) return true;
  return false;
}
const visibleControls = () => [...document.querySelectorAll("h1,h2,h3,button,[role=button]")].filter((el) => !hiddenOnPhone(el));

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

beforeEach(() => {
  vi.useFakeTimers();
  signedIn = false;
  const store: Record<string, string> = { "walk-settings": JSON.stringify({ ...DEFAULT_WALK_SETTINGS, uiLanguage: "he" }) };
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => void (store[k] = v), removeItem: (k: string) => void delete store[k], clear: () => {} },
  });
  vi.stubGlobal("fetch", vi.fn(async (url: string) => (url.startsWith("/api/walk-plan") ? { ok: true, json: async () => plan } : { ok: false, status: 404, json: async () => ({}) })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("never a blank screen", () => {
  for (const live of [false, true]) {
    for (const view of ["plan", "walk", "walks"] as const) {
      it(`view=${view}, live walk=${live}: something to read or tap is visible`, async () => {
        const nav = vi.fn();
        const r = render(<WalkPlannerApp view="plan" onNavigate={nav} />);
        await act(async () => {});
        if (live) {
          fireEvent.change(screen.getByPlaceholderText("קו רוחב"), { target: { value: String(ORIGIN.lat) } });
          fireEvent.change(screen.getByPlaceholderText("קו אורך"), { target: { value: String(ORIGIN.lng) } });
          fireEvent.click(screen.getByRole("button", { name: "בנה מסלול הליכה" }));
          await act(async () => {});
          fireEvent.click(screen.getByLabelText(/Simulate this walk/));
          fireEvent.click(screen.getByRole("button", { name: "התחל הליכה" }));
          await act(async () => {});
        }
        signedIn = true;
        await act(async () => void vi.advanceTimersByTime(2_000));
        r.rerender(<WalkPlannerApp view={view} onNavigate={nav} />);
        await act(async () => void vi.advanceTimersByTime(500));
        expect(visibleControls().length).toBeGreaterThan(0);
      });
    }
  }
});
