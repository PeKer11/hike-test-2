/**
 * The Hebrew app must not show English on the pace and route-update cards (P13 of
 * docs/PACE-AND-MIDWALK-REROUTE-REVIEW-2026-11-22.md). Every table that has an `en` side has a `he` side with the
 * same keys, and a Hebrew string holds no English words.
 */
import { describe, expect, it } from "vitest";

import { walkCopy } from "@/lib/walk/walk-copy";

type Table = Record<string, unknown>;

// Sample arguments for the strings that carry a value.
function render(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (typeof value === "function") {
    const fn = value as (...args: unknown[]) => unknown;
    const out = fn("Museum", 12, 45);
    return typeof out === "string" ? [out] : [];
  }
  return [];
}

const TABLES = ["pace", "rebuild", "paceMismatch", "notice", "finished", "routeOrder", "offRouteCard"] as const;

describe("walkCopy: Hebrew covers every English string on the pace and route-update cards", () => {
  for (const name of TABLES) {
    const table = (walkCopy as unknown as Record<string, { en: Table; he: Table }>)[name];

    it(`${name}: he has the same keys as en`, () => {
      expect(Object.keys(table.he).sort()).toEqual(Object.keys(table.en).sort());
    });

    it(`${name}: no Hebrew string is empty, and none holds an English word`, () => {
      for (const [key, value] of Object.entries(table.he)) {
        for (const text of render(value)) {
          expect(text.trim().length, `${name}.${key}`).toBeGreaterThan(0);
          // Names that stay Latin in Hebrew copy: the sample place, the brand, and GPS.
          const english = text.replace(/Museum|Traike|GPS/g, "").match(/[A-Za-z]{3,}/g) ?? [];
          expect(english, `${name}.${key}: "${text}"`).toEqual([]);
        }
      }
    });
  }
});
