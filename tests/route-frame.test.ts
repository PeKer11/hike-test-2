import { describe, expect, it } from "vitest";

import { classifyEnvironment, routeFrame } from "@/lib/walk/route-frame";
import { cumulativeDistances } from "@/lib/walk/walk-stats";
import { at } from "./helpers/discovery";

const north = [at(0, 0), at(0, 200), at(0, 400)];
const east = [at(0, 0), at(200, 0), at(400, 0)];

describe("routeFrame", () => {
  it("puts a place 40 m east of a north-bound route on the right", () => {
    const f = routeFrame(at(40, 100), north, cumulativeDistances(north));
    expect(f?.side).toBe("right");
    expect(f?.lateralM).toBeCloseTo(40, 0);
    expect(f?.alongM).toBeCloseTo(100, 0);
  });

  it("puts a place 40 m west of a north-bound route on the left", () => {
    const f = routeFrame(at(-40, 100), north, cumulativeDistances(north));
    expect(f?.side).toBe("left");
    expect(f?.lateralM).toBeCloseTo(-40, 0);
  });

  it("flips sides for an east-bound route", () => {
    const cum = cumulativeDistances(east);
    expect(routeFrame(at(100, -40), east, cum)?.side).toBe("right"); // south
    expect(routeFrame(at(100, 40), east, cum)?.side).toBe("left"); // north
  });

  it("handles the 0/360 seam: a south-bound route mirrors a north-bound one", () => {
    const south = [at(0, 400), at(0, 200), at(0, 0)];
    const cum = cumulativeDistances(south);
    expect(routeFrame(at(40, 200), south, cum)?.side).toBe("left");
    expect(routeFrame(at(-40, 200), south, cum)?.side).toBe("right");
  });

  it("reports 'on' under 8 m", () => {
    expect(routeFrame(at(5, 100), north, cumulativeDistances(north))?.side).toBe("on");
  });

  it("increases alongM monotonically on a 3-segment line", () => {
    const line = [at(0, 0), at(100, 0), at(100, 100), at(200, 100)];
    const cum = cumulativeDistances(line);
    const probes = [at(20, 10), at(90, 10), at(110, 50), at(110, 90), at(180, 110)];
    const along = probes.map((p) => routeFrame(p, line, cum)!.alongM);
    for (let i = 1; i < along.length; i += 1) expect(along[i]).toBeGreaterThan(along[i - 1]);
  });

  it("is null more than 50 m past either end, and set within 50 m", () => {
    const cum = cumulativeDistances(north);
    expect(routeFrame(at(0, 460), north, cum)).toBeNull();
    expect(routeFrame(at(0, -60), north, cum)).toBeNull();
    expect(routeFrame(at(0, 430), north, cum)).not.toBeNull();
  });

  it("is null for a degenerate route", () => {
    expect(routeFrame(at(0, 0), [at(0, 0)], [0])).toBeNull();
  });
});

describe("classifyEnvironment", () => {
  const pois = (n: number) => Array.from({ length: n }, () => ({ kind: "poi" as const }));

  it("is urban at >= 12 POIs/km, rural under 3, urban in between", () => {
    expect(classifyEnvironment(pois(12), 1, at(0, 0))).toBe("urban");
    expect(classifyEnvironment(pois(2), 1, at(0, 0))).toBe("rural");
    expect(classifyEnvironment(pois(6), 1, at(0, 0))).toBe("urban");
  });

  it("is park when inside a park polygon's bbox, whatever the density", () => {
    const area = { minLat: 32.0, maxLat: 32.2, minLng: 34.7, maxLng: 34.9, tags: { leisure: "park" } };
    expect(classifyEnvironment(pois(30), 1, at(0, 0), [area])).toBe("park");
    expect(
      classifyEnvironment(pois(30), 1, at(0, 0), [{ ...area, tags: { shop: "mall" } }]),
    ).toBe("urban");
  });
});
