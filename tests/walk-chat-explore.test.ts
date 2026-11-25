import { describe, expect, it } from "vitest";

import { isExploreRequest } from "@/lib/walk/chat/explore";

const CASES: Array<[string, boolean]> = [
  ["תפתיע אותי", true],
  ["תפתיעי אותי", true],
  ["מה יש פה?", true],
  ["מה יש בסביבה", true],
  ["מה מעניין כאן", true],
  ["מה מעניין בסביבה?", true],
  ["יש לך רעיונות?", true],
  ["תמליץ לי על משהו", true],
  ["אפשר המלצות", true],
  ["בא לי לגלות משהו חדש", true],
  ["surprise me", true],
  ["any ideas?", true],
  ["what's nearby", true],
  ["what is nearby?", true],
  ["let me explore", true],
  ["recommend something", true],
  ["תוסיף אטרקציה", false],
  ["תוסיף עוד אטרקציה או שניים", false],
  ["תוסיף בית קפה", false],
  ["מסלול של שעה מכאן", false],
  ["מסלול לחוף", false],
  ["תוריד את העצירה השנייה", false],
  ["יש פה שירותים?", false],
  ["add a cafe", false],
  ["route to the beach", false],
];

describe("isExploreRequest", () => {
  for (const [text, expected] of CASES) {
    it(`${JSON.stringify(text)} -> ${expected}`, () => {
      expect(isExploreRequest(text)).toBe(expected);
    });
  }
});
