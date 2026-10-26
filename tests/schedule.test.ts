import { describe, expect, it } from "vitest";

import { formatClock, localTimeOnDay, nextLocalTime, parseHHMM, tzOffsetMin } from "@/lib/walk/clock";
import { openThrough, type WeeklyHours } from "@/lib/walk/opening-hours";
import { scheduleRules } from "@/lib/walk/schedule-rules";
import { settled, type Verdict } from "@/lib/walk/rule-verdict";
import { bestOrderWithRules, satisfies } from "@/lib/walk/stop-order";
import { timeline } from "@/lib/walk/timing";

// 2026-10-26 is a Monday. Jerusalem is UTC+2 on that date (DST ended 25 Oct 2026).
const TZ = "Asia/Jerusalem";
const monday0900 = Date.UTC(2026, 9, 26, 7, 0);

describe("clock", () => {
  it("parses HH:MM and finds zone offsets", () => {
    expect(parseHHMM("9:05")).toBe(545);
    expect(parseHHMM("25:00")).toBeNull();
    expect(tzOffsetMin(TZ, monday0900)).toBe(120);
    expect(tzOffsetMin("Nope/Zone", monday0900)).toBeNull();
  });
  it("places a local time on the day and formats it back", () => {
    const t = localTimeOnDay("14:30", TZ, monday0900)!;
    expect(formatClock(t, 120)).toBe("14:30");
    expect(t).toBe(Date.UTC(2026, 9, 26, 12, 30));
  });
  it("next time rolls to tomorrow when passed", () => {
    expect(nextLocalTime("08:00", TZ, monday0900)).toBe(Date.UTC(2026, 9, 27, 6, 0));
    expect(nextLocalTime("10:00", TZ, monday0900)).toBe(Date.UTC(2026, 9, 26, 8, 0));
  });
});

const museum: WeeklyHours = { utcOffsetMin: 120, periods: [{ open: { day: 1, minute: 600 }, close: { day: 1, minute: 960 } }] };

describe("openThrough", () => {
  const at = (h: number, m = 0) => Date.UTC(2026, 9, 26, h - 2, m);
  it("open, closed, closes during the stay, unknown", () => {
    expect(openThrough(museum, at(11), 60)).toBe("open");
    expect(openThrough(museum, at(9), 30)).toBe("closed");
    expect(openThrough(museum, at(15, 30), 60)).toBe("closes_during");
    expect(openThrough(undefined, at(11), 60)).toBe("unknown");
    expect(openThrough({ periods: [] }, at(11), 60)).toBe("unknown");
  });
  it("handles overnight and 24/7", () => {
    const bar: WeeklyHours = { utcOffsetMin: 120, periods: [{ open: { day: 1, minute: 1200 }, close: { day: 2, minute: 120 } }] };
    expect(openThrough(bar, at(23), 30)).toBe("open");
    expect(openThrough(bar, Date.UTC(2026, 9, 26, 23, 30), 30)).toBe("open"); // 01:30 Tuesday local
    expect(openThrough({ periods: [{ open: { day: 0, minute: 0 } }] }, at(3), 600)).toBe("open");
  });
});

describe("scheduleRules", () => {
  const stops = [
    { id: "a", visitMin: 30 },
    { id: "b", visitMin: 60 },
  ];
  const t = timeline(stops, [1, 1], undefined, 15);
  const base = { timeline: t, stops: [{ id: "a", name: "A", category: "museum", hours: museum }, { id: "b", name: "B", category: "food" }], timeZone: TZ };

  it("emits nothing about hours without a start time, but flags wanted clock rules as unchecked", () => {
    expect(scheduleRules({ ...base })).toEqual([]);
    const r = scheduleRules({ ...base, endBy: "18:00" });
    expect(r[0]).toMatchObject({ rule: "stop_time", status: "not_checked", dataGap: true });
  });
  it("open_hours not_met when the museum is closed on arrival", () => {
    const r = scheduleRules({ ...base, startAt: Date.UTC(2026, 9, 26, 6, 0) }); // 08:00 local, arrive 08:15
    expect(r.find((x) => x.rule === "open_hours")).toMatchObject({ status: "not_met" });
  });
  it("open_hours partial when only some hours are unknown", () => {
    const r = scheduleRules({ ...base, startAt: Date.UTC(2026, 9, 26, 8, 0) }); // 10:00, museum open; B unknown
    expect(r.find((x) => x.rule === "open_hours")).toMatchObject({ status: "partial", dataGap: true });
  });
  it("end_by and per-stop windows", () => {
    const start = Date.UTC(2026, 9, 26, 8, 0);
    const r = scheduleRules({ ...base, startAt: start, endBy: "11:00", plans: { b: { arriveBefore: "10:30" } } });
    expect(r.find((x) => x.rule === "end_by")?.status).toBe("not_met"); // 10:00 + 120 min
    expect(r.find((x) => x.rule === "stop_time")?.status).toBe("not_met"); // b at 10:45
  });
  it("meal needs a food stop inside the window", () => {
    const start = Date.UTC(2026, 9, 26, 9, 0); // 11:00
    expect(scheduleRules({ ...base, startAt: start, meals: [{ from: "12:00", to: "14:00", minutes: 45 }] }).find((x) => x.rule === "meal")?.status).toBe("met");
    expect(scheduleRules({ ...base, startAt: start, meals: [{ from: "18:00", to: "19:00", minutes: 45 }] }).find((x) => x.rule === "meal")?.detail).toMatch(/does not overlap/);
  });
  it("stop_order not_checked when a ref is missing, not_met when violated", () => {
    expect(scheduleRules({ ...base, order: { first: "zzz" } })[0]).toMatchObject({ rule: "stop_order", status: "not_checked" });
    expect(scheduleRules({ ...base, order: { before: [["b", "a"]] } })[0]).toMatchObject({ rule: "stop_order", status: "not_met" });
    expect(scheduleRules({ ...base, order: { before: [["kind:museum", "kind:food"]] } })[0]).toMatchObject({ status: "met" });
  });
});

describe("breaks in the timeline", () => {
  const stops = [{ id: "a", visitMin: 0 }, { id: "b", visitMin: 0 }];
  it("adds a rest when the walk since the last rest passes the limit, and shifts arrivals", () => {
    const t = timeline(stops, [2, 2, 1], undefined, 15, null, { everyMin: 40, minutes: 10 });
    expect(t.restMin).toBe(10);
    expect(t.legs[1].restMin).toBe(10);
    expect(t.at[1].arriveMin).toBe(30 + 30 + 10);
    expect(t.totalMin).toBe(t.walkMin + t.visitMin + 10);
  });
  it("a long stay counts as a rest", () => {
    const t = timeline([{ id: "a", visitMin: 30 }, { id: "b", visitMin: 0 }], [2, 2], undefined, 15, null, { everyMin: 40, minutes: 10 });
    expect(t.restMin).toBe(0);
  });
  it("is unchanged without a break plan", () => {
    expect(timeline(stops, [1, 1], undefined, 15).restMin).toBe(0);
  });
});

describe("stop order", () => {
  const stops = [{ id: "a", category: "park" }, { id: "b", category: "food" }, { id: "c", category: "museum" }];
  const line = [0, 1, 2, 3].map((i) => [0, 1, 2, 3].map((j) => Math.abs(i - j) * 100));
  it("satisfies first/last/before/kind refs", () => {
    expect(satisfies(stops, { first: "a", last: "c" })).toBe(true);
    expect(satisfies(stops, { before: [["kind:food", "kind:park"]] })).toBe(false);
    expect(satisfies(stops, { endAt: "b" })).toBe(false);
  });
  it("finds the cheapest valid order, or null", () => {
    expect(bestOrderWithRules(line, false, stops, { before: [["b", "a"]] })).toEqual([2, 1, 3]);
    expect(bestOrderWithRules(line, false, stops, { first: "a", last: "a" })).toBeNull();
    expect(bestOrderWithRules(line, false, stops, undefined)).toEqual([1, 2, 3]);
  });
  it("greedy path above 7 stops honours first and before", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ id: `s${i}`, category: "other" }));
    const d = Array.from({ length: 10 }, (_, i) => Array.from({ length: 10 }, (_, j) => Math.abs(i - j)));
    const r = bestOrderWithRules(d, false, many, { first: "s8", before: [["s5", "s2"]] })!;
    expect(r[0]).toBe(9);
    expect(r.indexOf(6)).toBeLessThan(r.indexOf(3));
  });
});

describe("settled", () => {
  const v = (rules: Verdict["rules"]): Verdict => ({ ok: false, broken: false, rules, walkKm: 1, walkMin: 1, visitMin: 0, totalMin: 1 });
  it("accepts met and data gaps, rejects not_met and plain partials", () => {
    expect(settled(v([{ rule: "time", status: "met" }, { rule: "open_hours", status: "partial", dataGap: true }]))).toBe(true);
    expect(settled(v([{ rule: "open_hours", status: "not_met" }]))).toBe(false);
    expect(settled(v([{ rule: "time", status: "partial" }]))).toBe(false);
  });
});
