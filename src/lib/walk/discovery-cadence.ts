import type {
  CalloutLevel,
  DiscoveryTier,
  WalkEnvironment,
} from "@/lib/types/discovery";

// Every number of the discovery / callout / collapse design lives here.
// Lateral distances are tunable guesses (urban medium confidence, park/rural
// low-medium): tune from telemetry (shown -> tapped -> added -> visited).

export interface EnvLimits {
  /** Show a plain POI up to this far (cross-track) from the route. */
  seeItPoiM: number;
  /** Show a landmark / scenery / notable place up to this far. */
  seeItNotableM: number;
  /** Offer a detour to a place up to this far, one way. */
  detourOfferM: number;
  lookAheadSeconds: number;
  lookAheadMinM: number;
  lookAheadMaxM: number;
}

export const ENV_LIMITS: Record<WalkEnvironment, EnvLimits> = {
  urban: {
    seeItPoiM: 40,
    seeItNotableM: 80,
    detourOfferM: 150,
    lookAheadSeconds: 45,
    lookAheadMinM: 40,
    lookAheadMaxM: 100,
  },
  park: {
    seeItPoiM: 100,
    seeItNotableM: 200,
    detourOfferM: 300,
    lookAheadSeconds: 45,
    lookAheadMinM: 50,
    lookAheadMaxM: 120,
  },
  rural: {
    seeItPoiM: 150,
    seeItNotableM: 400,
    detourOfferM: 500,
    lookAheadSeconds: 60,
    lookAheadMinM: 60,
    lookAheadMaxM: 150,
  },
};

export interface LevelRules {
  globalGapMs: number;
  onScreen: number;
  per10Min: number;
  categoryCooldownMs: number;
  lateralMultiplier: number;
  /** Tiers allowed as plain callouts (plan stops are always allowed). */
  tiers: readonly DiscoveryTier[];
  /** Max mapped-unnamed scenery callouts per 10 min. */
  mappedUnnamedPer10Min: number;
  /** Quiet only announces plan stops and notable / preferred places. */
  requireNotableOrPreferred: boolean;
}

const TEN_MIN_MS = 10 * 60_000;
export const CALLOUT_WINDOW_MS = TEN_MIN_MS;

export const LEVELS: Record<CalloutLevel, LevelRules> = {
  quiet: {
    globalGapMs: 5 * 60_000,
    onScreen: 1,
    per10Min: 2,
    categoryCooldownMs: 15 * 60_000,
    lateralMultiplier: 0.6,
    tiers: ["registered"],
    mappedUnnamedPer10Min: 0,
    requireNotableOrPreferred: true,
  },
  normal: {
    globalGapMs: 90_000,
    onScreen: 2,
    per10Min: 4,
    categoryCooldownMs: 10 * 60_000,
    lateralMultiplier: 1,
    tiers: ["registered", "mapped-unnamed"],
    mappedUnnamedPer10Min: 1,
    requireNotableOrPreferred: false,
  },
  chatty: {
    globalGapMs: 45_000,
    onScreen: 2,
    per10Min: 6,
    categoryCooldownMs: 5 * 60_000,
    lateralMultiplier: 1.25,
    tiers: ["registered", "mapped-unnamed", "crowd-signal", "detected"],
    mappedUnnamedPer10Min: Infinity,
    requireNotableOrPreferred: false,
  },
};

/** Normal shows one callout while an alert card is up. */
export const ON_SCREEN_WITH_CARD = 1;

// --- Callout gates ---------------------------------------------------------
export const TURN_QUIET_M = 30;
export const TURN_ANGLE_DEG = 45;
export const STOP_QUIET_M = 100;
export const FAST_PLAN_RATIO = 1.2;
export const FAST_KMH = 5.5;
export const FAST_GAP_MULTIPLIER = 1.5;
export const FAST_LATERAL_MULTIPLIER = 0.8;
/** A place this far behind the walker has been passed. */
export const ALONG_BEHIND_SLACK_M = 20;
/** Wikipedia-only places are a boost, never shown far from the route. */
export const WIKI_ONLY_MAX_LATERAL_M = 150;
export const WALK_SPEED_MPS_FALLBACK = 1.35;

// --- Route frame / environment --------------------------------------------
export const FRAME_ON_ROUTE_M = 8;
export const FRAME_END_SLACK_M = 50;
export const URBAN_DENSITY_PER_KM = 12;
export const RURAL_DENSITY_PER_KM = 3;

// --- Detour time rule ------------------------------------------------------
export const DETOUR_FACTOR = 1.25;
export const DETOUR_MAX_MIN = 8;
export const DETOUR_MIN_MIN = 3;
export const DETOUR_SHARE = 0.12;

// --- Collection ------------------------------------------------------------
export const RING_RADIUS_M = 600;
export const MERGE_MATCH_M = 50;
export const COVER_SAMPLE_M = 20;
export const COVER_MIN_FRACTION = 0.9;
export const COVER_RING_MARGIN_M = 150;
export const SCORE_TIER_WEIGHT: Record<DiscoveryTier, number> = {
  registered: 1,
  "mapped-unnamed": 0.6,
  "crowd-signal": 0.5,
  detected: 0.3,
};
export const SCORE_PREFERRED_BONUS = 1;
export const SCORE_NOTABLE_BONUS = 0.8;
export const SCORE_PHOTO_CAP = 0.6;
export const SCORE_PHOTO_DIVISOR = 3;
export const SCORE_DETOUR_PENALTY_PER_MIN = 0.08;

// --- Wikipedia / Commons scans ---------------------------------------------
export const WIKI_USER_AGENT = "HikingRoutePlanner/1.0 (contact: hiking-planner)";
export const WIKI_TIMEOUT_MS = 8_000;
export const WIKI_SAMPLE_EVERY_M = 1_500;
export const WIKI_MAX_POINTS = 4;
export const WIKI_MAX_CALLS = 8;
export const WIKI_RADIUS_M = 800;
export const WIKI_LIMIT = 50;
export const WIKI_PLACE_MATCH_M = 75;
export const COMMONS_MAX_CALLS = 4;
export const COMMONS_RADIUS_M = 400;
export const COMMONS_LIMIT = 200;
export const COMMONS_CELL_M = 50;
export const COMMONS_CELL_MIN_FILES = 8;
/** Inside this box Hebrew Wikipedia is searched as well as English. */
export const ISRAEL_BBOX = { minLat: 29.4, maxLat: 33.4, minLng: 34.2, maxLng: 35.95 };

// --- Overlap ---------------------------------------------------------------
export const OVERLAP_TOL_M = 25;
export const OVERLAP_STEP_M = 20;
export const OVERLAP_SKIP_FIRST_M = 100;
export const OVERLAP_MAX_WALKED = 0.25;
export const OVERLAP_MAX_PAIR = 0.5;
export const OVERLAP_MAX_PLAN = 0.6;

// --- Collapse --------------------------------------------------------------
/**
 * Equals `LOCAL_REJOIN_MAX_DEVIATION_M` (a test pins that). A literal, not an
 * import: `walk-cadence` re-exports this file, and a value import back the other
 * way is a cycle that reads an uninitialised binding if `walk-cadence` loads first.
 */
export const COLLAPSE_DEVIATION_M = 400;
export const COLLAPSE_SUSTAIN_MS = 60_000;
export const COLLAPSE_OFF_ROUTE_MAX_MS = 8 * 60_000;
export const COLLAPSE_COOLDOWN_MS = 10 * 60_000;
export const COLLAPSE_MAX_PER_WALK = 4;
/** Sustained off-route time before the first local rejoin attempt. */
export const COLLAPSE_REJOIN_DELAY_MS = 30_000;
export const COLLAPSE_REJOIN_FAILURES = 2;
/** Back within this of the old route ends a collapse. */
export const COLLAPSE_RETURN_M = 30;

// --- Direction options -----------------------------------------------------
export const OPTIONS_MAX = 3;
export const OPTIONS_MAX_STOPS = 4;
export const OPTIONS_WALKED_MAX_POINTS = 60;
export const OPTIONS_SECTOR_DEG = 60;
export const OPTIONS_SECTOR_COUNT = 6;
export const OPTIONS_CAME_FROM_HALF_DEG = 45;
export const OPTIONS_CAME_FROM_LOOKBACK_M = 300;
export const OPTIONS_REACH_DETOUR = 1.3;
export const OPTIONS_SHORT_FRACTION = 0.6;
export const OPTIONS_TOP_PER_SECTOR = 3;
export const OPTIONS_ROUNDTRIP_FACTOR = 0.8;
export const OPTIONS_ROUNDTRIP_POINTS = 3;
export const OPTIONS_ROUNDTRIP_NEAR_ANCHOR_M = 300;
export const OPTIONS_ROUNDTRIP_MIN_M = 500;
export const OPTIONS_ROUNDTRIP_MAX_M = 50_000;
export const OPTIONS_SEED_MAX = 1_000;
export const OPTIONS_ALT_TARGET_COUNT = 2;
export const OPTIONS_ALT_SHARE_FACTOR = 0.5;
export const OPTIONS_ALT_WEIGHT_FACTOR = 1.6;
export const OPTIONS_MAX_CROW_M = 30_000;
export const OPTIONS_MAX_DIRECTIONS_CALLS = 4;
export const OPTIONS_PLAN_MAX_POINTS = 200;
export const AVOID_BUFFER_M = 20;
export const AVOID_KEEP_DISK_M = 80;
export const AVOID_MAX_EXTENT_M = 20_000;
