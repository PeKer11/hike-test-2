/**
 * Every number that sets how often the live-walk engine looks at something, and
 * how sensitive it is when it does. One file so the cadence can be read (and
 * tuned) in one place — see docs/INTERACTIVE_WALK_SPEC.md section 2 for why each
 * value is what it is.
 *
 * Time windows are always measured against *fix timestamps*, never `Date.now()`:
 * the simulator's clock runs ahead of the wall clock.
 */

// --- GPS watch -------------------------------------------------------------
export const GPS_MAX_AGE_MS = 5_000;
export const GPS_TIMEOUT_MS = 20_000;
/** The dot on the map accepts a fix this good... */
export const DOT_MAX_ACCURACY_M = 100;
/** ...but speed / deviation / POI logic only trusts fixes this good. */
export const ENGINE_MAX_ACCURACY_M = 50;
/** UI state is pushed at most this often. */
export const UI_UPDATE_MIN_INTERVAL_MS = 1_000;

// --- Ticker ----------------------------------------------------------------
export const WALK_TICK_MS = 5_000;

// --- Speed -----------------------------------------------------------------
export const SPEED_DOPPLER_WINDOW_MS = 10_000;
export const SPEED_POSITION_WINDOW_MS = 30_000;
export const SPEED_MAX_ACCURACY_M = 35;
export const SPEED_MAX_JUMP_MPS = 3.5;
export const SPEED_SMOOTHING_ALPHA = 0.35;
export const PAUSED_WINDOW_MS = 20_000;
export const PAUSED_MIN_MOVE_M = 8;

// --- Pace advisory (cards only; never rebuilds on its own) ------------------
export const PACE_ADVISOR_WINDOW_MS = 5 * 60_000;
export const ADVISOR_SLOW_RATIO = 1.3;
export const ADVISOR_SLOW_CLEAR_RATIO = 1.15;
export const ADVISOR_FAST_RATIO = 0.77;
export const ADVISOR_FAST_CLEAR_RATIO = 0.87;
export const ADVISOR_CARD_COOLDOWN_MS = 6 * 60_000;
export const ADVISOR_STOP_QUIET_RADIUS_M = 100;
/** A pace card that has been on screen this long (wall clock, not fix time) takes itself down. */
export const ADVISOR_CARD_TTL_MS = 60_000;

// --- Off route -------------------------------------------------------------
export const OFF_ROUTE_ON_M = 50;
export const OFF_ROUTE_OFF_M = 30;
export const OFF_ROUTE_MAX_ACCURACY_M = 50;
export const OFF_ROUTE_THROTTLE_MS = 1_000;

// --- Way-back route --------------------------------------------------------
export const LOCAL_REJOIN_COOLDOWN_MS = 60_000;
/** Beyond this the walker is not "near" the route; a full re-plan is honest. */
export const LOCAL_REJOIN_MAX_DEVIATION_M = 400;

// --- Nearby places ---------------------------------------------------------
export const NEARBY_CORRIDOR_RADIUS_M = 250;
export const NEARBY_PATH_MAX_POINTS = 80;
export const NEARBY_POINT_TRIGGER_M = 200;
export const NEARBY_POINT_RADIUS_M = 300;
export const NEARBY_POINT_CELL_DEG = 0.002;
export const NEARBY_POINT_CACHE_MS = 10 * 60_000;
export const NEARBY_POINT_MIN_GAP_MS = 2 * 60_000;

// --- Announcements ---------------------------------------------------------
export const ANNOUNCE_GLOBAL_GAP_MS = 90_000;
export const ANNOUNCE_MAX_ACTIVE = 2;
export const ANNOUNCE_CATEGORY_COOLDOWN_MS = 10 * 60_000;
export const ANNOUNCE_MAX_DISTANCE_M = 150;
export const ANNOUNCE_EXPIRE_MS = 30_000;
export const ANNOUNCE_EXPIRE_BEHIND_M = 60;
export const SCENERY_COOLDOWN_MS = 10 * 60_000;

export * from "./discovery-cadence";
