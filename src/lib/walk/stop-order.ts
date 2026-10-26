/** What the walker said about the order of the stops. A ref is a candidate id, or "kind:<category>" for the first stop of that kind. */
export interface StopOrder {
  first?: string;
  last?: string;
  /** The walk ends at this stop (so it is not a loop). */
  endAt?: string;
  /** [a, b]: a comes before b. */
  before?: Array<[string, string]>;
}

export interface OrderStop {
  id: string;
  category: string;
}

/** Index in `stops` that a ref points at, or -1. */
function resolve(ref: string, stops: OrderStop[]): number {
  if (ref.startsWith("kind:")) return stops.findIndex((s) => s.category === ref.slice(5));
  return stops.findIndex((s) => s.id === ref);
}

/** Like `resolve`, but a "kind:" ref points at the LAST stop of that kind (for "ends at / last is a cafe"). */
function resolveLast(ref: string, stops: OrderStop[]): number {
  if (ref.startsWith("kind:")) return stops.map((s) => s.category).lastIndexOf(ref.slice(5));
  return stops.findIndex((s) => s.id === ref);
}

/** Refs that do not match any stop of the walk. */
export function unresolvedRefs(order: StopOrder | undefined, stops: OrderStop[]): string[] {
  if (!order) return [];
  const refs = [order.first, order.last, order.endAt, ...(order.before ?? []).flat()].filter((r): r is string => Boolean(r));
  return [...new Set(refs.filter((r) => resolve(r, stops) === -1))];
}

/** Does this visiting order (list of stops) obey every rule it can check? Rules about stops that are not in the walk are skipped. */
export function satisfies(sequence: OrderStop[], order: StopOrder | undefined): boolean {
  if (!order) return true;
  const at = (ref?: string) => (ref ? resolve(ref, sequence) : -1);
  const n = sequence.length;
  if (order.first && at(order.first) > -1 && at(order.first) !== 0) return false;
  for (const ref of [order.endAt, order.last]) {
    if (!ref) continue;
    const k = resolveLast(ref, sequence);
    if (k > -1 && k !== n - 1) return false;
  }
  for (const [a, b] of order.before ?? []) {
    const ia = at(a);
    const ib = at(b);
    if (ia > -1 && ib > -1 && ia >= ib) return false;
  }
  return true;
}

/**
 * Cheapest visiting order that obeys `order`. `dist[i][j]` is the distance between points (0 = start, i = stop i-1).
 * Exact up to 7 stops; above that, the unconstrained tour is repaired by moving offenders.
 * Returns 1-based stop indexes, or null when no order can satisfy the rules.
 */
export function bestOrderWithRules(dist: number[][], loop: boolean, stops: OrderStop[], order: StopOrder | undefined): number[] | null {
  const n = stops.length;
  const cost = (seq: number[]) => {
    let at = 0;
    let c = 0;
    for (const i of seq) {
      c += dist[at][i] ?? 0;
      at = i;
    }
    return c + (loop ? (dist[at][0] ?? 0) : 0);
  };
  const ok = (seq: number[]) => satisfies(seq.map((i) => stops[i - 1]), order);
  if (n <= 7) {
    let best: number[] | null = null;
    let bestCost = Infinity;
    const walk = (rest: number[], acc: number[]) => {
      if (!rest.length) {
        if (!ok(acc)) return;
        const c = cost(acc);
        if (c < bestCost) {
          bestCost = c;
          best = acc;
        }
        return;
      }
      rest.forEach((x, k) => walk([...rest.slice(0, k), ...rest.slice(k + 1)], [...acc, x]));
    };
    walk(Array.from({ length: n }, (_, i) => i + 1), []);
    return best;
  }
  // Greedy: nearest next stop among those whose "before" partners are already placed.
  const placed: number[] = [];
  const left = new Set(Array.from({ length: n }, (_, i) => i + 1));
  let at = 0;
  while (left.size) {
    const candidates = [...left].filter((i) => {
      if (left.size > 1 && order && ((order.last && resolveLast(order.last, stops) === i - 1) || (order.endAt && resolveLast(order.endAt, stops) === i - 1))) return false;
      return !(order?.before ?? []).some(([a, b]) => resolve(b, stops) === i - 1 && left.has(resolve(a, stops) + 1) && resolve(a, stops) > -1);
    });
    const pool = placed.length === 0 && order?.first && resolve(order.first, stops) > -1 ? [resolve(order.first, stops) + 1] : candidates;
    if (!pool.length) return null;
    const next = pool.reduce((a, b) => ((dist[at][b] ?? 0) < (dist[at][a] ?? 0) ? b : a));
    placed.push(next);
    left.delete(next);
    at = next;
  }
  return ok(placed) ? placed : null;
}
