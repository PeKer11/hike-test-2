import type { Coordinates } from "@/lib/types";
import type { Bbox, LandClass, LandcoverComponent } from "@/lib/types/landcover";

/**
 * Land-cover lookup for the imagery ("detected") tier. Pure parts: geohash
 * cells, component extraction from a classified raster window. The two places
 * that touch the network (the COG window reader and the cell store) are seams
 * with a graceful "no data" answer, so a missing network, key or cache simply
 * yields no detected items.
 *
 * Source: ESA WorldCover 2021 v200 (CC BY 4.0), 10 m, overall accuracy 76.7%.
 * It cannot tell a park from an orchard, a base or a fenced garden; that is
 * the job of the hazard filter, not of this file.
 *
 * TODO: a real COG reader (geotiff.js range reads against
 * s3://esa-worldcover/v200/2021/map/) plus the Meta/WRI canopy-height
 * confirm. Not built: `geotiff` is not a dependency yet. Until then cells come
 * only from the precomputed `landcover_cells` table, or not at all.
 */

/** ESA WorldCover class codes. */
export const WC_TREE = 10;
export const WC_GRASS = 30;
export const WC_WATER = 80;
export const WC_WETLAND = 90;

const CLASS_OF: Record<number, LandClass> = {
  [WC_TREE]: "tree",
  [WC_GRASS]: "grass",
  [WC_WATER]: "water",
  [WC_WETLAND]: "water",
};

/** Minimum patch sizes in 10 m pixels (100 m2 each): 0.5 ha, 0.1 ha, 1 ha. */
export const MIN_PIXELS: Record<LandClass, number> = {
  tree: 50,
  water: 10,
  grass: 100,
};
export const CANOPY_MIN_HEIGHT_M = 3;

/** A classified raster window, row-major, north row first. */
export interface RasterWindow {
  width: number;
  height: number;
  bbox: Bbox;
  /** WorldCover class code per pixel. */
  classes: ArrayLike<number>;
  /** Optional canopy height in metres per pixel, same grid. */
  canopy?: ArrayLike<number>;
}

const M_PER_DEG_LAT = (Math.PI / 180) * 6_371_000;

/** Connected (4-neighbour) patches of tree / water / grass above the size floor. */
export function extractComponents(win: RasterWindow): LandcoverComponent[] {
  const { width, height, bbox } = win;
  if (width <= 0 || height <= 0) return [];
  const dLat = (bbox.north - bbox.south) / height;
  const dLng = (bbox.east - bbox.west) / width;
  const seen = new Uint8Array(width * height);
  const out: LandcoverComponent[] = [];

  for (let start = 0; start < width * height; start += 1) {
    if (seen[start]) continue;
    const cls = CLASS_OF[win.classes[start]];
    if (!cls) continue;
    const stack = [start];
    seen[start] = 1;
    const pixels: number[] = [];
    while (stack.length > 0) {
      const i = stack.pop() as number;
      pixels.push(i);
      const x = i % width;
      const y = (i - x) / width;
      const neighbours = [
        x > 0 ? i - 1 : -1,
        x < width - 1 ? i + 1 : -1,
        y > 0 ? i - width : -1,
        y < height - 1 ? i + width : -1,
      ];
      for (const n of neighbours) {
        if (n >= 0 && !seen[n] && CLASS_OF[win.classes[n]] === cls) {
          seen[n] = 1;
          stack.push(n);
        }
      }
    }
    if (pixels.length < MIN_PIXELS[cls]) continue;

    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;
    let sumX = 0;
    let sumY = 0;
    let tall = 0;
    for (const i of pixels) {
      const x = i % width;
      const y = (i - x) / width;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      sumX += x + 0.5;
      sumY += y + 0.5;
      if (win.canopy && win.canopy[i] >= CANOPY_MIN_HEIGHT_M) tall += 1;
    }
    const centroid: Coordinates = {
      lat: bbox.north - (sumY / pixels.length) * dLat,
      lng: bbox.west + (sumX / pixels.length) * dLng,
    };
    const pixelAreaM2 =
      dLat *
      M_PER_DEG_LAT *
      (dLng * M_PER_DEG_LAT * Math.cos((centroid.lat * Math.PI) / 180));
    out.push({
      cls,
      areaM2: Math.round(pixels.length * pixelAreaM2),
      centroid,
      bbox: {
        north: bbox.north - minY * dLat,
        south: bbox.north - (maxY + 1) * dLat,
        west: bbox.west + minX * dLng,
        east: bbox.west + (maxX + 1) * dLng,
      },
      canopyShare: win.canopy ? tall / pixels.length : null,
    });
  }
  return out;
}

// ---- geohash cells (precision 6, about 1.2 x 0.6 km) ----------------------

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
export const CELL_PRECISION = 6;

export function geohashEncode(p: Coordinates, precision = CELL_PRECISION): string {
  let latLo = -90;
  let latHi = 90;
  let lngLo = -180;
  let lngHi = 180;
  let hash = "";
  let bit = 0;
  let ch = 0;
  let even = true;
  while (hash.length < precision) {
    if (even) {
      const mid = (lngLo + lngHi) / 2;
      if (p.lng >= mid) {
        ch = (ch << 1) | 1;
        lngLo = mid;
      } else {
        ch <<= 1;
        lngHi = mid;
      }
    } else {
      const mid = (latLo + latHi) / 2;
      if (p.lat >= mid) {
        ch = (ch << 1) | 1;
        latLo = mid;
      } else {
        ch <<= 1;
        latHi = mid;
      }
    }
    even = !even;
    bit += 1;
    if (bit === 5) {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }
  return hash;
}

export function geohashBounds(hash: string): Bbox {
  let latLo = -90;
  let latHi = 90;
  let lngLo = -180;
  let lngHi = 180;
  let even = true;
  for (const c of hash) {
    const v = BASE32.indexOf(c);
    for (let b = 4; b >= 0; b -= 1) {
      const set = (v >> b) & 1;
      if (even) {
        const mid = (lngLo + lngHi) / 2;
        if (set) lngLo = mid;
        else lngHi = mid;
      } else {
        const mid = (latLo + latHi) / 2;
        if (set) latLo = mid;
        else latHi = mid;
      }
      even = !even;
    }
  }
  return { south: latLo, north: latHi, west: lngLo, east: lngHi };
}

/**
 * Cells within `ringM` of the sample points, found by stepping a lattice over
 * each point's ring box. At most `maxCells` (nearest-first not needed: the
 * caller samples the path sparsely).
 */
export function cellsCovering(
  points: Coordinates[],
  ringM: number,
  maxCells = 24,
): string[] {
  const cells = new Set<string>();
  for (const p of points) {
    const dLat = ringM / M_PER_DEG_LAT;
    const dLng = ringM / (M_PER_DEG_LAT * Math.cos((p.lat * Math.PI) / 180));
    // Step at a fraction of a cell (cell is ~0.0055 deg lat x 0.011 deg lng).
    for (let lat = p.lat - dLat; lat <= p.lat + dLat + 1e-9; lat += 0.004) {
      for (let lng = p.lng - dLng; lng <= p.lng + dLng + 1e-9; lng += 0.008) {
        cells.add(geohashEncode({ lat, lng }));
        if (cells.size >= maxCells) return [...cells];
      }
    }
  }
  return [...cells];
}

// ---- seams: store (precomputed cache) and reader (COG) --------------------

/** Precomputed components per cell. `null` = not cached / unavailable. */
export interface LandcoverCellStore {
  get(cell: string): Promise<LandcoverComponent[] | null>;
}

/** Reads and classifies a raster window for a cell. `null` = unavailable. */
export type LandcoverWindowReader = (cell: string) => Promise<RasterWindow | null>;

export interface LandcoverDeps {
  store?: LandcoverCellStore;
  reader?: LandcoverWindowReader;
}

/**
 * Components for the given cells. Never throws: a failing store or reader
 * means that cell contributes nothing (so offline = no detected items).
 */
export async function getLandcoverComponents(
  cells: string[],
  deps: LandcoverDeps,
): Promise<LandcoverComponent[]> {
  const out: LandcoverComponent[] = [];
  for (const cell of cells) {
    let found: LandcoverComponent[] | null = null;
    try {
      found = (await deps.store?.get(cell)) ?? null;
    } catch {
      found = null;
    }
    if (found === null && deps.reader) {
      try {
        const win = await deps.reader(cell);
        found = win ? extractComponents(win) : null;
      } catch {
        found = null;
      }
    }
    if (found) out.push(...found);
  }
  return out;
}
