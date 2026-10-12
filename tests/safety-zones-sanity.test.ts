import { describe, expect, it } from "vitest";

import { distanceToPath } from "@/lib/places/path";
import { classifyPoint } from "@/lib/places/safety-zones";

/**
 * Sanity PROPERTY test over a grid: no allowed point may lie within MARGIN_M of
 * a rough foreign border polyline, nor inside a rough West Bank / Gaza box.
 *
 * The polylines are ROUGH, hand-written from memory and deliberately nudged
 * toward Israel (conservative: a point that passes here is farther from the
 * real border than the margin). They are NOT surveyed data and do not replace
 * a human review; they only catch gross regressions in safety-zones.ts.
 * [lat, lng].
 */
const MARGIN_M = 3000;
const ll = (pts: Array<[number, number]>) => pts.map(([lat, lng]) => ({ lat, lng }));

const BORDERS: Record<string, ReturnType<typeof ll>> = {
  lebanon: ll([
    [33.09, 35.1],
    [33.08, 35.25],
    [33.085, 35.4],
    [33.098, 35.509], // Malkia
    [33.14, 35.535],
    [33.21, 35.57], // Kiryat Shmona side
    [33.28, 35.6], // Metula
    [33.33, 35.63],
  ]),
  syria: ll([
    [33.33, 35.63],
    [33.3, 35.78],
    [33.1, 35.8],
    [32.9, 35.82],
    [32.7, 35.8],
    [32.64, 35.64], // Yarmouk mouth
  ]),
  jordan: ll([
    [32.64, 35.58],
    [32.4, 35.55],
    [32.1, 35.55],
    [31.77, 35.54],
    [31.5, 35.45],
    [31.2, 35.42],
    [30.9, 35.33],
    [30.6, 35.22],
    [30.3, 35.17],
    [30.0, 35.1],
    [29.8, 35.03],
    [29.62, 35.0],
    [29.53, 34.97], // Eilat / Aqaba
  ]),
  egypt: ll([
    [31.25, 34.3],
    [30.9, 34.46],
    [30.53, 34.65],
    [30.03, 34.83],
    [29.53, 34.93],
  ]),
};

/** Rough boxes: [south, north, west, east]. West Jerusalem core is outside by construction. */
const BOXES: Record<string, [number, number, number, number]> = {
  // The strip is a wedge: wide in the north, narrow at Rafah (east edge ~34.38 at lat 31.3).
  "gaza-north": [31.5, 31.6, 34.2, 34.55],
  "gaza-middle": [31.4, 31.5, 34.2, 34.48],
  "gaza-south": [31.27, 31.4, 34.2, 34.4],
  "west-bank-north": [31.86, 32.55, 35.05, 35.55],
  "west-bank-south": [31.3, 31.72, 34.95, 35.55],
  "west-bank-east-of-jerusalem": [31.72, 31.86, 35.26, 35.55],
};

function* grid(step: number) {
  for (let lat = 29.3; lat <= 33.7; lat += step) {
    for (let lng = 33.8; lng <= 36.3; lng += step) yield { lat, lng };
  }
}

describe("safety zones: grid sanity property (rough borders, documented above)", () => {
  const allowed: Array<{ lat: number; lng: number }> = [];
  for (const p of grid(0.005)) if (classifyPoint(p).status === "allowed") allowed.push(p);

  it("the grid finds a non-trivial allowed area (guards against an all-denied pass)", () => {
    expect(allowed.length).toBeGreaterThan(5000);
  });

  it.each(Object.keys(BORDERS))("no allowed point within 3 km of the %s border", (name) => {
    const bad = allowed.filter((p) => distanceToPath(p, BORDERS[name]) < MARGIN_M);
    expect(bad.slice(0, 5).map((p) => `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`)).toEqual([]);
  });

  it.each(Object.keys(BOXES))("no allowed point inside the rough %s box", (name) => {
    const [s, n, w, e] = BOXES[name];
    const bad = allowed.filter((p) => p.lat >= s && p.lat <= n && p.lng >= w && p.lng <= e);
    expect(bad.slice(0, 5).map((p) => `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`)).toEqual([]);
  });
});
