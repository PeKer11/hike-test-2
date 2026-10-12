import { describe, expect, it } from "vitest";

import {
  cellsCovering,
  extractComponents,
  geohashBounds,
  geohashEncode,
  getLandcoverComponents,
  WC_GRASS,
  WC_TREE,
  WC_WATER,
  type RasterWindow,
} from "@/lib/places/landcover";

const BBOX = { south: 32.0, north: 32.01, west: 34.78, east: 34.79 };

/** 20x20 grid; paint rectangles of class codes. */
function grid(
  paints: Array<[number, number, number, number, number]>,
  canopy?: Array<[number, number, number, number, number]>,
): RasterWindow {
  const w = 20;
  const h = 20;
  const classes = new Uint8Array(w * h);
  const paint = (arr: ArrayLike<number> & { [i: number]: number }, rects: typeof paints) => {
    for (const [x0, y0, x1, y1, v] of rects)
      for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) arr[y * w + x] = v;
  };
  paint(classes, paints);
  let canopyArr: Float32Array | undefined;
  if (canopy) {
    canopyArr = new Float32Array(w * h);
    paint(canopyArr, canopy);
  }
  return { width: w, height: h, bbox: BBOX, classes, canopy: canopyArr };
}

describe("extractComponents", () => {
  it("keeps patches above the size floor and drops small ones", () => {
    const comps = extractComponents(
      grid([
        [0, 0, 10, 10, WC_TREE], // 100 px tree: kept
        [12, 0, 15, 3, WC_TREE], // 9 px tree: dropped (<50)
        [12, 10, 15, 14, WC_WATER], // 12 px water: kept (>=10)
        [0, 12, 8, 14, WC_GRASS], // 16 px grass: dropped (<100)
      ]),
    );
    expect(comps.map((c) => c.cls).sort()).toEqual(["tree", "water"]);
  });

  it("computes centroid, bbox and area inside the window", () => {
    const [tree] = extractComponents(grid([[0, 0, 10, 10, WC_TREE]]));
    expect(tree.bbox.west).toBeCloseTo(34.78, 6);
    expect(tree.bbox.east).toBeCloseTo(34.785, 6);
    expect(tree.bbox.north).toBeCloseTo(32.01, 6);
    expect(tree.bbox.south).toBeCloseTo(32.005, 6);
    expect(tree.centroid.lat).toBeGreaterThan(32.005);
    expect(tree.centroid.lat).toBeLessThan(32.01);
    // 0.005 deg x 0.005 deg at lat 32 ~ 556 m x 471 m ~ 26 ha
    expect(tree.areaM2).toBeGreaterThan(200_000);
    expect(tree.areaM2).toBeLessThan(300_000);
    expect(tree.canopyShare).toBeNull();
  });

  it("canopy confirm: share of pixels >= 3 m", () => {
    const [tree] = extractComponents(
      grid([[0, 0, 10, 10, WC_TREE]], [[0, 0, 10, 5, 8]]), // top half tall
    );
    expect(tree.canopyShare).toBeCloseTo(0.5, 5);
  });

  it("separate patches stay separate; touching same-class pixels merge", () => {
    const two = extractComponents(
      grid([
        [0, 0, 10, 10, WC_TREE],
        [11, 0, 20, 10, WC_TREE],
      ]),
    );
    expect(two).toHaveLength(2);
    const one = extractComponents(
      grid([
        [0, 0, 10, 10, WC_TREE],
        [10, 0, 20, 10, WC_TREE],
      ]),
    );
    expect(one).toHaveLength(1);
  });

  it("empty window -> nothing", () => {
    expect(extractComponents({ ...grid([]), width: 0 })).toEqual([]);
  });
});

describe("geohash cells", () => {
  it("encode/bounds round trip contains the point", () => {
    const pt = { lat: 32.0853, lng: 34.7818 };
    const hash = geohashEncode(pt);
    expect(hash).toHaveLength(6);
    const b = geohashBounds(hash);
    expect(pt.lat).toBeGreaterThanOrEqual(b.south);
    expect(pt.lat).toBeLessThanOrEqual(b.north);
    expect(pt.lng).toBeGreaterThanOrEqual(b.west);
    expect(pt.lng).toBeLessThanOrEqual(b.east);
  });

  it("known value: Tel Aviv area geohash starts with sv8", () => {
    expect(geohashEncode({ lat: 32.0853, lng: 34.7818 }).startsWith("sv8")).toBe(true);
  });

  it("a 600 m ring around a point yields several cells, capped", () => {
    const cells = cellsCovering([{ lat: 32.08, lng: 34.78 }], 600);
    expect(cells.length).toBeGreaterThan(1);
    expect(cellsCovering([{ lat: 32.08, lng: 34.78 }], 600, 2)).toHaveLength(2);
  });
});

describe("getLandcoverComponents degrades gracefully", () => {
  const comp = extractComponents(grid([[0, 0, 10, 10, WC_TREE]]));

  it("uses the store, falls back to the reader, skips what fails", async () => {
    const out = await getLandcoverComponents(["a", "b", "c", "d"], {
      store: {
        get: async (cell) => {
          if (cell === "a") return comp;
          if (cell === "b") throw new Error("db down");
          return null;
        },
      },
      reader: async (cell) => {
        if (cell === "c") return grid([[0, 0, 10, 10, WC_TREE]]);
        throw new Error("network down");
      },
    });
    expect(out).toHaveLength(2); // a from store, c from reader
  });

  it("no store and no reader (offline) -> empty, no throw", async () => {
    await expect(getLandcoverComponents(["a"], {})).resolves.toEqual([]);
  });
});
