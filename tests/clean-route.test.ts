import { describe, expect, it, vi } from "vitest";
import type { Coordinates } from "@/lib/types";
import { buildCleanRoute, type AvoidPolygons } from "@/lib/walk/clean-route";

const p = (lat: number, lng: number): Coordinates => ({ lat, lng });
const origin = p(32, 34);
const stop = p(32.01, 34);
const outAndBack = [origin, stop, origin];
const loop = [origin, stop, p(32.01, 34.012), p(32, 34.012), origin];

describe("buildCleanRoute", () => {
  it("returns the plain route when noRepeat is off, without retrying", async () => {
    const route = vi.fn().mockResolvedValue(outAndBack);
    const r = await buildCleanRoute({ waypoints: [origin, stop, origin], route, noRepeat: false });
    expect(route).toHaveBeenCalledTimes(1);
    expect(r.quality.repeatedKm).toBeGreaterThan(0.8);
  });

  it("re-routes around a repeated street and keeps the cleaner route", async () => {
    const route = vi.fn(async (_w: Coordinates[], avoid: AvoidPolygons | null) => (avoid ? loop : outAndBack));
    const r = await buildCleanRoute({ waypoints: [origin, stop, origin], route, noRepeat: true });
    expect(route).toHaveBeenCalledTimes(2);
    expect(r.quality.repeatedKm).toBe(0);
    expect(r.geometry).toBe(loop);
  });

  it("keeps the original route when the retry finds no path", async () => {
    const route = vi.fn(async (_w: Coordinates[], avoid: AvoidPolygons | null) => {
      if (avoid) throw new Error("no route");
      return outAndBack;
    });
    const r = await buildCleanRoute({ waypoints: [origin, stop, origin], route, noRepeat: true });
    expect(r.geometry).toBe(outAndBack);
  });
});
