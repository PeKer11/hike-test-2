import { describe, expect, it } from "vitest";

import { arbitrate, recordAsk } from "@/lib/walk/companion/companion-arbiter";
import type { ArbiterCtx, AskHistory } from "@/lib/walk/companion/companion-types";
import {
  conditionsCell,
  openMeteoUrl,
  parseOpenMeteo,
} from "@/lib/walk/companion/conditions";
import { paceCandidate } from "@/lib/walk/companion/producers/pace";
import {
  heatCandidate,
  rainCandidate,
} from "@/lib/walk/companion/producers/conditions";
import {
  stopClosingCandidate,
  towardGreenCandidate,
} from "@/lib/walk/companion/producers/places";
import { sunsetCandidate } from "@/lib/walk/companion/producers/sunset";
import { sunsetMs } from "@/lib/walk/companion/sun";

const MIN = 60_000;
const TLV = { lat: 32.0853, lng: 34.7818 };
const T0 = Date.UTC(2026, 5, 21, 10, 0, 0);

describe("sunsetMs", () => {
  it("matches published Tel Aviv sunsets within 5 minutes", () => {
    // 21 Jun 2026: ~19:49 IDT (UTC+3) = 16:49 UTC. 21 Dec 2026: ~16:39 IST (UTC+2) = 14:39 UTC.
    const jun = sunsetMs(Date.UTC(2026, 5, 21, 10), TLV.lat, TLV.lng)!;
    const dec = sunsetMs(Date.UTC(2026, 11, 21, 10), TLV.lat, TLV.lng)!;
    expect(Math.abs(jun - Date.UTC(2026, 5, 21, 16, 49)) / MIN).toBeLessThan(5);
    expect(Math.abs(dec - Date.UTC(2026, 11, 21, 14, 39)) / MIN).toBeLessThan(5);
  });

  it("is null during polar day", () => {
    expect(sunsetMs(Date.UTC(2026, 5, 21, 12), 80, 0)).toBeNull();
  });

  it("picks the local solar date for far-east longitudes", () => {
    // 23:00 UTC on 21 Jun is already the morning of 22 Jun in Tokyo.
    const s = sunsetMs(Date.UTC(2026, 5, 21, 23), 35.68, 139.69)!;
    expect(s).toBeGreaterThan(Date.UTC(2026, 5, 22, 0));
  });
});

describe("paceCandidate", () => {
  const stops = [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
    { id: "c", name: "C", pinned: true },
  ];
  const base = {
    plannedPaceMinPerKm: 12,
    remainingPlannedMin: 60,
    remainingStops: stops,
    nowMs: T0,
  };

  it("slow: value = overrun/20 capped at 1, offers dropping the last unpinned stop", () => {
    const c = paceCandidate({ ...base, advice: "slow", currentPaceMinPerKm: 15 })!;
    // ratio 1.25 -> overrun 15 min -> 0.75
    expect(c.value).toBeCloseTo(0.75);
    expect(c.kind).toBe("pace-slow");
    expect(c.answers.map((a) => a.operator?.op)).toEqual(["shorten", "keep-all-extend", "dismiss"]);
    expect(c.answers[0].operator).toEqual({ op: "shorten", dropStopIds: ["b"] });
    expect(c.context.stop).toBe("B");
    expect(paceCandidate({ ...base, advice: "slow", currentPaceMinPerKm: 30 })!.value).toBe(1);
  });

  it("slow with no droppable stop shortens without a drop list", () => {
    const c = paceCandidate({
      ...base,
      advice: "slow",
      currentPaceMinPerKm: 15,
      remainingStops: [{ id: "c", name: "C", pinned: true }],
    })!;
    expect(c.answers[0].operator).toEqual({ op: "shorten", dropStopIds: undefined });
  });

  it("is null when not actually slower, or fast without a place to add", () => {
    expect(paceCandidate({ ...base, advice: "slow", currentPaceMinPerKm: 11 })).toBeNull();
    expect(paceCandidate({ ...base, advice: "fast", currentPaceMinPerKm: 9 })).toBeNull();
    expect(paceCandidate({ ...base, advice: "slow", currentPaceMinPerKm: 0 })).toBeNull();
  });

  it("fast offers an extend with the place", () => {
    const c = paceCandidate({
      ...base,
      advice: "fast",
      currentPaceMinPerKm: 9,
      addPlace: { name: "Cafe", detourMin: 4.4 },
    })!;
    expect(c.kind).toBe("pace-fast");
    expect(c.answers[0].operator).toEqual({ op: "extend", addFrom: "collection" });
    expect(c.context).toEqual({ place: "Cafe", d: 4 });
    expect(c.value).toBeCloseTo(0.5); // spare 15 / 30
  });
});

describe("sunsetCandidate", () => {
  const sunset = sunsetMs(T0, TLV.lat, TLV.lng)!;

  it("value follows clamp((remaining - minutesToSunset + 10) / 30)", () => {
    const now = sunset - 40 * MIN;
    const c = sunsetCandidate({ nowMs: now, position: TLV, remainingWalkMin: 45 })!;
    expect(c.value).toBeCloseTo((45 - 40 + 10) / 30);
    expect(c.context.m).toBe(40);
    expect(sunsetCandidate({ nowMs: now, position: TLV, remainingWalkMin: 200 })!.value).toBe(1);
  });

  it("is null well before sunset, and after it", () => {
    expect(sunsetCandidate({ nowMs: sunset - 300 * MIN, position: TLV, remainingWalkMin: 60 })).toBeNull();
    expect(sunsetCandidate({ nowMs: sunset + MIN, position: TLV, remainingWalkMin: 60 })).toBeNull();
  });

  it("simulated walk: the question appears at the right minute", () => {
    const REMAINING = 50;
    const ctx: ArbiterCtx = { level: "normal", questionOnScreen: false, nearTurn: false };
    let shownAt: number | null = null;
    for (let t = sunset - 90 * MIN; t < sunset; t += 5_000) {
      const c = sunsetCandidate({ nowMs: t, position: TLV, remainingWalkMin: REMAINING });
      const pick = c ? arbitrate([c], ctx, { records: [] }, t) : null;
      if (pick) {
        shownAt = t;
        break;
      }
    }
    // The walk would end after dark as soon as remaining (50) > minutes to sunset:
    // urgency 3 bypasses the score threshold.
    expect(shownAt).not.toBeNull();
    const minutesToSunset = (sunset - shownAt!) / MIN;
    expect(minutesToSunset).toBeLessThan(50);
    expect(minutesToSunset).toBeGreaterThan(50 - 0.1);
  });

  it("urgency 3 only when the walk would end after dark", () => {
    const now = sunset - 40 * MIN;
    expect(sunsetCandidate({ nowMs: now, position: TLV, remainingWalkMin: 60 })!.urgency).toBe(3);
    expect(sunsetCandidate({ nowMs: now, position: TLV, remainingWalkMin: 35 })!.urgency).toBe(2);
  });

  it("shorten with no stop to drop is capped at minutes to sunset", () => {
    const now = sunset - 40 * MIN;
    const noStop = sunsetCandidate({ nowMs: now, position: TLV, remainingWalkMin: 60 })!;
    expect(noStop.answers[0].operator).toMatchObject({ op: "shorten", capMin: 40 });
    const withStop = sunsetCandidate({ nowMs: now, position: TLV, remainingWalkMin: 60, dropStopId: "s" })!;
    expect(withStop.answers[0].operator).toEqual({ op: "shorten", dropStopIds: ["s"], capMin: 40 });
  });
});

describe("simulated walk: never within 30 m of a turn", () => {
  it("emits zero questions while nearTurn, and asks once the turn is behind", () => {
    const sunset = sunsetMs(T0, TLV.lat, TLV.lng)!;
    let history: AskHistory = { records: [] };
    const shown: number[] = [];
    const start = sunset - 30 * MIN;
    // A turn-dense stretch for the first 8 minutes, then clear.
    for (let t = start; t < start + 20 * MIN; t += 5_000) {
      const nearTurn = t < start + 8 * MIN;
      const c = sunsetCandidate({ nowMs: t, position: TLV, remainingWalkMin: 60 });
      const pick = c
        ? arbitrate([c], { level: "chatty", questionOnScreen: false, nearTurn }, history, t)
        : null;
      if (pick) {
        expect(nearTurn).toBe(false);
        shown.push(t);
        history = recordAsk(history, { kind: pick.kind, askedAt: t, outcome: "answered" });
      }
    }
    expect(shown.length).toBe(1);
    expect(shown[0]).toBeGreaterThanOrEqual(start + 8 * MIN);
  });
});

describe("conditions producers", () => {
  it("heat: none below 33, grows above, needs water", () => {
    const water = { name: "Fountain", distM: 120 };
    expect(heatCandidate({ apparentTempC: 32.9, precipProbabilityPct: 0 }, water, T0)).toBeNull();
    expect(heatCandidate({ apparentTempC: 36, precipProbabilityPct: 0 }, null, T0)).toBeNull();
    expect(heatCandidate({ apparentTempC: 33, precipProbabilityPct: 0 }, water, T0)!.value).toBeCloseTo(0.6);
    const h = heatCandidate({ apparentTempC: 36, precipProbabilityPct: 0 }, water, T0)!;
    expect(h.value).toBeCloseTo(0.9);
    expect(h.answers[0].operator).toEqual({ op: "find-amenity", kind: "drinking_water" });
    expect(heatCandidate({ apparentTempC: 45, precipProbabilityPct: 0 }, water, T0)!.value).toBe(1);
    expect(heatCandidate({ apparentTempC: null, precipProbabilityPct: 0 }, water, T0)).toBeNull();
  });

  it("heat is a safety question (urgency 3) from 36 C, urgency 2 below", () => {
    const water = { name: "Fountain", distM: 120 };
    expect(heatCandidate({ apparentTempC: 35.9, precipProbabilityPct: 0 }, water, T0)!.urgency).toBe(2);
    expect(heatCandidate({ apparentTempC: 36, precipProbabilityPct: 0 }, water, T0)!.urgency).toBe(3);
  });

  it("pace-slow never offers to drop the only remaining stop", () => {
    const base = {
      advice: "slow" as const,
      currentPaceMinPerKm: 16,
      plannedPaceMinPerKm: 12,
      remainingPlannedMin: 60,
      nowMs: T0,
    };
    const one = paceCandidate({ ...base, remainingStops: [{ id: "a", name: "A" }] })!;
    expect(one.answers[0].operator).toEqual({ op: "shorten", dropStopIds: undefined });
    expect(one.context.stop).toBe("");
    const two = paceCandidate({
      ...base,
      remainingStops: [{ id: "a", name: "A" }, { id: "b", name: "B" }],
    })!;
    expect(two.answers[0].operator).toEqual({ op: "shorten", dropStopIds: ["b"] });
  });

  it("pace-fast 'Finish early' heads back", () => {
    const c = paceCandidate({
      advice: "fast",
      currentPaceMinPerKm: 9,
      plannedPaceMinPerKm: 12,
      remainingPlannedMin: 60,
      remainingStops: [],
      addPlace: { name: "Cafe", detourMin: 4 },
      nowMs: T0,
    })!;
    expect(c.answers.find((a) => a.id === "finish-early")!.operator).toEqual({ op: "head-back" });
  });

  it("rain: threshold 70%", () => {
    expect(rainCandidate({ apparentTempC: 20, precipProbabilityPct: 69 }, T0)).toBeNull();
    expect(rainCandidate({ apparentTempC: 20, precipProbabilityPct: 70 }, T0)!.kind).toBe("rain");
    expect(rainCandidate({ apparentTempC: 20, precipProbabilityPct: null }, T0)).toBeNull();
  });

  it("cell snapping, url and tolerant parsing", () => {
    expect(conditionsCell(32.0853, 34.7818)).toEqual({ key: "32.1,34.8", lat: 32.1, lng: 34.8 });
    expect(openMeteoUrl(32.1, 34.8)).toContain("latitude=32.1");
    expect(
      parseOpenMeteo({
        current: { apparent_temperature: 34.2 },
        hourly: { precipitation_probability: [10, 80] },
      }),
    ).toEqual({ apparentTempC: 34.2, precipProbabilityPct: 80 });
    expect(parseOpenMeteo(null)).toEqual({ apparentTempC: null, precipProbabilityPct: null });
    expect(parseOpenMeteo({ current: { apparent_temperature: "hot" } }).apparentTempC).toBeNull();
  });
});

describe("places producers", () => {
  it("toward-green waits for 60 m of heading, value score/3", () => {
    const args = { parkName: "Park", score: 2.4, nowMs: T0 };
    expect(towardGreenCandidate({ ...args, headingTowardM: 59 })).toBeNull();
    const c = towardGreenCandidate({ ...args, headingTowardM: 60 })!;
    expect(c.value).toBeCloseTo(0.8);
    expect(c.answers[0].operator).toEqual({ op: "loop-from-here", theme: "nature" });
  });

  it("stop-closing only when the margin is inside the slack", () => {
    const args = {
      stopId: "s1",
      stopName: "Museum",
      remainingStopCount: 3,
      closesAtHhmm: "17:00",
      nowMs: T0,
    };
    expect(
      stopClosingCandidate({ ...args, closesAtMs: T0 + 60 * MIN, etaMin: 20 }),
    ).toBeNull(); // 40 min of margin
    const c = stopClosingCandidate({ ...args, closesAtMs: T0 + 30 * MIN, etaMin: 25 })!;
    expect(c.value).toBeGreaterThan(0.5);
    expect(c.answers.map((a) => a.operator?.op)).toEqual(["shorten", "dismiss"]);
    expect(c.answers[0].operator).toEqual({ op: "shorten", dropStopIds: ["s1"] });
    // the only stop left cannot be skipped
    expect(
      stopClosingCandidate({ ...args, remainingStopCount: 1, closesAtMs: T0 + 30 * MIN, etaMin: 25 }),
    ).toBeNull();
    expect(c.context.hhmm).toBe("17:00");
    expect(stopClosingCandidate({ ...args, closesAtMs: T0 - MIN, etaMin: 5 })).toBeNull();
  });
});
