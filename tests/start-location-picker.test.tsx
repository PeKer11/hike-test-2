import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StartLocationPicker } from "@/components/assistant/StartLocationPicker";
import type { LocateOptions } from "@/lib/geo/locate";

// The picker's job is wiring `locate()` to the screen, so the service itself is the seam here
// (its own behaviour is in locate.test.ts).
const locateMock = vi.fn<(options: LocateOptions) => { stop(): void }>(() => ({ stop: vi.fn() }));
vi.mock("@/lib/geo/locate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/geo/locate")>()),
  locate: (options: LocateOptions) => locateMock(options),
  geolocationSupported: () => true,
  queryLocationPermission: async () => undefined,
}));

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  });
  locateMock.mockClear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.documentElement.lang = "";
});

const tap = () => fireEvent.click(screen.getByText(/My location/));
const driver = () => locateMock.mock.calls[0][0];

describe("StartLocationPicker location states", () => {
  it("picks the first fix as approximate, then the settled one as 'My location'", () => {
    const onPick = vi.fn();
    render(<StartLocationPicker onPick={onPick} />);
    tap();
    act(() => { driver().onUpdate({ coordinates: { lat: 32.1, lng: 34.8 }, accuracyMeters: 400, timestamp: 1, source: "gps" }); });
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Approximate location")).toBeTruthy();

    act(() => { driver().onUpdate({ coordinates: { lat: 32.1002, lng: 34.8002 }, accuracyMeters: 15, timestamp: 2, source: "gps" }); });
    expect(onPick).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Approximate location")).toBeNull();
    expect(screen.getByText(/Starting from: My location/)).toBeTruthy();
  });

  it("uses an IP city only to centre the map, never as the walk's start", () => {
    const onPick = vi.fn();
    const onApproximate = vi.fn();
    render(<StartLocationPicker onPick={onPick} onApproximate={onApproximate} />);
    tap();
    act(() => { driver().onUpdate({ coordinates: { lat: 32.07, lng: 34.78 }, accuracyMeters: 25000, timestamp: 1, source: "ip", city: "Tel Aviv" }); });
    expect(onApproximate).toHaveBeenCalledWith({ lat: 32.07, lng: 34.78 });
    expect(onPick).not.toHaveBeenCalled();
    expect(screen.getByText("Roughly in Tel Aviv")).toBeTruthy();
  });

  it("shows the blocked card with search and how-to, in Hebrew when the page is Hebrew", () => {
    document.documentElement.lang = "he";
    render(<StartLocationPicker onPick={vi.fn()} />);
    tap();
    act(() => { driver().onState?.("denied"); });
    expect(screen.getByText("המיקום חסום")).toBeTruthy();

    fireEvent.click(screen.getByText("חיפוש מקום"));
    expect(document.activeElement).toBe(screen.getByPlaceholderText(/Start from/));

    expect(screen.queryByText(/Safari/)).toBeNull();
    fireEvent.click(screen.getByText("איך מאפשרים"));
    expect(screen.getByText(/Safari/)).toBeTruthy();
    expect(screen.getByText(/Android/)).toBeTruthy();
  });

  it("clears the card when the permission comes back and a search starts again", () => {
    render(<StartLocationPicker onPick={vi.fn()} />);
    tap();
    act(() => { driver().onState?.("denied"); });
    expect(screen.getByTestId("location-denied")).toBeTruthy();
    act(() => { driver().onState?.("searching"); });
    expect(screen.queryByTestId("location-denied")).toBeNull();
  });

  it("says so when finding you timed out", () => {
    render(<StartLocationPicker onPick={vi.fn()} />);
    tap();
    act(() => { driver().onState?.("timeout"); });
    expect(screen.getByText(/took too long/)).toBeTruthy();
  });
});
