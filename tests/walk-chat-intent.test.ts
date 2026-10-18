import { describe, expect, it } from "vitest";

import { parseIntent, type ChatStop } from "@/lib/walk/chat/intent";

const stops: ChatStop[] = [
  { id: "a", name: "Old Port", pinned: false },
  { id: "b", name: "הכותל המערבי", pinned: true },
  { id: "c", name: "Carmel Market", pinned: false },
  { id: "d", name: "Cafe Xoho", pinned: false },
];

describe("parseIntent (EN)", () => {
  it.each([
    ["is there a cafe nearby", "cafe"],
    ["I need coffee", "cafe"],
    ["where is drinking water", "drinking_water"],
    ["toilet please", "toilets"],
    ["a bench?", "bench"],
    ["any shade", "shade"],
    ["I'm hungry", "food"],
  ])("find: %s", (text, amenity) => {
    expect(parseIntent(text, stops)).toEqual({ intent: "find", amenity });
  });

  it("maps the other intents", () => {
    expect(parseIntent("make it shorter", stops).intent).toBe("shorter");
    expect(parseIntent("I'm tired", stops).intent).toBe("shorter");
    expect(parseIntent("can we go longer", stops).intent).toBe("longer");
    expect(parseIntent("take me back", stops).intent).toBe("head-back");
    expect(parseIntent("what is the weather", stops).intent).toBe("unknown");
    expect(parseIntent("   ", stops).intent).toBe("unknown");
  });

  it("does not hit 'sit' inside 'site'", () => {
    expect(parseIntent("this site is great", stops).intent).toBe("unknown");
  });

  it("skip beats find, find beats head-back, head-back beats shorter, shorter beats longer", () => {
    expect(parseIntent("skip the cafe", stops).intent).toBe("skip");
    expect(parseIntent("coffee then go back", stops).intent).toBe("find");
    expect(parseIntent("go back, I'm tired", stops).intent).toBe("head-back");
    expect(parseIntent("shorter, not longer", stops).intent).toBe("shorter");
  });
});

describe("parseIntent skip target", () => {
  it("bare skip, 'this' and 'next' mean the first remaining stop", () => {
    for (const t of ["skip", "skip this", "skip the next one", "דלג", "דלג על הבאה", "תדלג", "דלגו", "לדלג", "בוא נדלג", "בטל את זה"]) {
      expect(parseIntent(t, stops)).toEqual({ intent: "skip", stopId: "a" });
    }
  });

  it("matches a stop by name, case-insensitively", () => {
    expect(parseIntent("skip carmel market", stops)).toEqual({ intent: "skip", stopId: "c" });
    expect(parseIntent("drop the MARKET", stops)).toEqual({ intent: "skip", stopId: "c" });
  });

  it("matches a Hebrew stop name with a prefix", () => {
    expect(parseIntent("תדלג על כותל", stops)).toEqual({ intent: "skip", stopId: "b" });
    expect(parseIntent("דלג על הכותל המערבי", stops)).toEqual({ intent: "skip", stopId: "b" });
  });

  it("leaves stopId out when a named stop is not in the list", () => {
    expect(parseIntent("skip the museum", stops)).toEqual({ intent: "skip" });
    expect(parseIntent("skip", [])).toEqual({ intent: "skip" });
  });
});

describe("parseIntent (HE)", () => {
  it.each([
    ["יש קפה בסביבה", { intent: "find", amenity: "cafe" }],
    ["איפה יש מים", { intent: "find", amenity: "drinking_water" }],
    ["אני צריך שירותים", { intent: "find", amenity: "toilets" }],
    ["אני רעב", { intent: "find", amenity: "food" }],
    ["רוצה לשבת על ספסל", { intent: "find", amenity: "bench" }],
    ["אני עייף", { intent: "shorter" }],
    ["אפשר לקצר?", { intent: "shorter" }],
    ["אפשר להאריך קצת", { intent: "longer" }],
    ["בוא נחזור", { intent: "head-back" }],
    ["מה מזג האוויר", { intent: "unknown" }],
    ["צמאה", { intent: "find", amenity: "drinking_water" }],
    ["אני צמאה", { intent: "find", amenity: "drinking_water" }],
    ["אני רעבה", { intent: "find", amenity: "food" }],
    ["רעבה", { intent: "find", amenity: "food" }],
    ["אנחנו עייפים", { intent: "shorter" }],
    ["דרך קצרה יותר", { intent: "shorter" }],
    ["תקצר", { intent: "shorter" }],
    ["נקצר", { intent: "shorter" }],
    ["הטיול ארוך מדי", { intent: "shorter" }],
    ["נדלג על הפארק", { intent: "skip" }],
    ["תוותר על הפארק", { intent: "skip" }],
    ["אפשר לוותר על הפארק", { intent: "skip" }],
    ["תחזור", { intent: "head-back" }],
    ["איפה שירותי ציבור", { intent: "find", amenity: "toilets" }],
  ])("%s", (text, expected) => {
    expect(parseIntent(text, stops)).toEqual(expected);
  });
});

describe("parseIntent false positives", () => {
  it("a bare 'ארוך' (too long) does not mean longer", () => {
    expect(parseIntent("הטיול ארוך מדי", stops).intent).not.toBe("longer");
    expect(parseIntent("ארוך מדי", stops).intent).toBe("shorter");
    expect(parseIntent("ארוך", stops).intent).toBe("unknown");
  });

  it("'ארוך יותר' still means longer", () => {
    expect(parseIntent("אפשר מסלול ארוך יותר", stops).intent).toBe("longer");
  });

  it.each(["אני גר אצל חבר", "יש לי מצלמה", "אצלי בבית"])("Hebrew shade is a whole token: %s", (text) => {
    expect(parseIntent(text, stops)).toEqual({ intent: "unknown" });
  });
  it("Hebrew shade still matches with a prefix", () => {
    expect(parseIntent("יש צל?", stops)).toEqual({ intent: "find", amenity: "shade" });
    expect(parseIntent("מחפש בצל", stops)).toEqual({ intent: "find", amenity: "shade" });
  });

  it.each(["השמים יפים", "כמה פעמים עוד", "מזג אוויר חמים"])("Hebrew water is a whole token: %s", (text) => {
    expect(parseIntent(text, stops)).toEqual({ intent: "unknown" });
  });
  it("Hebrew water still matches bare and prefixed", () => {
    expect(parseIntent("מים", stops)).toEqual({ intent: "find", amenity: "drinking_water" });
    expect(parseIntent("אפשר להתרענן במים", stops)).toEqual({ intent: "find", amenity: "drinking_water" });
  });

  it("'drop by a cafe' is a cafe search, not a skip", () => {
    expect(parseIntent("let's drop by a cafe", stops)).toEqual({ intent: "find", amenity: "cafe" });
  });
  it("a lone weak word has no target and is not a skip; an unknown named stop asks which", () => {
    expect(parseIntent("drop", stops).intent).toBe("unknown");
    expect(parseIntent("לא רוצה", stops).intent).toBe("unknown");
    expect(parseIntent("drop the stop museum", stops)).toEqual({ intent: "skip" });
  });
  it("a weak skip does not target a stop just because its name holds an amenity word", () => {
    expect(parseIntent("let's drop by a cafe", stops)).toEqual({ intent: "find", amenity: "cafe" });
    expect(parseIntent("i dont want the cafe", stops)).toEqual({ intent: "find", amenity: "cafe" });
    expect(parseIntent("drop Cafe Xoho", stops)).toEqual({ intent: "skip", stopId: "d" });
    expect(parseIntent("skip xoho", stops)).toEqual({ intent: "skip", stopId: "d" });
  });
  it("bare 'drop' without a stop target is not a skip", () => {
    expect(parseIntent("drop it like it's hot", stops).intent).toBe("unknown");
  });
  it("'drop' with a stop reference or a stop name is still a skip", () => {
    expect(parseIntent("drop the next stop", stops)).toEqual({ intent: "skip", stopId: "a" });
    expect(parseIntent("drop Carmel Market", stops)).toEqual({ intent: "skip", stopId: "c" });
  });

  it("'לא רוצה' without a stop reference does not skip", () => {
    expect(parseIntent("לא רוצה ללכת עוד", stops).intent).not.toBe("skip");
    expect(parseIntent("לא רוצה לשתות קפה", stops)).toEqual({ intent: "find", amenity: "cafe" });
  });
  it("'לא רוצה' with a stop reference or name still skips", () => {
    expect(parseIntent("לא רוצה את העצירה הבאה", stops)).toEqual({ intent: "skip", stopId: "a" });
    expect(parseIntent("לא רוצה את הכותל המערבי", stops)).toEqual({ intent: "skip", stopId: "b" });
  });

  it("'loo' is a whole word", () => {
    expect(parseIntent("take a look around", stops).intent).toBe("unknown");
    expect(parseIntent("where is the loo", stops)).toEqual({ intent: "find", amenity: "toilets" });
  });
});
