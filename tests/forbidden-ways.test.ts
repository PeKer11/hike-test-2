import { describe, expect, it } from "vitest";
import { parseForbiddenWays } from "@/lib/walk/forbidden-ways";

const geom = [
  { lat: 32, lon: 34 },
  { lat: 32.001, lon: 34 },
];

describe("parseForbiddenWays", () => {
  it("labels a way the walker named and one that is merely dangerous", () => {
    const ways = parseForbiddenWays(
      [
        { type: "way", tags: { highway: "residential", name: "Herzl" }, geometry: geom },
        { type: "way", tags: { highway: "primary", name: "Highway 4" }, geometry: geom },
      ],
      ["herzl"],
    );
    expect(ways.map((w) => w.reason)).toEqual(["named", "dangerous"]);
    expect(ways[0].path[1]).toEqual({ lat: 32.001, lng: 34 });
  });

  it("skips elements without geometry", () => {
    expect(parseForbiddenWays([{ type: "way", tags: { name: "X" } }, { type: "node" }], [])).toEqual([]);
  });
});
