// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

import { START_LOCATION_KEY, loadSavedStart, saveStart } from "@/lib/start-location";

describe("saved start", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      },
    });
  });

  it("round-trips a start", () => {
    saveStart({ lat: 32.52, lng: 34.95 }, "Binyamina");
    expect(loadSavedStart()).toEqual({ coordinates: { lat: 32.52, lng: 34.95 }, label: "Binyamina" });
  });

  it("returns null when nothing is saved", () => {
    expect(loadSavedStart()).toBeNull();
  });

  it("ignores corrupt or out-of-range values", () => {
    window.localStorage.setItem(START_LOCATION_KEY, "not json");
    expect(loadSavedStart()).toBeNull();
    window.localStorage.setItem(START_LOCATION_KEY, JSON.stringify({ coordinates: { lat: 200, lng: 0 }, label: "x" }));
    expect(loadSavedStart()).toBeNull();
  });
});
