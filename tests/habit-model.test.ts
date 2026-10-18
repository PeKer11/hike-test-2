import { describe, expect, it } from "vitest";

import {
  DAY_MS,
  ageDayMasks,
  activeBinsForSpan,
  alreadyFolded,
  applyAnswer,
  applyWalk,
  askBlocked,
  betaMean,
  binLabel,
  binOfMinute,
  emptyRow,
  estimateForBin,
  findRow,
  inAskWindow,
  isMuted,
  localTimeOf,
  minGapDays,
  peakEstimate,
  sanitizeHabitRow,
  walkKeyOf,
  wilsonLower,
  type HabitState,
  type WalkObservation,
} from "@/lib/preferences/habit-model";

const obs = (over: Partial<WalkObservation> = {}): WalkObservation => ({
  habit: "eat",
  dayType: "weekday",
  activeBins: [31, 32, 33],
  firstEventBin: 32,
  epochDay: 20000,
  ...over,
});

/** n walks on consecutive days, each with the given observation. */
function walks(n: number, make: (i: number) => WalkObservation, start: HabitState = []): HabitState {
  let s = start;
  for (let i = 0; i < n; i++) s = applyWalk(s, make(i), 100 + i);
  return s;
}

describe("time helpers", () => {
  it("bins are 30 minutes and circular", () => {
    expect(binOfMinute(0)).toBe(0);
    expect(binOfMinute(29)).toBe(0);
    expect(binOfMinute(30)).toBe(1);
    expect(binOfMinute(16 * 60)).toBe(32);
    expect(binOfMinute(1439)).toBe(47);
    expect(binOfMinute(1440)).toBe(0);
    expect(binOfMinute(-1)).toBe(47);
    expect(binLabel(32)).toBe("16:00");
  });

  it("local time uses the walk location's zone, not the device zone", () => {
    // Fri 2026-10-16 13:30 UTC = 16:30 in Jerusalem (UTC+3), 09:30 in New York (UTC-4).
    const ms = Date.UTC(2026, 9, 16, 13, 30);
    const il = localTimeOf(ms, "Asia/Jerusalem")!;
    expect(il.dayType).toBe("friday");
    expect(il.minuteOfDay).toBe(16 * 60 + 30);
    const ny = localTimeOf(ms, "America/New_York")!;
    expect(ny.minuteOfDay).toBe(9 * 60 + 30);
    expect(ny.dayType).toBe("friday");
    expect(localTimeOf(Date.UTC(2026, 9, 17, 12, 0), "Asia/Jerusalem")!.dayType).toBe("saturday");
    expect(localTimeOf(Date.UTC(2026, 9, 14, 12, 0), "Asia/Jerusalem")!.dayType).toBe("weekday");
    // Late UTC evening is already the next local day in Jerusalem.
    const late = localTimeOf(Date.UTC(2026, 9, 15, 22, 0), "Asia/Jerusalem")!;
    expect(late.dayType).toBe("friday");
    expect(late.minuteOfDay).toBe(60);
  });

  it("bad input yields null, not a throw", () => {
    expect(localTimeOf(NaN, "Asia/Jerusalem")).toBeNull();
    expect(localTimeOf(0, "Not/AZone")).toBeNull();
  });

  it("active bins need 15 minutes inside the bin, and wrap midnight", () => {
    // 15:50 -> 16:50 local: 10 min in bin 31, 30 in bin 32, 20 in bin 33.
    const start = Date.UTC(2026, 9, 14, 12, 50); // 15:50 Jerusalem
    expect(activeBinsForSpan(start, start + 60 * 60_000, "Asia/Jerusalem")).toEqual([32, 33]);
    // 23:40 -> 00:40: bin 47 has 20 min, bin 0 has 30, bin 1 has 10.
    const night = Date.UTC(2026, 9, 14, 20, 40); // 23:40 Jerusalem
    expect(activeBinsForSpan(night, night + 60 * 60_000, "Asia/Jerusalem")).toEqual([0, 47]);
    expect(activeBinsForSpan(start, start, "Asia/Jerusalem")).toEqual([]);
    expect(activeBinsForSpan(start, start + 14 * 60_000, "Asia/Jerusalem")).toEqual([]);
  });

  it("walk key is the start in whole minutes", () => {
    expect(walkKeyOf(120_000)).toBe(2);
    expect(walkKeyOf(NaN)).toBe(0);
  });
});

describe("statistics", () => {
  it("beta mean uses the weak prior", () => {
    expect(betaMean(0, 0)).toBeCloseTo(0.1);
    expect(betaMean(3, 3)).toBeCloseTo(3.3 / 6);
  });

  it("wilson lower bound (z = 1.28)", () => {
    expect(wilsonLower(3, 3)).toBeCloseTo(0.647, 2);
    expect(wilsonLower(5, 10)).toBeCloseTo(0.312, 2);
    expect(wilsonLower(0, 0)).toBe(0);
    expect(wilsonLower(9, 3)).toBeCloseTo(wilsonLower(3, 3)); // rate is clamped to 1
  });
});

describe("learning from walks", () => {
  it("a success adds 1.0 to its bin and 0.5 to each neighbour; opportunities are not smoothed", () => {
    const s = applyWalk([], obs(), 1);
    const row = findRow(s, "eat", "weekday")!;
    expect(row.succ[32]).toBe(1);
    expect(row.succ[31]).toBe(0.5);
    expect(row.succ[33]).toBe(0.5);
    expect(row.succ[30]).toBe(0);
    expect(row.opp[31]).toBe(1);
    expect(row.opp[32]).toBe(1);
    expect(row.opp[30]).toBe(0);
    // Mirrored into the any row.
    expect(findRow(s, "eat", "any")!.succ[32]).toBe(1);
  });

  it("smoothing wraps the circle: bin 47 reaches bin 0, bin 0 reaches bin 47", () => {
    const a = findRow(applyWalk([], obs({ firstEventBin: 47, activeBins: [47] }), 1), "eat", "any")!;
    expect(a.succ[47]).toBe(1);
    expect(a.succ[46]).toBe(0.5);
    expect(a.succ[0]).toBe(0.5);
    const b = findRow(applyWalk([], obs({ firstEventBin: 0, activeBins: [0] }), 1), "eat", "any")!;
    expect(b.succ[0]).toBe(1);
    expect(b.succ[47]).toBe(0.5);
    expect(b.succ[1]).toBe(0.5);
  });

  it("the ask window is circular around midnight", () => {
    const est = { habit: "eat" as const, bin: 0, mean: 0.8, wilsonLower: 0.5, opp: 5, source: "any" as const };
    expect(inAskWindow(est, 23 * 60 + 30)).toBe(true); // peak - 30
    expect(inAskWindow(est, 23 * 60 + 29)).toBe(false);
    expect(inAskWindow(est, 0)).toBe(true);
    expect(inAskWindow(est, 15)).toBe(true); // peak + 15
    expect(inAskWindow(est, 16)).toBe(false);
  });

  it("the ask window around 16:00 is [15:30, 16:15]", () => {
    const est = { habit: "eat" as const, bin: 32, mean: 0.8, wilsonLower: 0.5, opp: 5, source: "any" as const };
    expect(inAskWindow(est, 15 * 60 + 29)).toBe(false);
    expect(inAskWindow(est, 15 * 60 + 30)).toBe(true);
    expect(inAskWindow(est, 16 * 60 + 15)).toBe(true);
    expect(inAskWindow(est, 16 * 60 + 16)).toBe(false);
  });

  it("decay is applied once per walk to every cell of the habit, never to another habit", () => {
    let s = applyWalk([], obs({ dayType: "friday" }), 1);
    s = applyWalk(s, obs({ habit: "coffee" }), 1);
    const before = findRow(s, "eat", "friday")!.opp[32];
    s = applyWalk(s, obs({ dayType: "weekday", epochDay: 20001 }), 2);
    expect(findRow(s, "eat", "friday")!.opp[32]).toBeCloseTo(before * 0.97);
    expect(findRow(s, "coffee", "weekday")!.opp[32]).toBe(1); // untouched
    expect(findRow(s, "eat", "any")!.opp[32]).toBeCloseTo(0.97 + 1);
  });

  it("a re-synced or older walk changes nothing (idempotent)", () => {
    const s = applyWalk([], obs(), 5);
    expect(applyWalk(s, obs(), 5)).toBe(s);
    expect(applyWalk(s, obs(), 4)).toBe(s);
    expect(alreadyFolded(s, "eat", 5)).toBe(true);
    expect(alreadyFolded(s, "eat", 6)).toBe(false);
    expect(alreadyFolded(s, "coffee", 5)).toBe(false);
  });

  it("does not mutate its input", () => {
    const s = applyWalk([], obs(), 1);
    const snap = JSON.stringify(s);
    applyWalk(s, obs({ epochDay: 20001 }), 2);
    applyAnswer(s, { habit: "eat", dayType: "weekday", answer: "not-now", bin: 32, askedAtMs: 1e12 });
    expect(JSON.stringify(s)).toBe(snap);
  });

  it("ignores out-of-range bins instead of corrupting the arrays", () => {
    const s = applyWalk([], obs({ activeBins: [-1, 48, 1.5, 5], firstEventBin: 99 }), 1);
    const row = findRow(s, "eat", "any")!;
    expect(row.opp).toHaveLength(48);
    expect(row.opp[5]).toBe(1);
    expect(row.opp.reduce((a, b) => a + b, 0)).toBe(1);
    expect(row.succ.reduce((a, b) => a + b, 0)).toBe(0);
  });
});

describe("the confidence gate", () => {
  it("one walk, or several walks on one day, is never established", () => {
    expect(peakEstimate(walks(1, () => obs()), "eat", "weekday")).toBeNull();
    const sameDay = walks(6, () => obs({ epochDay: 20000 }));
    expect(findRow(sameDay, "eat", "any")!.opp[32]).toBeGreaterThanOrEqual(3);
    expect(peakEstimate(sameDay, "eat", "weekday")).toBeNull(); // one distinct day
  });

  it("four walks on four days with a success each is established (three decay to 2.91 opportunities)", () => {
    expect(peakEstimate(walks(3, (i) => obs({ epochDay: 20000 + i })), "eat", "weekday")).toBeNull();
    const s = walks(4, (i) => obs({ epochDay: 20000 + i }));
    const est = peakEstimate(s, "eat", "weekday")!;
    expect(est.bin).toBe(32);
    expect(est.mean).toBeGreaterThanOrEqual(0.5);
    expect(est.wilsonLower).toBeGreaterThanOrEqual(0.3);
    expect(est.opp).toBeGreaterThanOrEqual(3);
  });

  it("opportunities: just under 3 fails, exactly 3 passes (all else equal)", () => {
    const withOpp = (opp: number): HabitState => {
      const r = emptyRow("eat", "any");
      r.opp[32] = opp;
      r.succ[32] = opp;
      r.dayMasks[32] = 0b11;
      return [r];
    };
    expect(estimateForBin(withOpp(2.99), "eat", "any", 32)).toBeNull();
    expect(estimateForBin(withOpp(3), "eat", "any", 32)).not.toBeNull();
  });

  it("distinct days: successes on one day only fail, a second day passes", () => {
    let s = walks(5, () => obs({ epochDay: 20000 }));
    expect(estimateForBin(s, "eat", "any", 32)).toBeNull();
    s = applyWalk(s, obs({ epochDay: 20001 }), 300);
    expect(estimateForBin(s, "eat", "any", 32)).not.toBeNull();
  });

  it("distinct days are per bin: successes in unrelated bins on two days do not pass either bin", () => {
    let s = walks(5, () => obs({ epochDay: 20000 })); // bin 32: 5 successes, all on one day
    expect(estimateForBin(s, "eat", "any", 32)).toBeNull();
    // A success in an unrelated bin on another day must not supply the second day for bin 32.
    s = applyWalk(s, obs({ epochDay: 20001, activeBins: [12], firstEventBin: 12 }), 400);
    expect(estimateForBin(s, "eat", "any", 32)).toBeNull();
    // ...but a second day in bin 32 itself (or a neighbour) does.
    s = applyWalk(s, obs({ epochDay: 20002 }), 500);
    expect(estimateForBin(s, "eat", "any", 32)).not.toBeNull();
  });

  it("day evidence ages out after 30 days", () => {
    const old = 1 << (20000 % 30);
    expect(ageDayMasks([old], 20000, 20030)).toEqual([0]);
    expect(ageDayMasks([old], 20000, 20003)).toEqual([old]);
    // The slot of the old day is reused by the day 30 later: the old bit must not survive into it.
    let s = walks(1, () => obs({ epochDay: 20000 }));
    s = applyWalk(s, obs({ epochDay: 20030, activeBins: [] , firstEventBin: null}), 900);
    expect(findRow(s, "eat", "any")!.dayMasks[32]).toBe(0);
  });

  it("the mean gate kills a 50% habit, even with plenty of data", () => {
    // 10 walks active at 16:00, only 5 eat: Beta mean 0.41 < 0.5.
    const s = walks(10, (i) => obs({ epochDay: 20000 + i, firstEventBin: i % 2 === 0 ? 32 : null }));
    expect(estimateForBin(s, "eat", "any", 32)).toBeNull();
  });

  it("the mean gate is its own gate: Wilson passes (0.36) but the Beta mean (0.45) is under 0.5", () => {
    const r = emptyRow("eat", "any");
    r.opp[32] = 10;
    r.succ[32] = 5.5;
    r.dayMasks[32] = 0b11;
    expect(wilsonLower(5.5, 10)).toBeGreaterThanOrEqual(0.3);
    expect(betaMean(5.5, 10)).toBeLessThan(0.5);
    expect(estimateForBin([r], "eat", "any", 32)).toBeNull();
    r.succ[32] = 6.5; // mean 0.523
    expect(estimateForBin([r], "eat", "any", 32)).not.toBeNull();
  });

  it("smoothing alone cannot make a neighbouring bin a habit", () => {
    // Success only at bin 33 gives bin 32 half-successes (0.5 per walk) with opp 1 per walk.
    const s = walks(4, (i) => obs({ epochDay: 20000 + i, firstEventBin: 33 }));
    const row = findRow(s, "eat", "any")!;
    expect(row.succ[32]).toBeGreaterThan(1.5);
    expect(estimateForBin(s, "eat", "any", 32)).toBeNull(); // rate ~0.5 -> mean < 0.5
    expect(estimateForBin(s, "eat", "any", 33)).not.toBeNull(); // the real peak
  });

  it("EXPOSURE TRAP: always walking at 16:00 and never eating does not create a habit", () => {
    const s = walks(20, (i) => obs({ epochDay: 20000 + i, firstEventBin: null }));
    const row = findRow(s, "eat", "any")!;
    expect(row.opp[32]).toBeGreaterThan(10);
    expect(row.succ[32]).toBe(0);
    expect(peakEstimate(s, "eat", "weekday")).toBeNull();
    expect(peakEstimate(s, "eat", "any")).toBeNull();
  });

  it("EXPOSURE TRAP: eating at lunch while also walking at 16:00 gives lunch, not 16:00", () => {
    const s = walks(8, (i) =>
      obs({ epochDay: 20000 + i, activeBins: [25, 26, 31, 32, 33], firstEventBin: 26 }),
    );
    expect(estimateForBin(s, "eat", "any", 32)).toBeNull();
    expect(peakEstimate(s, "eat", "any")!.bin).toBe(26);
  });

  it("a circular habit across midnight is found at bin 47, and its neighbours do not win", () => {
    const s = walks(4, (i) => obs({ epochDay: 20000 + i, activeBins: [46, 47, 0], firstEventBin: 47 }));
    expect(peakEstimate(s, "eat", "any")!.bin).toBe(47);
  });

  it("day types are separate, falling back to any where a day type has under 3 opportunities", () => {
    // Weekday habit at bin 32 only.
    let s = walks(4, (i) => obs({ epochDay: 20000 + i, dayType: "weekday" }));
    expect(estimateForBin(s, "eat", "weekday", 32)!.source).toBe("weekday");
    // Friday has no data of its own: falls back to the all-days cell.
    expect(estimateForBin(s, "eat", "friday", 32)!.source).toBe("any");
    // A Friday cell with opp >= 3 in the bin and no eating beats the fallback.
    s = walks(
      4,
      (i) => obs({ epochDay: 30000 + i, dayType: "friday", firstEventBin: null }),
      s.map((r) => ({ ...r })),
    );
    s = s.map((r) => (r.habit === "eat" ? { ...r, lastWalkKey: 0 } : r));
    s = walks(4, (i) => obs({ epochDay: 30010 + i, dayType: "friday", firstEventBin: null }), s);
    expect(estimateForBin(s, "eat", "friday", 32)).toBeNull();
    expect(estimateForBin(s, "eat", "weekday", 32)).not.toBeNull();
  });

  it("unknown habits and bad bins have no estimate", () => {
    expect(estimateForBin([], "coffee", "weekday", 32)).toBeNull();
    expect(estimateForBin(walks(3, () => obs()), "eat", "any", 99)).toBeNull();
  });
});

describe("learning 'no' in three tiers", () => {
  const T0 = Date.UTC(2026, 9, 14, 12, 0);
  const ev = (answer: "take-me" | "already" | "not-now" | "timeout", over = {}) => ({
    habit: "eat" as const,
    dayType: "weekday" as const,
    answer,
    bin: 32,
    askedAtMs: T0,
    ...over,
  });
  const base = (): HabitState => walks(4, (i) => obs({ epochDay: 20000 + i }));

  it("'already ate' is not a failure: opportunities stay, the streak resets, the ask was too late", () => {
    let s = applyAnswer(base(), ev("not-now"));
    const oppBefore = findRow(s, "eat", "any")!.opp[32];
    s = applyAnswer(s, ev("already"));
    const any = findRow(s, "eat", "any")!;
    expect(any.opp[32]).toBe(oppBefore);
    expect(any.declineStreak).toBe(0);
    expect(any.timing.tooLate).toBe(1);
  });

  it("'take me' resets the streak and counts as on time", () => {
    let s = applyAnswer(applyAnswer(base(), ev("not-now")), ev("not-now", { askedAtMs: T0 + DAY_MS }));
    expect(findRow(s, "eat", "any")!.declineStreak).toBe(2);
    s = applyAnswer(s, ev("take-me", { askedAtMs: T0 + 2 * DAY_MS }));
    expect(findRow(s, "eat", "any")!.declineStreak).toBe(0);
    expect(findRow(s, "eat", "any")!.timing.onTime).toBe(1);
  });

  it("'not now' is a soft failure: opp +0.5 in the bin, never a full miss, streak + 1", () => {
    const b = base();
    const s = applyAnswer(b, ev("not-now"));
    expect(findRow(s, "eat", "any")!.opp[32] - findRow(b, "eat", "any")!.opp[32]).toBeCloseTo(0.5);
    expect(findRow(s, "eat", "weekday")!.opp[32] - findRow(b, "eat", "weekday")!.opp[32]).toBeCloseTo(0.5);
    expect(findRow(s, "eat", "any")!.declineStreak).toBe(1);
    expect(findRow(s, "eat", "any")!.succ[32]).toBe(findRow(b, "eat", "any")!.succ[32]);
    // Only a soft hit: the habit is still established after one "not now".
    expect(estimateForBin(s, "eat", "weekday", 32)).not.toBeNull();
  });

  it("a timeout is no habit evidence at all", () => {
    const b = base();
    const s = applyAnswer(b, ev("timeout"));
    expect(findRow(s, "eat", "any")!.opp).toEqual(findRow(b, "eat", "any")!.opp);
    expect(findRow(s, "eat", "any")!.declineStreak).toBe(0);
    expect(findRow(s, "eat", "any")!.timing).toEqual(findRow(b, "eat", "any")!.timing);
  });

  it("'not now' followed by food within 30 min is 'too early', not a decline", () => {
    const b = base();
    const s = applyAnswer(b, ev("not-now", { visitedFoodWithin30Min: true }));
    const any = findRow(s, "eat", "any")!;
    expect(any.declineStreak).toBe(0);
    expect(any.timing.tooEarly).toBe(1);
    expect(any.opp[32]).toBe(findRow(b, "eat", "any")!.opp[32]);
  });

  it("3 consecutive 'not now' mute the habit for 30 days, then it speaks again", () => {
    let s = base();
    for (let i = 0; i < 2; i++) {
      s = applyAnswer(s, ev("not-now", { askedAtMs: T0 + i * 3 * DAY_MS }));
      expect(isMuted(s, "eat", T0 + 100 * DAY_MS)).toBe(false);
    }
    const third = T0 + 6 * DAY_MS;
    s = applyAnswer(s, ev("not-now", { askedAtMs: third }));
    expect(findRow(s, "eat", "any")!.declineStreak).toBe(3);
    expect(isMuted(s, "eat", third + 29 * DAY_MS)).toBe(true);
    expect(isMuted(s, "eat", third + 30 * DAY_MS)).toBe(false);
    expect(isMuted(s, "coffee", third)).toBe(false);
    expect(askBlocked(s, "eat", third + DAY_MS)).toBe(true);
  });

  it("an accept between declines keeps the streak from reaching 3", () => {
    let s = base();
    s = applyAnswer(s, ev("not-now", { askedAtMs: T0 }));
    s = applyAnswer(s, ev("not-now", { askedAtMs: T0 + DAY_MS }));
    s = applyAnswer(s, ev("take-me", { askedAtMs: T0 + 3 * DAY_MS }));
    s = applyAnswer(s, ev("not-now", { askedAtMs: T0 + 5 * DAY_MS }));
    expect(findRow(s, "eat", "any")!.declineStreak).toBe(1);
    expect(isMuted(s, "eat", T0 + 6 * DAY_MS)).toBe(false);
  });

  it("each decline doubles the minimum gap: 1, 2 days, then muted", () => {
    expect([0, 1, 2, 3, 9].map(minGapDays)).toEqual([0, 1, 2, 4, 4]);
    let s = applyAnswer(base(), ev("not-now"));
    const hour = Math.floor(T0 / 3_600_000) * 3_600_000;
    expect(findRow(s, "eat", "any")!.lastAskedMs).toBe(hour);
    expect(askBlocked(s, "eat", hour + DAY_MS - 1)).toBe(true);
    expect(askBlocked(s, "eat", hour + DAY_MS)).toBe(false);
    s = applyAnswer(s, ev("not-now", { askedAtMs: hour + 2 * DAY_MS }));
    expect(askBlocked(s, "eat", hour + 2 * DAY_MS + 2 * DAY_MS - 1)).toBe(true);
    expect(askBlocked(s, "eat", hour + 2 * DAY_MS + 2 * DAY_MS)).toBe(false);
  });

  it("a bad bin changes nothing", () => {
    const b = base();
    expect(applyAnswer(b, ev("not-now", { bin: 99 }))).toBe(b);
  });
});

describe("sanitizeHabitRow", () => {
  const good = () => ({ ...emptyRow("eat", "any"), lastAskedMs: 5, mutedUntilMs: null });

  it("keeps a valid row", () => {
    expect(sanitizeHabitRow(good())).toEqual(good());
  });

  it("rejects wrong habit, day type, array length, negatives and NaN", () => {
    expect(sanitizeHabitRow({ ...good(), habit: "rest" })).toBeNull();
    expect(sanitizeHabitRow({ ...good(), dayType: "sunday" })).toBeNull();
    expect(sanitizeHabitRow({ ...good(), succ: [1, 2] })).toBeNull();
    expect(sanitizeHabitRow({ ...good(), opp: new Array(48).fill(-1) })).toBeNull();
    expect(sanitizeHabitRow({ ...good(), succ: new Array(48).fill(NaN) })).toBeNull();
    expect(sanitizeHabitRow(null)).toBeNull();
    expect(sanitizeHabitRow("x")).toBeNull();
  });

  it("clamps junk counters to safe values", () => {
    const r = sanitizeHabitRow({ ...good(), declineStreak: 1e9, dayMasks: [-4, 1.5], timing: { onTime: "x" } })!;
    expect(r.declineStreak).toBe(100);
    expect(r.dayMasks).toEqual(new Array(48).fill(0));
    expect(r.timing.onTime).toBe(0);
  });
});
