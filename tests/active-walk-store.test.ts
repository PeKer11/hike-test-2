import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ACTIVE_WALK_KEY,
  ACTIVE_WALK_MAX_AGE_MS,
  clearActiveWalk,
  loadActiveWalk,
  saveActiveWalk,
  type ActiveWalkSnapshot,
} from "@/lib/walk/active-walk-store";
import { PlannerBridge, parseView } from "@/lib/shell/planner-bridge";

const snap = (): Omit<ActiveWalkSnapshot, "savedAt"> => ({
  plan: { orderedAttractions: [], segments: [], totalDistanceMeters: 0, totalMinutes: 0, feasible: true, droppedAttractions: [] },
  geometry: [
    { lat: 1, lng: 1 },
    { lat: 1.1, lng: 1.1 },
  ],
  input: { origin: { lat: 1, lng: 1 }, availableMinutes: 60, walkingPaceMinPerKm: 12, radiusMeters: 1000 } as never,
  visitedIds: ["a"],
  startedAt: 1,
  lastFix: null,
});

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
});

describe("active walk store", () => {
  it("round-trips a fresh snapshot", () => {
    saveActiveWalk(snap(), 1_000);
    expect(loadActiveWalk(2_000)?.visitedIds).toEqual(["a"]);
  });

  it("keeps the walk's totals so a reload does not forget the legs before the last change of route", () => {
    saveActiveWalk({ ...snap(), walkBeganAt: 500, legsBefore: { minutes: 12.5, meters: 840 }, legOffsetMin: 3 }, 1_000);
    const loaded = loadActiveWalk(2_000)!;
    expect(loaded.walkBeganAt).toBe(500);
    expect(loaded.legsBefore).toEqual({ minutes: 12.5, meters: 840 });
    expect(loaded.legOffsetMin).toBe(3);
    // An older snapshot, written before these fields existed, still loads.
    saveActiveWalk(snap(), 1_000);
    expect(loadActiveWalk(2_000)?.legsBefore).toBeUndefined();
  });

  it("drops (and clears) a snapshot older than 2 hours", () => {
    saveActiveWalk(snap(), 1_000);
    expect(loadActiveWalk(1_000 + ACTIVE_WALK_MAX_AGE_MS + 1)).toBeNull();
    expect(localStorage.getItem(ACTIVE_WALK_KEY)).toBeNull();
  });

  it("ignores garbage and a route with no geometry", () => {
    localStorage.setItem(ACTIVE_WALK_KEY, "{nope");
    expect(loadActiveWalk()).toBeNull();
    saveActiveWalk({ ...snap(), geometry: [] }, 1_000);
    expect(loadActiveWalk(1_001)).toBeNull();
  });

  it("clear removes it", () => {
    saveActiveWalk(snap(), 1_000);
    clearActiveWalk();
    expect(loadActiveWalk(1_001)).toBeNull();
  });
});

describe("shell bridge", () => {
  it("parses views, defaulting to home", () => {
    expect(parseView("walks")).toBe("walks");
    expect(parseView("nope")).toBe("home");
    expect(parseView(null)).toBe("home");
  });

  it("notifies only on a real change", () => {
    const bridge = new PlannerBridge();
    const listener = vi.fn();
    bridge.subscribe(listener);
    bridge.publish({ walkLive: true });
    bridge.publish({ walkLive: true });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(bridge.getState().walkLive).toBe(true);
  });
});
