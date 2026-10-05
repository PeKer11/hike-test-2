import { describe, expect, it } from "vitest";

import { relatePlace, relativeBearing } from "@/lib/walk/poi-relation";
import type { Coordinates } from "@/lib/types";

const M = 111_320;
const ORIGIN: Coordinates = { lat: 32.08, lng: 34.78 };
const at = (northM: number, eastM: number): Coordinates => ({
  lat: ORIGIN.lat + northM / M,
  lng: ORIGIN.lng + eastM / (M * Math.cos((ORIGIN.lat * Math.PI) / 180)),
});

describe("relativeBearing", () => {
  it("normalises across the 0/360 seam", () => {
    expect(relativeBearing(350, 10)).toBeCloseTo(20);
    expect(relativeBearing(10, 350)).toBeCloseTo(-20);
    expect(relativeBearing(0, 180)).toBe(180);
  });
});

describe("relatePlace (north-bound walker)", () => {
  it("40 m east is right, 40 m west is left", () => {
    expect(relatePlace(ORIGIN, 0, 0, at(0, 40)).relation).toBe("right");
    expect(relatePlace(ORIGIN, 0, 0, at(0, -40)).relation).toBe("left");
  });

  it("north is ahead, south is behind", () => {
    expect(relatePlace(ORIGIN, 0, 0, at(80, 0)).relation).toBe("ahead");
    expect(relatePlace(ORIGIN, 0, 0, at(-80, 0)).relation).toBe("behind");
  });

  it("under 25 m is here whichever way they face", () => {
    expect(relatePlace(ORIGIN, 0, 0, at(-10, 5)).relation).toBe("here");
  });

  it("prefers the route direction over the noisy heading", () => {
    // heading says south (wrong), route says north: east place is right.
    expect(relatePlace(ORIGIN, 180, 0, at(0, 40)).relation).toBe("right");
  });

  it("works across the seam: heading 350, place to the north-east is ahead", () => {
    expect(relatePlace(ORIGIN, 350, null, at(80, 20)).relation).toBe("ahead");
  });

  it("with no heading at all only claims here (<60 m) or ahead", () => {
    expect(relatePlace(ORIGIN, null, null, at(0, 40)).relation).toBe("here");
    expect(relatePlace(ORIGIN, null, null, at(0, 100)).relation).toBe("ahead");
  });
});
