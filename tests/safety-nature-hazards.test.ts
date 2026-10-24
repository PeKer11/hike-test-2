import { describe, expect, it } from "vitest";

import { hazardUrl, parseHazardCounts, seasonalNotes } from "@/lib/safety/nature-hazards";

describe("nature hazards", () => {
  it("reads species counts and prefers the common name", () => {
    const json = { results: [{ count: 7, taxon: { name: "Vipera palaestinae", preferred_common_name: "Palestine Viper" } }, { count: 2, taxon: { name: "Hystrix indica" } }, { taxon: { name: "x" } }] };
    expect(parseHazardCounts(json)).toEqual([{ species: "Palestine Viper", records: 7 }, { species: "Hystrix indica", records: 2 }]);
    expect(parseHazardCounts({})).toEqual([]);
  });

  it("builds a monthly 5 km query", () => {
    expect(hazardUrl(31.77, 35.2, 7)).toContain("radius=5&month=7");
  });

  it("gives season-specific notes", () => {
    expect(seasonalNotes(7).some((n) => n.includes("Jellyfish"))).toBe(true);
    expect(seasonalNotes(1)).toEqual([]);
  });
});
