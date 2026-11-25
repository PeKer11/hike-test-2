import { describe, expect, it } from "vitest";

import { walkPlanRequestBody } from "@/lib/walk/plan-request";
import type { WalkCompanionInput } from "@/lib/types/walk-companion";
import type { Attraction } from "@/lib/types";

const input = {
  origin: { lat: 32, lng: 34 },
  availableMinutes: 45,
  walkingPaceMinPerKm: 12,
  radiusMeters: 1500,
  maxEndDistanceFromOriginMeters: 800,
  endAnchor: { lat: 32.1, lng: 34.1 },
  preferredCategories: ["park"],
} as unknown as WalkCompanionInput;
const stop = { id: "a", name: "A" } as unknown as Attraction;
const base = { input, keep: [stop], aiDecided: false, activePinnedIds: ["a"], visitedIds: ["v"], droppedIds: ["d"], stopCount: null, notableOnly: false, learnPreferences: true, timeZone: "Asia/Jerusalem" };

describe("walkPlanRequestBody", () => {
  it("a mid-walk rebuild returns to the anchor and never rediscovers visited or dropped stops", () => {
    const b = walkPlanRequestBody({ ...base, options: { autoResume: true, fixedOrder: true, presetGeometry: [{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }] } });
    expect(b).toMatchObject({
      lat: 32, lng: 34, availableMinutes: 45, walkingPaceMinPerKm: 12, radiusMeters: 1500,
      maxEndDistanceFromOriginMeters: 800, endAnchor: { lat: 32.1, lng: 34.1 }, returnTo: { lat: 32.1, lng: 34.1 },
      explicitAttractions: [stop], fixedOrder: true, pinnedAttractionIds: ["a"], fillRemainingTime: false,
      excludeIds: ["v", "d"], learnPreferences: true, timeZone: "Asia/Jerusalem",
    });
    expect(b.presetGeometry).toEqual([{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }]);
  });

  it("a fresh build has no returnTo or excludeIds, and fixedOrder only when asked", () => {
    const b = walkPlanRequestBody({ ...base, options: {} });
    expect(b.returnTo).toBeUndefined();
    expect(b.excludeIds).toBeUndefined();
    expect(b.fixedOrder).toBeUndefined();
  });

  it("stops the AI chose are kept in the AI's order, with its geometry", () => {
    const ai = { id: "z" } as unknown as Attraction;
    const b = walkPlanRequestBody({ ...base, options: {}, aiStops: [ai], aiGeometry: [{ lat: 9, lng: 9 }, { lat: 8, lng: 8 }] });
    expect(b.explicitAttractions).toEqual([ai]);
    expect(b.fixedOrder).toBe(true);
    expect(b.presetGeometry).toEqual([{ lat: 9, lng: 9 }, { lat: 8, lng: 8 }]);
  });

  it("route rules are spread in", () => {
    const b = walkPlanRequestBody({ ...base, options: {}, routeRules: { noRepeat: true } as never });
    expect(b.noRepeat).toBe(true);
  });
});
