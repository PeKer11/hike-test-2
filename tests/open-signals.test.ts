import { describe, expect, it } from "vitest";
import { popularityScore, wikipediaPageviews12m } from "@/lib/places/open-signals";

describe("open signals", () => {
  it("sums twelve months of views and encodes the title", async () => {
    let seen = "";
    const fake = (async (url: string) => {
      seen = url;
      return { ok: true, json: async () => ({ items: [{ views: 100 }, { views: 50 }] }) };
    }) as unknown as typeof fetch;
    expect(await wikipediaPageviews12m("he:שוק הכרמל", new Date("2026-10-23"), fake)).toBe(150);
    expect(seen).toContain("he.wikipedia");
    expect(seen).toContain("/20251001/20261001");
  });
  it("returns null for a malformed tag or a failed request", async () => {
    expect(await wikipediaPageviews12m("no-language-prefix")).toBeNull();
    const bad = (async () => ({ ok: false })) as unknown as typeof fetch;
    expect(await wikipediaPageviews12m("en:Haifa", new Date(), bad)).toBeNull();
  });
  it("scores on a log scale between 0 and 1", () => {
    expect(popularityScore(null)).toBe(0);
    expect(popularityScore(1_000)).toBeGreaterThan(0.4);
    expect(popularityScore(1e9)).toBe(1);
  });
});
