import { describe, expect, it } from "vitest";

import { assessWalkWindow, endsAfterDark, nextDryStart, parseForecast, parseSunsets, type ForecastHour } from "@/lib/weather/forecast";

const hour = (i: number, over: Partial<ForecastHour> = {}): ForecastHour => ({
  time: `2026-10-24T${String(12 + i).padStart(2, "0")}:00`,
  feelsC: 22,
  precipProbPct: 0,
  precipMm: 0,
  gustKmh: 10,
  code: 1,
  ...over,
});

describe("assessWalkWindow", () => {
  it("is empty for calm weather", () => {
    expect(assessWalkWindow([hour(0), hour(1), hour(2)], 0, 120)).toEqual([]);
  });

  it("reports rain in the fourth hour of a five hour walk, and ignores hours after the walk", () => {
    const hours = [hour(0), hour(1), hour(2), hour(3, { precipProbPct: 70, precipMm: 1.2 }), hour(4), hour(5, { precipProbPct: 90 })];
    const issues = assessWalkWindow(hours, 0, 300);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: "rain", fromHour: 4, toHour: 4, at: "15:00" });
  });

  it("merges consecutive rainy hours and flags thunder separately", () => {
    const hours = [hour(0, { precipProbPct: 60 }), hour(1, { precipProbPct: 80, code: 95 })];
    const issues = assessWalkWindow(hours, 0, 120);
    expect(issues.find((i) => i.kind === "rain")).toMatchObject({ fromHour: 1, toHour: 2 });
    expect(issues.find((i) => i.kind === "thunderstorm")).toMatchObject({ fromHour: 2, toHour: 2 });
  });

  it("honours a later start and flags heat, cold and wind", () => {
    const hours = [hour(0, { precipProbPct: 90 }), hour(1, { feelsC: 38, gustKmh: 60 }), hour(2, { feelsC: 3 })];
    const kinds = assessWalkWindow(hours, 1, 120).map((i) => i.kind).sort();
    expect(kinds).toEqual(["cold", "heat", "wind"]);
  });
});

describe("parseForecast", () => {
  it("reads columns and survives a malformed body", () => {
    const hours = parseForecast({ hourly: { time: ["2026-10-24T12:00"], precipitation_probability: [40], apparent_temperature: [20] } });
    expect(hours).toEqual([{ time: "2026-10-24T12:00", feelsC: 20, precipProbPct: 40, precipMm: null, gustKmh: null, code: null }]);
    expect(parseForecast(null)).toEqual([]);
  });
});

describe("dry start, sunsets and darkness", () => {
  const hr = (i: number, rain: boolean) => ({
    time: `2026-10-25T${String(i).padStart(2, "0")}:00`,
    feelsC: 20,
    precipProbPct: rain ? 80 : 0,
    precipMm: rain ? 2 : 0,
    gustKmh: 10,
    code: 0,
  });
  const hours = Array.from({ length: 24 }, (_, i) => hr(i, i >= 8 && i <= 11));

  it("finds the first start whose whole window is dry", () => {
    expect(nextDryStart(hours, 120, 8)).toBe(12);
    expect(nextDryStart(hours, 120, 0)).toBe(0);
  });

  it("returns null when no start in range is dry", () => {
    expect(nextDryStart(hours.map((h) => ({ ...h, precipProbPct: 90 })), 60, 0)).toBeNull();
  });

  it("parses sunsets and flags a walk that ends after dark", () => {
    const sunsets = parseSunsets({ daily: { time: ["2026-10-25"], sunset: ["2026-10-25T17:10"] } });
    expect(sunsets).toEqual({ "2026-10-25": "2026-10-25T17:10" });
    expect(endsAfterDark(hours, sunsets, 15, 150)).toBe(true);
    expect(endsAfterDark(hours, sunsets, 9, 120)).toBe(false);
    expect(parseSunsets(null)).toEqual({});
  });
});
