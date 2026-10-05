import type { AttractionCategory, Coordinates } from "@/lib/types";
import type {
  CalloutLevel,
  DiscoveryCollection,
  DiscoveryItem,
  DiscoveryTier,
  RouteFrame,
  WalkEnvironment,
} from "@/lib/types/discovery";
import type { Relation } from "@/lib/walk/poi-relation";
import { angleDifference, bearingBetween } from "@/lib/utils/geo";
import {
  ALONG_BEHIND_SLACK_M,
  CALLOUT_WINDOW_MS,
  ENV_LIMITS,
  FAST_GAP_MULTIPLIER,
  FAST_KMH,
  FAST_LATERAL_MULTIPLIER,
  FAST_PLAN_RATIO,
  LEVELS,
  ON_SCREEN_WITH_CARD,
  TURN_ANGLE_DEG,
  TURN_QUIET_M,
  WIKI_ONLY_MAX_LATERAL_M,
} from "./discovery-cadence";

/** One thing already announced to the walker, for the rate rules. */
export interface AnnouncementRecord {
  atMs: number;
  category: AttractionCategory;
  tier: DiscoveryTier;
}

export interface CalloutContext {
  nearTurn: boolean;
  /** Within 100 m of an unvisited stop. */
  nearStop: boolean;
  /** An alert card is on screen. */
  cardVisible: boolean;
  /** "Paused" at a stop. */
  paused: boolean;
  offRoute: boolean;
  /** Callouts currently showing. */
  onScreen: number;
  history: AnnouncementRecord[];
  planStopIds: ReadonlySet<string>;
  preferred: AttractionCategory[];
  /** Planned walking speed, to tell when the walker is hurrying. */
  planSpeedMps?: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function isFast(speedMps: number, planSpeedMps: number | undefined): boolean {
  return (
    speedMps * 3.6 > FAST_KMH ||
    (planSpeedMps !== undefined &&
      planSpeedMps > 0 &&
      speedMps > planSpeedMps * FAST_PLAN_RATIO)
  );
}

function isNotable(item: DiscoveryItem): boolean {
  return (
    item.kind === "scenery" ||
    item.notable ||
    item.attraction.category === "landmark"
  );
}

/** Largest cross-track distance at which this item is worth announcing. */
export function lateralLimitM(
  env: WalkEnvironment,
  item: DiscoveryItem,
  level: CalloutLevel,
  fast = false,
): number {
  const limits = ENV_LIMITS[env];
  const base = isNotable(item) ? limits.seeItNotableM : limits.seeItPoiM;
  const wikiOnly = item.sources.every(
    (s) => s === "wikipedia" || s === "wikidata",
  );
  const scaled =
    base * LEVELS[level].lateralMultiplier * (fast ? FAST_LATERAL_MULTIPLIER : 1);
  return wikiOnly ? Math.min(scaled, WIKI_ONLY_MAX_LATERAL_M) : scaled;
}

function pointAt(geometry: Coordinates[], cumDist: number[], m: number): Coordinates {
  const total = cumDist[cumDist.length - 1];
  const d = clamp(m, 0, total);
  let i = 0;
  while (i < geometry.length - 2 && cumDist[i + 1] < d) i += 1;
  const span = cumDist[i + 1] - cumDist[i];
  const t = span === 0 ? 0 : (d - cumDist[i]) / span;
  return {
    lat: geometry[i].lat + t * (geometry[i + 1].lat - geometry[i].lat),
    lng: geometry[i].lng + t * (geometry[i + 1].lng - geometry[i].lng),
  };
}

/** A route turn (heading change > 45 degrees) within `windowM` of the walker. */
export function isNearTurn(
  geometry: Coordinates[],
  cumDist: number[],
  walkerAlongM: number,
  windowM = TURN_QUIET_M,
): boolean {
  if (geometry.length < 3) return false;
  for (let i = 1; i < geometry.length - 1; i += 1) {
    if (Math.abs(cumDist[i] - walkerAlongM) > windowM) continue;
    const before = bearingBetween(geometry[i - 1], geometry[i]);
    const after = bearingBetween(geometry[i], geometry[i + 1]);
    if (angleDifference(before, after) > TURN_ANGLE_DEG) return true;
  }
  // Gradual bends: compare the heading into and out of the walker's position.
  const here = pointAt(geometry, cumDist, walkerAlongM);
  const behind = pointAt(geometry, cumDist, walkerAlongM - windowM);
  const ahead = pointAt(geometry, cumDist, walkerAlongM + windowM);
  return (
    angleDifference(bearingBetween(behind, here), bearingBetween(here, ahead)) >
    TURN_ANGLE_DEG
  );
}

function tierAllowed(
  item: DiscoveryItem,
  level: CalloutLevel,
  ctx: CalloutContext,
  nowFix: number,
): boolean {
  if (ctx.planStopIds.has(item.id)) return true;
  const rules = LEVELS[level];
  if (!rules.tiers.includes(item.tier)) return false;
  if (
    rules.requireNotableOrPreferred &&
    !(item.notable || ctx.preferred.includes(item.attraction.category))
  ) {
    return false;
  }
  if (item.tier === "mapped-unnamed") {
    const recent = ctx.history.filter(
      (h) => h.tier === "mapped-unnamed" && nowFix - h.atMs < CALLOUT_WINDOW_MS,
    ).length;
    if (recent >= rules.mappedUnnamedPer10Min) return false;
  }
  return true;
}

function rank(item: DiscoveryItem, ctx: CalloutContext): number[] {
  return [
    ctx.planStopIds.has(item.id) ? 1 : 0,
    ctx.preferred.includes(item.attraction.category) ? 1 : 0,
    item.notable ? 1 : 0,
    item.score,
  ];
}

/**
 * Items worth announcing right now, best first, already trimmed to what the
 * level's budgets still allow. Pure and local: run it on every accepted fix.
 * Plan stops skip the tier and lateral tests; the quiet zones (turn, near a
 * stop, paused, off route) silence everything except the stop itself.
 */
export function eligibleForCallout(
  col: DiscoveryCollection,
  walkerAlongM: number,
  speedMps: number,
  env: WalkEnvironment,
  level: CalloutLevel,
  ctx: CalloutContext,
  nowFix: number,
): DiscoveryItem[] {
  if (ctx.nearTurn || ctx.paused || ctx.offRoute) return [];

  const rules = LEVELS[level];
  const fast = isFast(speedMps, ctx.planSpeedMps);
  const gapMs = rules.globalGapMs * (fast ? FAST_GAP_MULTIPLIER : 1);
  const last = ctx.history.reduce((m, h) => Math.max(m, h.atMs), -Infinity);
  if (nowFix - last < gapMs) return [];

  const recent = ctx.history.filter((h) => nowFix - h.atMs < CALLOUT_WINDOW_MS);
  const onScreenCap = ctx.cardVisible
    ? Math.min(rules.onScreen, ON_SCREEN_WITH_CARD)
    : rules.onScreen;
  const capacity = Math.min(
    onScreenCap - ctx.onScreen,
    rules.per10Min - recent.length,
  );
  if (capacity <= 0) return [];

  const limits = ENV_LIMITS[env];
  const lookAhead = clamp(
    speedMps * limits.lookAheadSeconds,
    limits.lookAheadMinM,
    limits.lookAheadMaxM,
  );

  const eligible = [...col.items.values()].filter((item) => {
    if (item.state !== "new" || item.frame === null) return false;
    const isStop = ctx.planStopIds.has(item.id);
    if (ctx.nearStop && !isStop) return false;
    const { alongM, lateralM } = item.frame;
    if (walkerAlongM < alongM - lookAhead || walkerAlongM > alongM + ALONG_BEHIND_SLACK_M) {
      return false;
    }
    if (!isStop && Math.abs(lateralM) > lateralLimitM(env, item, level, fast)) {
      return false;
    }
    if (!tierAllowed(item, level, ctx, nowFix)) return false;
    const cooling = ctx.history.some(
      (h) =>
        h.category === item.attraction.category &&
        nowFix - h.atMs < rules.categoryCooldownMs,
    );
    return !cooling || isStop;
  });

  eligible.sort((a, b) => {
    const ra = rank(a, ctx);
    const rb = rank(b, ctx);
    for (let i = 0; i < ra.length; i += 1) {
      if (ra[i] !== rb[i]) return rb[i] - ra[i];
    }
    return 0;
  });
  return eligible.slice(0, capacity);
}

const HERE_M = 25;
// A place within 30 degrees of straight on: along > lateral / tan(30 deg).
const AHEAD_ALONG_PER_LATERAL = 1 / Math.tan((30 * Math.PI) / 180);

/**
 * "Left / right / ahead" for an on-route walker, from the place's cross-track
 * frame and the walker's own distance along the route. No heading is involved,
 * so a jittery GPS bearing can never flip a callout to the wrong side.
 */
export function frameRelation(
  frame: RouteFrame,
  walkerAlongM: number,
  distanceM: number,
): Relation {
  if (distanceM < HERE_M) return "here";
  const dAlong = frame.alongM - walkerAlongM;
  const lateral = Math.abs(frame.lateralM);
  if (dAlong > lateral * AHEAD_ALONG_PER_LATERAL) return "ahead";
  if (dAlong < -lateral * AHEAD_ALONG_PER_LATERAL) return "behind";
  if (frame.side === "on") return dAlong >= 0 ? "ahead" : "behind";
  return frame.side;
}
