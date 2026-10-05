import { describe, expect, it } from "vitest";

import { calloutsSuppressed, canOfferAdd } from "@/lib/walk/detour-offer";

const base = { fallbackDistanceM: 0, speedMpm: 1000 / 15, environment: "urban" as const };

describe("canOfferAdd", () => {
  it("offers a near place when plenty of walk is left", () => {
    expect(canOfferAdd({ ...base, lateralM: 100, remainingWalkMin: 60 })).toBe(true);
  });

  it("refuses when the detour does not fit the remaining time", () => {
    // 100 m aside = 3.75 min round trip; 20 min left allows only 3 min.
    expect(canOfferAdd({ ...base, lateralM: 100, remainingWalkMin: 20 })).toBe(false);
  });

  it("refuses beyond the environment's lateral limit even with time to spare", () => {
    expect(canOfferAdd({ ...base, lateralM: 200, remainingWalkMin: 600 })).toBe(false);
    expect(canOfferAdd({ ...base, environment: "rural", lateralM: 200, remainingWalkMin: 600 })).toBe(true);
    expect(canOfferAdd({ ...base, environment: "rural", lateralM: 600, remainingWalkMin: 600 })).toBe(false);
  });

  it("uses the absolute lateral and falls back to the callout distance without a frame", () => {
    expect(canOfferAdd({ ...base, lateralM: -100, remainingWalkMin: 60 })).toBe(true);
    expect(canOfferAdd({ ...base, lateralM: null, fallbackDistanceM: 100, remainingWalkMin: 20 })).toBe(false);
    expect(canOfferAdd({ ...base, lateralM: null, fallbackDistanceM: 60, remainingWalkMin: 20 })).toBe(true);
  });
});

describe("calloutsSuppressed", () => {
  it("holds callouts back while the off-route card is up, and lets them resume after", () => {
    expect(calloutsSuppressed({ collapsed: false, offRoute: true, cardVisible: true, offRouteDismissed: true, askUp: false })).toBe(true);
    expect(calloutsSuppressed({ collapsed: false, offRoute: true, cardVisible: false, offRouteDismissed: true, askUp: false })).toBe(false);
    expect(calloutsSuppressed({ collapsed: false, offRoute: false, cardVisible: true, offRouteDismissed: true, askUp: false })).toBe(false);
    expect(calloutsSuppressed({ collapsed: true, offRoute: false, cardVisible: false, offRouteDismissed: true, askUp: false })).toBe(true);
  });

  it("holds back on the first off-route fix, before any card has rendered", () => {
    // cardVisible is still false (state lands after this fix), dismissed not yet set.
    expect(
      calloutsSuppressed({ collapsed: false, offRoute: true, cardVisible: false, offRouteDismissed: false, askUp: false }),
    ).toBe(true);
    // The ask card raised earlier in the same fix counts even if dismissed was set.
    expect(
      calloutsSuppressed({ collapsed: false, offRoute: true, cardVisible: false, offRouteDismissed: true, askUp: true }),
    ).toBe(true);
    // Dismissed and no ask card: callouts resume.
    expect(
      calloutsSuppressed({ collapsed: false, offRoute: true, cardVisible: false, offRouteDismissed: true, askUp: false }),
    ).toBe(false);
    // On the route the refs are irrelevant.
    expect(
      calloutsSuppressed({ collapsed: false, offRoute: false, cardVisible: false, offRouteDismissed: false, askUp: true }),
    ).toBe(false);
  });
});
