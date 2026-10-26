import { describe, expect, it } from "vitest";
import { expireCandidates, type Candidate } from "@/lib/assistant/state";

const DAY = 24 * 60 * 60 * 1000;
const base: Candidate = { id: "c1", name: "Cafe", coordinates: { lat: 1, lng: 2 }, category: "food", placeId: "p1", rating: 4.5, ratingCount: 10, hours: {} as never, wheelchairEntrance: true };

describe("expireCandidates", () => {
  it("keeps fresh Google content", () => {
    const [c] = expireCandidates([{ ...base, fetchedAt: 1000 }], 1000 + DAY - 1);
    expect(c.rating).toBe(4.5);
  });
  it("drops Google content after a day but keeps the place", () => {
    const [c] = expireCandidates([{ ...base, fetchedAt: 1000 }], 1000 + DAY);
    expect(c.placeId).toBe("p1");
    expect(c.rating).toBeUndefined();
    expect(c.hours).toBeUndefined();
    expect(c.wheelchairEntrance).toBeUndefined();
  });
  it("drops the whole place after 30 days", () => {
    expect(expireCandidates([{ ...base, fetchedAt: 1000 }], 1000 + 30 * DAY)).toEqual([]);
  });
  it("leaves candidates without a stamp alone", () => {
    expect(expireCandidates([base], 10 ** 13)).toHaveLength(1);
  });
});
