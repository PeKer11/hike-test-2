import { describe, expect, it } from "vitest";
import { placeScore } from "@/lib/assistant/state";

describe("placeScore", () => {
  it("a handful of perfect ratings does not beat a large body of good ones", () => {
    expect(placeScore({ rating: 5, ratingCount: 2 })).toBeLessThan(placeScore({ rating: 4.6, ratingCount: 2000 }));
  });
  it("an unrated place is an average one: it neither wins nor loses against a middling rating", () => {
    expect(placeScore({})).toBe(4);
    expect(placeScore({ rating: 4, ratingCount: 500 })).toBeCloseTo(4, 5);
  });
  it("a poorly rated place with many reviews scores below an unrated one", () => {
    expect(placeScore({ rating: 3.2, ratingCount: 800 })).toBeLessThan(placeScore({}));
  });
});
