import type { Coordinates } from "@/lib/types";
import { closestPointOnSegment, haversineDistance } from "@/lib/utils/geo";

export const SHORTCUT_MIN_SAVING_M = 150;
export const SHORTCUT_MIN_SAVING_RATIO = 0.15;
export const SHORTCUT_MIN_SAVING_S = 120;
export const SHORTCUT_STREET_FACTOR = 1.15;
export const SHORTCUT_MIN_CROW_M = 200;
export const SHORTCUT_MAX_CROW_M = 1_500;
export const SHORTCUT_CHECK_COOLDOWN_MS = 90_000;
export const SHORTCUT_MIN_PROGRESS_M = 150;
export const SHORTCUT_MAX_CHECKS_PER_WALK = 12;
export const SHORTCUT_OFFER_TTL_MS = 45_000;
export const SHORTCUT_OFFER_MAX_DRIFT_M = 40;
export const STOP_ON_LINE_M = 80;

/** An unvisited plan stop (pins included). */
export interface ShortcutStop {
  id: string;
  point: Coordinates;
  label: string | null;
}

export interface ShortcutTarget {
  point: Coordinates;
  /** Index of the geometry segment `point` lies on (for `spliceRoute`). */
  segmentIndex: number;
  /** Route distance from the matched point to `point`, metres. */
  alongM: number;
  /** The stop the shortcut ends at; null when it ends at the finish. */
  stopId: string | null;
  label: string | null;
}

function cumulative(geometry: Coordinates[]): number[] {
  const cum = [0];
  for (let i = 0; i < geometry.length - 1; i += 1) {
    cum.push(cum[i] + haversineDistance(geometry[i], geometry[i + 1]));
  }
  return cum;
}

/**
 * Where a shortcut may end: the projection of the nearest unvisited stop onto
 * the route ahead, so no stop is ever skipped. Null when that stop is more than
 * STOP_ON_LINE_M off the line (we cannot prove the splice would still pass it).
 * With no stops left the target is the last vertex (the finish).
 */
export function shortcutTarget(
  geometry: Coordinates[],
  segmentIndex: number,
  matchedPoint: Coordinates,
  stops: ShortcutStop[],
): ShortcutTarget | null {
  if (geometry.length < 2) return null;
  const startSeg = Math.min(Math.max(segmentIndex, 0), geometry.length - 2);
  const cum = cumulative(geometry);
  const matchedPos = cum[startSeg] + haversineDistance(geometry[startSeg], matchedPoint);

  if (stops.length === 0) {
    const alongM = cum[cum.length - 1] - matchedPos;
    if (alongM < 0) return null;
    return {
      point: geometry[geometry.length - 1],
      segmentIndex: geometry.length - 2,
      alongM,
      stopId: null,
      label: null,
    };
  }

  let best: { target: ShortcutTarget; offsetM: number } | null = null;
  for (const stop of stops) {
    // First segment ahead that passes within STOP_ON_LINE_M, else the closest.
    let pick: { seg: number; proj: Coordinates; offsetM: number; alongM: number } | null = null;
    for (let seg = startSeg; seg < geometry.length - 1; seg += 1) {
      const proj = closestPointOnSegment(stop.point, geometry[seg], geometry[seg + 1]);
      const alongM = cum[seg] + haversineDistance(geometry[seg], proj) - matchedPos;
      const offsetM = haversineDistance(stop.point, proj);
      if (pick === null || offsetM < pick.offsetM) {
        pick = { seg, proj, offsetM, alongM };
      }
      if (offsetM <= STOP_ON_LINE_M) {
        pick = { seg, proj, offsetM, alongM };
        break;
      }
    }
    // Its closest point on the route is behind the walker: not ahead, ignore it.
    if (pick === null || pick.alongM < 0) continue;
    if (best === null || pick.alongM < best.target.alongM) {
      best = {
        offsetM: pick.offsetM,
        target: {
          point: pick.proj,
          segmentIndex: pick.seg,
          alongM: pick.alongM,
          stopId: stop.id,
          label: stop.label,
        },
      };
    }
  }
  if (best === null || best.offsetM > STOP_ON_LINE_M) return null;
  return best.target;
}

export const requiredSavingM = (alongM: number, speedMps: number): number =>
  Math.max(
    SHORTCUT_MIN_SAVING_M,
    SHORTCUT_MIN_SAVING_RATIO * alongM,
    SHORTCUT_MIN_SAVING_S * speedMps,
  );

/** Local pre-filter, no network: no street path beats ~1.15 x the crow-flies gap. */
export const worthChecking = (alongM: number, crowM: number, speedMps: number): boolean =>
  crowM >= SHORTCUT_MIN_CROW_M &&
  crowM <= SHORTCUT_MAX_CROW_M &&
  alongM - crowM * SHORTCUT_STREET_FACTOR >= requiredSavingM(alongM, speedMps);

export function acceptConnector(
  alongM: number,
  connectorM: number,
  speedMps: number,
): { savingM: number; savingMin: number } | null {
  const savingM = alongM - connectorM;
  if (!(savingM >= requiredSavingM(alongM, speedMps))) return null;
  const savingMin = speedMps > 0 ? Math.max(1, Math.round(savingM / speedMps / 60)) : 1;
  return { savingM: Math.round(savingM), savingMin };
}

/** Per-walk ORS budget: cooldown, progress, a hard cap, and remembered declines. */
export class ShortcutGate {
  private checks = 0;
  private lastAtMs: number | null = null;
  private lastWalkedM = 0;
  private lastGeometry: unknown = null;
  private declinedGeometry: unknown = null;
  private declinedStops = new Set<string | null>();

  /** Cheap global checks (cap, cooldown, progress): need no stop, so run them before looking one up. */
  canCheckGlobal(atMs: number, geometry: unknown, walkedM: number): boolean {
    if (this.checks >= SHORTCUT_MAX_CHECKS_PER_WALK) return false;
    if (this.lastAtMs !== null && atMs - this.lastAtMs < SHORTCUT_CHECK_COOLDOWN_MS) return false;
    // walkedM restarts on a new geometry (after a splice or rebuild): measure from 0 there.
    const baseline = this.lastGeometry === geometry ? this.lastWalkedM : 0;
    if (Math.abs(walkedM - baseline) < SHORTCUT_MIN_PROGRESS_M) return false;
    return true;
  }

  canCheck(atMs: number, geometry: unknown, walkedM: number, stopId: string | null): boolean {
    if (!this.canCheckGlobal(atMs, geometry, walkedM)) return false;
    return !(this.declinedGeometry === geometry && this.declinedStops.has(stopId));
  }

  recordCheck(atMs: number, geometry: unknown, walkedM: number): void {
    this.checks += 1;
    this.lastAtMs = atMs;
    this.lastWalkedM = walkedM;
    this.lastGeometry = geometry;
  }

  decline(geometry: unknown, stopId: string | null): void {
    if (this.declinedGeometry !== geometry) {
      this.declinedGeometry = geometry;
      this.declinedStops = new Set();
    }
    this.declinedStops.add(stopId);
  }

  reset(): void {
    this.checks = 0;
    this.lastAtMs = null;
    this.lastWalkedM = 0;
    this.lastGeometry = null;
    this.declinedGeometry = null;
    this.declinedStops = new Set();
  }
}

export type ShortcutLang = "en" | "he";

export const shortcutCopy = {
  en: {
    title: (stop: string | null) =>
      stop ? `Shorter way to ${stop}` : "Shorter way to the finish",
    body: (min: number, m: number) => `Saves about ${min} min (${m} m).`,
    accept: "Take it",
    keep: "Keep my route",
  },
  he: {
    title: (stop: string | null) =>
      stop ? `יש דרך קצרה יותר אל ${stop}` : "יש דרך קצרה יותר לסיום",
    body: (min: number, m: number) => `חוסך בערך ${min} דק׳ (${m} מ׳).`,
    accept: "כן, בדרך הקצרה",
    keep: "להישאר במסלול",
  },
} as const;
