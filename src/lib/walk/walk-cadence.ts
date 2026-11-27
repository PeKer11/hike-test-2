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
/** The dot on the map accepts a fix this good (drawn with an accuracy halo)... */
export const DOT_MAX_ACCURACY_M = 150;
/** ...but speed / deviation / POI logic only trusts fixes this good. */
export const ENGINE_MAX_ACCURACY_M = 50;
/** UI state is pushed at most this often. */
export const UI_UPDATE_MIN_INTERVAL_MS = 1_000;

// --- Camera ----------------------------------------------------------------
/** Following the walker, the map is at least this close (street level: about 1 m per pixel). */
export const WALK_FOLLOW_ZOOM = 17;

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
/** The paused threshold never grows past this, however poor the fix: 20 s of walking at 1.4 m/s is 28 m. */
export const PAUSED_MAX_MOVE_M = 15;

// --- Walked trail (the gold line) --------------------------------------------
/** A fix worse than this never becomes a trail point. */
export const TRAIL_MAX_ACCURACY_M = ENGINE_MAX_ACCURACY_M;
/** A trail point is at least this far from the last one... */
export const TRAIL_MIN_STEP_M = 8;
/** ...or the fix accuracy, if larger, up to this cap (a 30 m phone still draws a line while walking). */
export const TRAIL_MAX_STEP_M = 15;
/** A fix worse than this is judged against the average of the last few, so its noise alone cannot draw a point. */
export const TRAIL_SMOOTH_ABOVE_ACCURACY_M = 15;
export const TRAIL_SMOOTH_FIXES = 4;
export const TRAIL_SMOOTH_WINDOW_MS = 6_000;

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

// --- Live speed (what the walker sees; Doppler only) ----------------------------
/** The live reading is the median of the device speeds in this window. */
export const SPEED_LIVE_WINDOW_MS = 3_000;
/** Moving → paused below this (1.3 km/h)... */
export const SPEED_STOP_BELOW_MPS = 0.35;
/** ...and paused → moving at or above this (2.2 km/h). */
export const SPEED_MOVE_ABOVE_MPS = 0.6;
/** Time constant of the shown value's smoothing. */
export const SPEED_LIVE_TAU_MS = 2_000;

// --- Dot stabilizer (the shown dot holds while the phone stands) --------------
/** A held dot moves only for fixes farther than max(this, the fix's accuracy). */
export const DOT_ESCAPE_MIN_M = 15;
/** Doppler says standing: only this many agreeing fixes, over this long, all beyond the radius, move the dot. */
export const DOT_ESCAPE_FIXES_STOPPED = 10;
export const DOT_ESCAPE_SPAN_STOPPED_MS = 10_000;
/** No Doppler at all (Wi-Fi/cell phone): this many agreeing fixes over this long. */
export const DOT_ESCAPE_FIXES_NODOP = 2;
export const DOT_ESCAPE_SPAN_NODOP_MS = 2_000;
/** No usable Doppler: the escape radius is capped here (network accuracy is mostly bias, not scatter). */
export const DOT_NODOP_RADIUS_CAP_M = 25;
/** Trend follow: a second escape within this long and within this turn of the previous one means walking. */
export const DOT_TREND_PAIR_MS = 60_000;
export const DOT_TREND_MAX_TURN_DEG = 60;
/** Trend ends (hold) when the last 5 s sit less than this far from the fixes about this long ago. */
export const DOT_TREND_STALL_MS = 20_000;
export const DOT_TREND_STALL_M = 12;
/** ...or when the escape's own candidates advance along it by max(this, this speed x their span). */
export const DOT_PROGRESS_MIN_M = 8;
export const DOT_PROGRESS_MIN_MPS = 0.6;
/** Doppler stops being trusted this long (renewed while trend lasts) when it contradicts the positions. */
export const DOT_CONTRADICT_MS = 60_000;
/** Doppler reading exactly 0 for 10 s while the fixes travel this far in about 20 s is not a standing phone. */
export const DOT_ZERO_DOPPLER_DISP_M = 18;
/** Position-derived speed at or above this (while not held) counts as moving. */
export const DOT_POSITION_MOVING_MPS = 0.7;
/** The walk shows "low location accuracy" while the accuracy median over this window is above ENGINE_MAX_ACCURACY_M. */
export const LOW_ACCURACY_WINDOW_MS = 30_000;
/** A standing dot slides once to the mean of the last N good GPS fixes when it sits this far from them. */
export const DOT_RECENTRE_FIXES = 30;
export const DOT_RECENTRE_MAX_ACCURACY_M = 20;
export const DOT_RECENTRE_MIN_M = 10;
/**
 * Fast start (no usable Doppler, good fixes): the hold's own fixes set the radius, 2x how far they travel in 8 s,
 * at least 6 m; above 15 m the lane is off and the escape rules above apply.
 */
export const DOT_FAST_MAX_ACCURACY_M = 20;
export const DOT_FAST_RADIUS_MIN_M = 6;
export const DOT_FAST_RADIUS_MAX_M = 15;
export const DOT_FAST_SCALE_K = 2;
export const DOT_FAST_LAG_MS = 8_000;
export const DOT_FAST_LAG_BAND_MS = 500;
export const DOT_FAST_NOISE_WINDOW_MS = 40_000;
export const DOT_FAST_BASE_WINDOW_MS = 20_000;
export const DOT_FAST_FRESH_MS = 3_000;
export const DOT_FAST_CONFIRM_FIXES = 3;
export const DOT_FAST_MIN_BASE = 5;
export const DOT_FAST_MIN_PAIRS = 8;
/** A young fast trend keeps going while the walker gets this much farther (m/s), less the margin, from the anchor. */
export const DOT_FAST_KEEP_MPS = 0.7;
export const DOT_FAST_KEEP_MARGIN_M = 2;
export const DOT_FAST_YOUNG_MS = 20_000;
