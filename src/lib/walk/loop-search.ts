import type { Coordinates } from "@/lib/types";
import { haversineDistance } from "@/lib/utils/geo";

/** Up to this many stops are ordered by trying every permutation (7! = 5040). */
const BRUTE_FORCE_MAX = 7;

/**
 * Visiting order of stops 1..n given street distances (index 0 = start).
 * Shortest total, closing back to the start when `loop`; nearest-neighbour above BRUTE_FORCE_MAX.
 */
export function bestOrder(dist: number[][], loop: boolean): number[] {
  const n = dist.length - 1;
  const d = (a: number, b: number) => dist[a]?.[b] ?? Infinity;
  const cost = (order: number[]) => {
    let at = 0;
    let sum = 0;
    for (const j of order) {
      sum += d(at, j);
      at = j;
    }
    return loop ? sum + d(at, 0) : sum;
  };
  if (n > BRUTE_FORCE_MAX) {
    const left = new Set(Array.from({ length: n }, (_, i) => i + 1));
    const order: number[] = [];
    let at = 0;
    while (left.size) {
      let best = -1;
      for (const j of left) if (best < 0 || d(at, j) < d(at, best)) best = j;
      order.push(best);
      left.delete(best);
      at = best;
    }
    return order;
  }
  let best: number[] = [];
  let bestCost = Infinity;
  const permute = (rest: number[], picked: number[]) => {
    if (rest.length === 0) {
      const c = cost(picked);
      if (c < bestCost) {
        bestCost = c;
        best = picked;
      }
      return;
    }
    rest.forEach((j, i) => permute([...rest.slice(0, i), ...rest.slice(i + 1)], [...picked, j]));
  };
  permute(Array.from({ length: n }, (_, i) => i + 1), []);
  return best;
}

/** Picks `k` points that are as far apart as possible (greedy k-center), starting from the one nearest `center`. */
export function pickSpread<T extends { coordinates: Coordinates }>(items: T[], k: number, center: Coordinates): T[] {
  if (items.length <= k) return [...items];
  const chosen = [items.reduce((a, b) => (haversineDistance(center, b.coordinates) < haversineDistance(center, a.coordinates) ? b : a))];
  while (chosen.length < k) {
    let best: T | null = null;
    let bestGap = -1;
    for (const it of items) {
      if (chosen.includes(it)) continue;
      const gap = Math.min(...chosen.map((c) => haversineDistance(c.coordinates, it.coordinates)));
      if (gap > bestGap) {
        bestGap = gap;
        best = it;
      }
    }
    if (!best) break;
    chosen.push(best);
  }
  return chosen;
}

/** A town outline: polygons made of rings of [lng, lat] points (first ring of each polygon is the outer one; holes are ignored). */
export type Boundary = number[][][];

function inRing(p: Coordinates, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > p.lat !== yj > p.lat && p.lng < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function insideBoundary(p: Coordinates, boundary: Boundary): boolean {
  return boundary.some((ring) => inRing(p, ring));
}

/** Kilometres of `path` (sampled every `stepM`) that lie outside the boundary. */
export function outsideKm(path: Coordinates[], boundary: Boundary, stepM = 25): number {
  let outside = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const len = haversineDistance(a, b);
    const steps = Math.max(1, Math.ceil(len / stepM));
    for (let s = 0; s < steps; s++) {
      const t = (s + 0.5) / steps;
      const mid = { lat: a.lat + t * (b.lat - a.lat), lng: a.lng + t * (b.lng - a.lng) };
      if (!insideBoundary(mid, boundary)) outside += len / steps;
    }
  }
  return Math.round(outside / 100) / 10;
}
