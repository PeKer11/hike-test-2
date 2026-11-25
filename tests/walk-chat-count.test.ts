import { describe, expect, it } from "vitest";

import { requestedAddCount } from "@/lib/walk/chat/count";

const CASES: Array<[string, number | null]> = [
  ["תוסיף אטרקציה", 1],
  ["תוסיף אחת", 1],
  ["תוסיף שתי אטרקציות", 2],
  ["תוסיף שתיים", 2],
  ["תוסיף 2 מקומות", 2],
  ["תוסיף עוד אטרקציה או שתיים", 1],
  ["תגדיל את זה תעשה עוד אטרקציה או שניים", 1],
  ["תוסיף אחת או שתיים", 1],
  ["תוסיף שתיים או שלוש", 2],
  ["תוסיף 2-3 עצירות", 2],
  ["תוסיף כמה אטרקציות", 1],
  ["תגדיל את המסלול", 1],
  ["תוסיף שלוש אטרקציות", 3],
  ["תוסיף גלידה עד 300 מטר מכאן", 1],
  ["תוסיף בית קפה", 1],
  ["add two attractions", 2],
  ["add another stop or two", 1],
  ["add one or two more places", 1],
  ["add a couple more", 1],
  ["three more stops", 3],
  ["make it longer", 1],
  ["add 5 stops", 3],
  ["יש פה שירותים?", null],
  ["תוריד את העצירה השנייה", null],
  ["מתי נסיים?", null],
  ["what is this building?", null],
];

describe("requestedAddCount", () => {
  for (const [text, expected] of CASES) {
    it(`${JSON.stringify(text)} -> ${expected}`, () => {
      expect(requestedAddCount(text)).toBe(expected);
    });
  }
});
