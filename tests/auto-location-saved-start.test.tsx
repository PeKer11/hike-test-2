import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WalkCompanionPanel } from "@/components/route/WalkCompanionPanel";
import { START_LOCATION_KEY } from "@/lib/start-location";
import { DEFAULT_WALK_SETTINGS } from "@/lib/types/walk-settings";

function mockGps() {
  const getCurrentPosition = vi.fn((ok: (p: unknown) => void) => ok({ coords: { latitude: 32.09, longitude: 34.88 } }));
  Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition }, configurable: true });
  return getCurrentPosition;
}
const panel = (onLocationDetected: () => void) => (
  <WalkCompanionPanel isLoading={false} onBuildWalk={vi.fn()} walkSettings={DEFAULT_WALK_SETTINGS} onWalkSettingsChange={vi.fn()} onLocationDetected={onLocationDetected} />
);

const store = new Map<string, string>();
Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), clear: () => store.clear() },
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("automatic location on load", () => {
  it("does not override a remembered start", async () => {
    window.localStorage.setItem(START_LOCATION_KEY, JSON.stringify({ coordinates: { lat: 32.07, lng: 34.77 }, label: "Dizengoff" }));
    const gps = mockGps();
    const detected = vi.fn();
    render(panel(detected));
    await waitFor(() => expect(gps).toHaveBeenCalled());
    expect(detected).not.toHaveBeenCalled();
  });

  it("still moves the map to the walker when nothing is remembered", async () => {
    const gps = mockGps();
    const detected = vi.fn();
    render(panel(detected));
    await waitFor(() => expect(gps).toHaveBeenCalled());
    await waitFor(() => expect(detected).toHaveBeenCalledWith({ lat: 32.09, lng: 34.88 }));
  });
});
