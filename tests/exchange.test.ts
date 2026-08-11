import { describe, expect, it } from "vitest";

import {
  EXCHANGE_MAX_AGE_DAYS,
  exchangeAgeCutoff,
  isExchangeTurn,
  MAX_SCROLLBACK,
} from "@/lib/history/exchange";

describe("isExchangeTurn", () => {
  it("accepts the three turns the panel can produce", () => {
    expect(isExchangeTurn("prompt")).toBe(true);
    expect(isExchangeTurn("chip")).toBe(true);
    expect(isExchangeTurn("follow_up")).toBe(true);
  });

  it("rejects anything else, including near-misses on the enum spelling", () => {
    expect(isExchangeTurn("followUp")).toBe(false);
    expect(isExchangeTurn("")).toBe(false);
    expect(isExchangeTurn(undefined)).toBe(false);
    expect(isExchangeTurn(1)).toBe(false);
  });
});

describe("exchangeAgeCutoff", () => {
  it("is exactly the age limit before the given moment", () => {
    const now = new Date("2026-08-12T09:00:00.000Z");

    expect(exchangeAgeCutoff(now)).toBe("2026-07-13T09:00:00.000Z");
  });

  it("moves with the clock it is given rather than the real one", () => {
    const first = new Date("2026-01-01T00:00:00.000Z");
    const second = new Date("2026-01-02T00:00:00.000Z");

    const dayApart =
      Date.parse(exchangeAgeCutoff(second)) -
      Date.parse(exchangeAgeCutoff(first));

    expect(dayApart).toBe(24 * 60 * 60 * 1000);
  });
});

describe("window constants", () => {
  // The trim trigger in 20260812090000_prompt_exchanges.sql hard-codes this
  // number; a change here without a matching migration would silently make the
  // database keep a different window than the panel shows.
  it("keeps the persisted window at the five rows the migration trims to", () => {
    expect(MAX_SCROLLBACK).toBe(5);
  });

  it("keeps the age cutoff at 30 days", () => {
    expect(EXCHANGE_MAX_AGE_DAYS).toBe(30);
  });
});
