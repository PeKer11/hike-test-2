import { describe, expect, it } from "vitest";

import { isPlausibleGeocodeMatch } from "@/lib/places/geocode-plausibility";

describe("isPlausibleGeocodeMatch", () => {
  it("accepts a result whose display name contains the asked-for name", () => {
    expect(
      isPlausibleGeocodeMatch(
        "Zichron Yaakov",
        "Zichron Yaakov, Haifa District, Israel",
      ),
    ).toBe(true);
  });

  it("accepts a Hebrew name matching its Hebrew display name", () => {
    expect(
      isPlausibleGeocodeMatch("זכרון יעקב", "זכרון יעקב, מחוז חיפה, ישראל"),
    ).toBe(true);
  });

  it("ignores niqqud and Latin accents when comparing", () => {
    expect(isPlausibleGeocodeMatch("זִכְרוֹן יַעֲקֹב", "זכרון יעקב, ישראל")).toBe(
      true,
    );
    expect(isPlausibleGeocodeMatch("Zürich", "Zurich, Switzerland")).toBe(true);
  });

  it("rejects a result that shares no real word with the name", () => {
    expect(
      isPlausibleGeocodeMatch("Zichron Yaakov", "Paris, Île-de-France, France"),
    ).toBe(false);
  });

  it("rejects a display name that is only a country", () => {
    expect(isPlausibleGeocodeMatch("Habima Square", "France")).toBe(false);
  });

  it("accepts a country display name that is the thing asked for", () => {
    expect(isPlausibleGeocodeMatch("France", "France")).toBe(true);
  });

  it("does not count generic address words as agreement", () => {
    expect(
      isPlausibleGeocodeMatch("Rothschild Street", "Herzl Street, Tel Aviv"),
    ).toBe(false);
  });

  it("treats a name too short to judge as plausible rather than suspect", () => {
    // Nothing here is long enough to be evidence either way; flagging every
    // such name would be noise.
    expect(isPlausibleGeocodeMatch("Ur", "Baghdad, Iraq")).toBe(true);
    expect(isPlausibleGeocodeMatch("the city", "Lisbon, Portugal")).toBe(true);
  });

  it("treats a missing display name as nothing said, not as a mismatch", () => {
    expect(isPlausibleGeocodeMatch("Zichron Yaakov", null)).toBe(true);
    expect(isPlausibleGeocodeMatch("Zichron Yaakov", "")).toBe(true);
  });

  it("matches on one shared word out of several", () => {
    expect(
      isPlausibleGeocodeMatch("Tel Aviv", "Tel Aviv-Yafo, Israel"),
    ).toBe(true);
  });
});
