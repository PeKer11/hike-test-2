import { describe, expect, it } from "vitest";
import {
  timeToSeconds,
  secondsToTime,
  formatDuration,
} from "@/lib/utils/time";

describe("timeToSeconds", () => {
  it("converts HH:MM to seconds", () => {
    expect(timeToSeconds("09:30")).toBe(9 * 3600 + 30 * 60);
  });

  it("converts midnight", () => {
    expect(timeToSeconds("00:00")).toBe(0);
  });

  it("converts end of day", () => {
    expect(timeToSeconds("23:59")).toBe(23 * 3600 + 59 * 60);
  });

  it("handles HH:MM:SS format", () => {
    expect(timeToSeconds("09:30:45")).toBe(9 * 3600 + 30 * 60 + 45);
  });

  it("returns null for invalid strings", () => {
    expect(timeToSeconds("abc")).toBeNull();
    expect(timeToSeconds("")).toBeNull();
    expect(timeToSeconds("25:00")).toBeNull();
    expect(timeToSeconds("12:61")).toBeNull();
    expect(timeToSeconds("-1:30")).toBeNull();
  });

  it("returns null for missing parts", () => {
    expect(timeToSeconds("9")).toBeNull();
  });
});

describe("secondsToTime", () => {
  it("converts seconds to HH:MM", () => {
    expect(secondsToTime(9 * 3600 + 30 * 60)).toBe("09:30");
  });

  it("handles midnight", () => {
    expect(secondsToTime(0)).toBe("00:00");
  });

  it("pads single digits", () => {
    expect(secondsToTime(3600 + 300)).toBe("01:05");
  });

  it("clamps negative values to 0", () => {
    expect(secondsToTime(-100)).toBe("00:00");
  });
});

describe("formatDuration", () => {
  it("shows minutes only for short durations", () => {
    expect(formatDuration(1500)).toBe("25 min");
  });

  it("shows hours only when no minutes", () => {
    expect(formatDuration(7200)).toBe("2h");
  });

  it("shows hours and minutes", () => {
    expect(formatDuration(5400)).toBe("1h 30m");
  });

  it("rounds minutes", () => {
    expect(formatDuration(3660)).toBe("1h 1m");
  });
});
