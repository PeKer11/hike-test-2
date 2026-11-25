import { describe, expect, it } from "vitest";

import { basisCheck, endClock, estimatePreview, previewFromPlan, proposalLines } from "@/lib/walk/chat/proposal";

const at = (h: number, m: number) => new Date(2026, 10, 25, h, m).getTime();

describe("previewFromPlan", () => {
  it("is the new plan minus what is left now, with the finish clock from now", () => {
    const p = previewFromPlan({ planMinutes: 52, planDistM: 3100, baselineMin: 40, baselineDistM: 2300, nowMs: at(17, 0), allowedRemainingMin: 60 });
    expect(p).toEqual({ status: "ready", minDelta: 12, distDeltaM: 800, endClock: "17:52", overTime: false });
  });
  it("flags a plan longer than the time left, and a negative delta for a shorter one", () => {
    expect(previewFromPlan({ planMinutes: 70, planDistM: 4000, baselineMin: 40, baselineDistM: 2300, nowMs: at(9, 5), allowedRemainingMin: 60 }).overTime).toBe(true);
    const shorter = previewFromPlan({ planMinutes: 15, planDistM: 400, baselineMin: 40, baselineDistM: 2300, nowMs: at(9, 5), allowedRemainingMin: null });
    expect(shorter).toMatchObject({ minDelta: -25, distDeltaM: -1900, overTime: false });
  });
});

describe("endClock", () => {
  it("wraps past midnight and pads", () => {
    expect(endClock(at(23, 50), 20)).toBe("00:10");
    expect(endClock(at(8, 0), 5)).toBe("08:05");
  });
});

describe("estimatePreview", () => {
  it("prices each add as out-and-back at the planned pace plus 20 min, from the distance the server gave", () => {
    // 400 m at 12 min/km, winding 1.25: 2*400*1.25 = 1000 m = 12 min, + 20 visit
    const p = estimatePreview({ addDistancesM: [400], dropCount: 0, plannedMinPerKm: 12, nowMs: at(10, 0), remainingMin: 30, allowedRemainingMin: 60 });
    expect(p).toMatchObject({ status: "estimate", minDelta: 32, distDeltaM: 1000, endClock: "11:02" });
  });
  it("a skip saves a visit's worth of time", () => {
    const p = estimatePreview({ addDistancesM: [], dropCount: 1, plannedMinPerKm: 12, nowMs: at(10, 0), remainingMin: 30, allowedRemainingMin: 60 });
    expect(p).toMatchObject({ status: "estimate", minDelta: -20 });
  });
  it("is null when there is nothing to price (head back) or no clock to add it to", () => {
    expect(estimatePreview({ addDistancesM: [], dropCount: 0, plannedMinPerKm: 12, nowMs: at(10, 0), remainingMin: 30, allowedRemainingMin: 60 })).toBeNull();
    expect(estimatePreview({ addDistancesM: [100], dropCount: 0, plannedMinPerKm: 12, nowMs: at(10, 0), remainingMin: null, allowedRemainingMin: 60 })).toBeNull();
  });
});

describe("basisCheck", () => {
  const basis = { stopIds: ["a", "b"], planRev: 3, position: { lat: 32, lng: 34 }, at: 1_000_000 };
  const now = (over = {}) => ({ stopIds: ["a", "b"], planRev: 3, position: { lat: 32, lng: 34 }, at: 1_000_000 + 30_000, ...over });
  it("fresh when nothing moved", () => expect(basisCheck(basis, now())).toBe("fresh"));
  it("replanned when a stop was reached or an automatic replan ran", () => {
    expect(basisCheck(basis, now({ stopIds: ["b"] }))).toBe("replanned");
    expect(basisCheck(basis, now({ planRev: 4 }))).toBe("replanned");
  });
  it("relocated when the walker moved over 60 m or two minutes passed", () => {
    expect(basisCheck(basis, now({ position: { lat: 32.0009, lng: 34 } }))).toBe("relocated"); // ~100 m
    expect(basisCheck(basis, now({ at: 1_000_000 + 121_000 }))).toBe("relocated");
    expect(basisCheck(basis, now({ position: { lat: 32.0003, lng: 34 } }))).toBe("fresh"); // ~33 m
  });
  it("a changed route wins over a moved walker", () => {
    expect(basisCheck(basis, now({ planRev: 9, at: 9_999_999 }))).toBe("replanned");
  });
});

describe("proposalLines with numbers", () => {
  const p = { adds: [{ name: "Erez", coordinates: { lat: 0, lng: 0 }, afterName: "המוזיאון" }], dropNames: ["חאן"], headBack: false };
  it("Hebrew: signs, units, finish clock, and 'over time' only when over", () => {
    const l = proposalLines(p, { status: "ready", minDelta: 12, distDeltaM: 800, endClock: "17:40" }, "he");
    expect(l.line1).toBe("+ Erez (אחרי המוזיאון) · − חאן");
    expect(l.line2).toBe("+12 דק׳ · +0.8 ק״מ · סיום 17:40");
    expect(proposalLines(p, { status: "ready", minDelta: 12, distDeltaM: 800, endClock: "17:40", overTime: true }, "he").line2).toBe("+12 דק׳ · +0.8 ק״מ · סיום 17:40 · מעבר לזמן");
  });
  it("estimates carry a ~ and a shorter route a minus", () => {
    expect(proposalLines(p, { status: "estimate", minDelta: -25, distDeltaM: -1900, endClock: "16:55" }, "he").line2).toBe("~−25 דק׳ · ~−1.9 ק״מ · סיום 16:55");
  });
  it("head back shows only its own line", () => {
    expect(proposalLines({ adds: [], dropNames: [], headBack: true }, undefined, "he").line1).toBe("חזרה להתחלה");
  });
});

describe("proposalLines follows the dry run", () => {
  const two = { adds: [{ name: "Kiosk", coordinates: { lat: 1, lng: 1 } }, { name: "Cafe", coordinates: { lat: 1, lng: 2 } }], dropNames: [], headBack: false };
  const ready = { status: "ready" as const, minDelta: 12, distDeltaM: 800, endClock: "17:40" };
  it("lists only the placed adds and names the one that did not fit", () => {
    const l = proposalLines(two, { ...ready, placed: ["Kiosk"], unplaced: ["Cafe"], dropNames: [] }, "en");
    expect(l.line1).toBe("+ Kiosk");
    expect(l.line2).toContain("Cafe doesn't fit in the time left.");
  });
  it("in Hebrew the unplaced add says לא נכנס", () => {
    expect(proposalLines(two, { ...ready, placed: ["Kiosk"], unplaced: ["Cafe"] }, "he").line2).toContain("Cafe לא נכנס בזמן שנשאר.");
  });
  it("shows a stop the dry run squeezed out as a real drop", () => {
    expect(proposalLines(two, { ...ready, placed: ["Kiosk", "Cafe"], dropNames: ["Museum"] }, "en").line1).toBe("+ Kiosk · + Cafe · − Museum");
  });
  it("without dry-run detail the card is as asked", () => {
    expect(proposalLines(two, ready, "en").line1).toBe("+ Kiosk · + Cafe");
  });
});
