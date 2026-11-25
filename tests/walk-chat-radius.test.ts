import { describe, expect, it } from "vitest";

import { radiusFromText } from "@/lib/walk/chat/intent";

describe("radiusFromText", () => {
  it("reads half a kilometre as 500 m", () => {
    for (const t of ["בעצם בא לי עד חצי ק״מ רדיוס ותוסיף אטרקציה", 'חצי ק"מ', "חצי קילומטר", "half a km", "within half a kilometer", "half km"])
      expect(radiusFromText(t), t).toBe(500);
  });
  it("reads metres", () => {
    expect(radiusFromText("עד 300 מטר")).toBe(300);
    expect(radiusFromText("תוסיף משהו ב-400 מ׳")).toBe(400);
    expect(radiusFromText("within 250 m please")).toBe(250);
    expect(radiusFromText("200 meters")).toBe(200);
  });
  it("reads kilometres, with decimals", () => {
    expect(radiusFromText("עד 2 ק״מ")).toBe(2000);
    expect(radiusFromText("1.5 km")).toBe(1500);
    expect(radiusFromText("1,5 ק״מ")).toBe(1500);
  });
  it("a bare 'up to a kilometre' is 1000", () => {
    expect(radiusFromText("עד קילומטר")).toBe(1000);
    expect(radiusFromText("within a km")).toBe(1000);
  });
  it("clamps to 100-3000 m", () => {
    expect(radiusFromText("20 מטר")).toBe(100);
    expect(radiusFromText("10 ק״מ")).toBe(3000);
  });
  it("finds no radius where there is none, and does not mistake other numbers", () => {
    for (const t of ["תוסיף אטרקציה", "5 מדרגות", "אני הולך 5 קמ״ש", "add 2 places", "תוסיפו שני מקומות"])
      expect(radiusFromText(t), t).toBeNull();
  });
});
