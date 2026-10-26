import { describe, expect, it } from "vitest";

import { suggestStart, type ForecastHour } from "@/lib/weather/forecast";

const pad = (n: number) => String(n).padStart(2, "0");
/** 48 hourly rows from 2026-10-26T10:00; `storm` lists the absolute row indexes with a thunderstorm. */
function forecast(storm: number[]): ForecastHour[] {
  return Array.from({ length: 48 }, (_, i) => {
    const t = Date.UTC(2026, 9, 26, 10 + i);
    const d = new Date(t);
    return { time: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:00`, feelsC: 20, precipProbPct: 0, precipMm: 0, gustKmh: 0, code: storm.includes(i) ? 95 : 0 };
  });
}
const sunsets = { "2026-10-26": "2026-10-26T17:05", "2026-10-27": "2026-10-27T17:04", "2026-10-28": "2026-10-28T17:03" };
const sunrises = { "2026-10-26": "2026-10-26T06:00", "2026-10-27": "2026-10-27T06:01", "2026-10-28": "2026-10-28T06:02" };

describe("suggestStart", () => {
  it("null when the walk is already dry and in daylight", () => {
    expect(suggestStart(forecast([]), sunsets, sunrises, 180, 0)).toBeNull();
  });
  it("a long walk ending after dark gets an earlier-or-later daylight start, never before sunrise", () => {
    const s = suggestStart(forecast([]), sunsets, sunrises, 9 * 60, 0);
    expect(s?.date).toBe("2026-10-27");
    expect(s!.at >= "06:01").toBe(true);
    expect(s?.shorterMin).toBeUndefined();
  });
  it("a storm in the walk pushes the start to a dry window", () => {
    const s = suggestStart(forecast([1, 2, 3]), sunsets, sunrises, 120, 0); // storm 11:00-14:00
    expect(s).not.toBeNull();
    expect(s!.startInHours).toBeGreaterThan(0);
  });
  it("offers a shorter walk when no full-length window exists", () => {
    const s = suggestStart(forecast([]), sunsets, sunrises, 14 * 60, 0); // daylight is ~11 h
    expect(s?.shorterMin).toBeGreaterThanOrEqual(60);
    expect(s?.shorterMin).toBeLessThan(14 * 60);
  });
});
