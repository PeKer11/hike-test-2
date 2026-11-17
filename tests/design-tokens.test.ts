import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { routeColors } from "@/lib/map/route-colors";

const FOLDERS = ["walk", "map", "ui", "planner", "walks", "places", "shell", "social"].map((d) => join(process.cwd(), "src/components", d));

function sources(): { file: string; text: string }[] {
  return FOLDERS.flatMap((dir) =>
    readdirSync(dir)
      .filter((f) => f.endsWith(".tsx") && f !== "MapCredits.tsx")
      .map((f) => ({ file: `${dir}/${f}`, text: readFileSync(join(dir, f), "utf8") })),
  );
}

describe("anti-slop guards on the walk, map, ui and planner components", () => {
  it("has no off-palette navy, arbitrary background hex, or text under 13px (credits excepted)", () => {
    const bad = sources().filter(({ text }) => /#0b1a2b|bg-\[#|text-\[(9|10|11|12)px\]|text-xs/.test(text));
    expect(bad.map((b) => b.file)).toEqual([]);
  });

  it("has no uppercase tracking labels and no slate/emerald palette classes", () => {
    const bad = sources().filter(({ text }) => /uppercase tracking|text-slate-|bg-slate-|emerald-/.test(text));
    expect(bad.map((b) => b.file)).toEqual([]);
  });
});

describe("route colours", () => {
  it("are the deep green route and warm stone trail, per theme", () => {
    expect(routeColors("light")).toMatchObject({ route: "#25604b", walked: "#b9ad9c" });
    expect(routeColors("dark")).toMatchObject({ route: "#7fc4a0", walked: "#6e655a" });
  });
});
