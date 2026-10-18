/**
 * Routine-habit model (H1): "likes to eat around 16:00", learned from walks.
 * Pure: no I/O, no `Date.now()`, no RNG (v1 has no sampling; the Thompson
 * timing arm is v2, which will take an injected `Rng`). Every clock is passed in.
 *
 * Design in docs/PERSONALIZATION_SOCIAL_PLAN.md section 2. The one trap is
 * exposure: we only see the walker while walking, so a bin keeps both
 * opportunities (`opp`) and successes (`succ`) and the estimate is the rate.
 *
 * Privacy: the state is two 48-number arrays and a few counters per
 * (habit, day type). No coordinates, no place names, no timestamps finer
 * than the hour.
 */

export type Habit = "eat" | "coffee";
export type DayType = "weekday" | "friday" | "saturday" | "any";
export type HabitAnswer = "take-me" | "already" | "not-now" | "timeout";

export const HABITS: readonly Habit[] = ["eat", "coffee"];
export const BIN_COUNT = 48;
export const BIN_MINUTES = 30;
const DAY_MINUTES = 1440;

/** Weak prior Beta(0.3, 2.7): mean 10%, weight of 3 pseudo-walks. */
export const PRIOR_ALPHA = 0.3;
export const PRIOR_BETA = 2.7;
/** Applied once per walk to every cell of the habit (half-life about 23 walks). */
export const DECAY_GAMMA = 0.97;
/** A success adds 1.0 to its bin and this much to each neighbour. */
export const NEIGHBOUR_WEIGHT = 0.5;
/** Minutes of activity inside a bin that make it an opportunity. */
export const MIN_ACTIVE_MIN_IN_BIN = 15;

// Confidence gate ("established").
export const MIN_OPPORTUNITIES = 3;
export const MIN_DISTINCT_DAYS = 2;
export const MIN_MEAN = 0.5;
export const MIN_WILSON_LOWER = 0.3;
/** One-sided 80% (z = 1.28). */
export const WILSON_Z = 1.28;
/** A day type with fewer opportunities in a bin falls back to `any` for that bin. */
export const DAY_TYPE_MIN_OPP = 3;

// Ask window around the peak bin's start: [peak - 30 min, peak + 15 min].
export const WINDOW_BEFORE_MIN = 30;
export const WINDOW_AFTER_MIN = 15;

// "No" learning.
export const NOT_NOW_OPP_PENALTY = 0.5;
export const MUTE_STREAK = 3;
export const MUTE_DAYS = 30;
export const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
/**
 * Distinct-days bitmask ring, one per bin: a day maps to bit (epochDay mod 30), so
 * a mask holds the last 30 days (plan §2 says 8 weeks; a 32-bit column cannot hold
 * more). Bits for days that fell out of the window are cleared on every write.
 */
export const DAY_MASK_BITS = 30;
/** Visiting food this soon after "not now" means we were early, not wrong. */
export const TOO_EARLY_WINDOW_MIN = 30;

export interface HabitTiming {
  /** Answers "take me": the ask was well timed. */
  onTime: number;
  /** "Already ate": we asked too late, shift earlier next time. */
  tooLate: number;
  /** "Not now" followed by a visit within 30 min: we asked too early. */
  tooEarly: number;
}

/** One (habit, day type) cell. Mirrors a `routine_habits` row (wall clock). */
export interface HabitRow {
  habit: Habit;
  dayType: DayType;
  succ: number[];
  opp: number[];
  /** Per-bin distinct-days evidence for successes (see DAY_MASK_BITS). */
  dayMasks: number[];
  /** Local epoch day the masks were last aged to; 0 when never. */
  maskDay: number;
  timing: HabitTiming;
  /** Kept on the `any` row only. */
  declineStreak: number;
  /** Kept on the `any` row only. Epoch ms, or null. */
  mutedUntilMs: number | null;
  /** Epoch ms truncated to the hour, or null. Kept on the `any` row only. */
  lastAskedMs: number | null;
  /** `walkKeyOf(start)` of the last walk folded in; makes a re-sync a no-op. */
  lastWalkKey: number;
}

export type HabitState = HabitRow[];

export function emptyRow(habit: Habit, dayType: DayType): HabitRow {
  return {
    habit,
    dayType,
    succ: new Array<number>(BIN_COUNT).fill(0),
    opp: new Array<number>(BIN_COUNT).fill(0),
    dayMasks: new Array<number>(BIN_COUNT).fill(0),
    maskDay: 0,
    timing: { onTime: 0, tooLate: 0, tooEarly: 0 },
    declineStreak: 0,
    mutedUntilMs: null,
    lastAskedMs: null,
    lastWalkKey: 0,
  };
}

// --- time ---------------------------------------------------------------------

export interface LocalTime {
  dayType: Exclude<DayType, "any">;
  /** Minutes since local midnight, 0..1439. */
  minuteOfDay: number;
  /** Local calendar day number (days since 1970-01-01 local). */
  epochDay: number;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Circular bin of a minute-of-day (any integer; wraps). */
export function binOfMinute(minute: number): number {
  const m = ((Math.floor(minute) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  return Math.floor(m / BIN_MINUTES);
}

export function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/** Israeli week: Sun-Thu weekday, Friday, Saturday. Holidays are v2. */
export function dayTypeOfWeekday(weekday: number): LocalTime["dayType"] {
  return weekday === 5 ? "friday" : weekday === 6 ? "saturday" : "weekday";
}

/**
 * Local clock of `ms` in an IANA zone. `timeZone` is the walk location's zone
 * (Asia/Jerusalem inside Israel, else the device zone); callers inject it.
 * Returns null for a non-finite time or an unknown zone.
 */
export function localTimeOf(ms: number, timeZone: string): LocalTime | null {
  if (!Number.isFinite(ms)) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      weekday: "short",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    }).formatToParts(new Date(ms));
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const weekday = WEEKDAY_INDEX[get("weekday")];
    const hour = Number(get("hour"));
    const minute = Number(get("minute"));
    const y = Number(get("year"));
    const mo = Number(get("month"));
    const d = Number(get("day"));
    if (weekday === undefined || ![hour, minute, y, mo, d].every(Number.isFinite)) return null;
    return {
      dayType: dayTypeOfWeekday(weekday),
      minuteOfDay: (hour % 24) * 60 + minute,
      epochDay: Math.floor(Date.UTC(y, mo - 1, d) / DAY_MS),
    };
  } catch {
    return null;
  }
}

/**
 * Bins in which the walker was active for at least 15 minutes between `startMs`
 * and `endMs` (a walk spanning midnight wraps). The local offset is read once
 * at the start, so a DST change mid-walk is ignored. Capped at 24 h.
 */
export function activeBinsForSpan(startMs: number, endMs: number, timeZone: string): number[] {
  const start = localTimeOf(startMs, timeZone);
  if (!start || !Number.isFinite(endMs) || endMs <= startMs) return [];
  const minutes = Math.min(DAY_MINUTES, Math.floor((endMs - startMs) / 60_000));
  const perBin = new Array<number>(BIN_COUNT).fill(0);
  for (let k = 0; k < minutes; k++) perBin[binOfMinute(start.minuteOfDay + k)] += 1;
  const out: number[] = [];
  for (let b = 0; b < BIN_COUNT; b++) if (perBin[b] >= MIN_ACTIVE_MIN_IN_BIN) out.push(b);
  return out;
}

function popcount(n: number): number {
  let c = 0;
  for (let x = n >>> 0; x; x &= x - 1) c++;
  return c;
}

// --- math -------------------------------------------------------------------

/** Beta mean of a cell's bin. */
export function betaMean(succ: number, opp: number): number {
  return (PRIOR_ALPHA + succ) / (PRIOR_ALPHA + PRIOR_BETA + opp);
}

/** Lower Wilson bound of the observed rate, z = 1.28. 0 when there are no opportunities. */
export function wilsonLower(succ: number, opp: number, z = WILSON_Z): number {
  if (!(opp > 0)) return 0;
  const p = Math.min(1, Math.max(0, succ / opp));
  const z2 = z * z;
  const centre = p + z2 / (2 * opp);
  const margin = z * Math.sqrt((p * (1 - p)) / opp + z2 / (4 * opp * opp));
  return Math.max(0, (centre - margin) / (1 + z2 / opp));
}

// --- state access -----------------------------------------------------------

export function findRow(state: HabitState, habit: Habit, dayType: DayType): HabitRow | undefined {
  return state.find((r) => r.habit === habit && r.dayType === dayType);
}

function withRow(state: HabitState, row: HabitRow): HabitState {
  const i = state.findIndex((r) => r.habit === row.habit && r.dayType === row.dayType);
  if (i < 0) return [...state, row];
  const next = state.slice();
  next[i] = row;
  return next;
}

function cloneRow(r: HabitRow): HabitRow {
  return { ...r, succ: r.succ.slice(), opp: r.opp.slice(), dayMasks: r.dayMasks.slice(), timing: { ...r.timing } };
}

// --- learning from a walk ---------------------------------------------------

export interface WalkObservation {
  habit: Habit;
  dayType: Exclude<DayType, "any">;
  /** Bins with at least 15 active minutes (see `activeBinsForSpan`). */
  activeBins: number[];
  /** Bin of the walk's first food event for this habit, or null. */
  firstEventBin: number | null;
  /** Local calendar day (for the distinct-days evidence). */
  epochDay: number;
}

function validBin(b: unknown): b is number {
  return typeof b === "number" && Number.isInteger(b) && b >= 0 && b < BIN_COUNT;
}

/** Clears the ring bits of days that passed between `from` and `to` (their slots are about to be reused). */
export function ageDayMasks(masks: readonly number[], from: number, to: number): number[] {
  if (from <= 0 || to <= from) return masks.slice();
  if (to - from >= DAY_MASK_BITS) return masks.map(() => 0);
  let keep = 0;
  for (let d = from + 1; d <= to; d++) keep |= 1 << mod(d, DAY_MASK_BITS);
  return masks.map((m) => (m & ~keep) >>> 0);
}

function addToCell(row: HabitRow, obs: WalkObservation): void {
  for (const b of new Set(obs.activeBins.filter(validBin))) row.opp[b] += 1;
  row.dayMasks = ageDayMasks(row.dayMasks, row.maskDay, obs.epochDay);
  row.maskDay = Math.max(row.maskDay, obs.epochDay);
  const e = obs.firstEventBin;
  if (validBin(e)) {
    row.succ[e] += 1;
    row.succ[mod(e - 1, BIN_COUNT)] += NEIGHBOUR_WEIGHT;
    row.succ[mod(e + 1, BIN_COUNT)] += NEIGHBOUR_WEIGHT;
    // Day evidence follows the success credit: the event bin and its two neighbours only,
    // so successes in unrelated bins can never add up to "two distinct days" for this one.
    if (row.maskDay - obs.epochDay < DAY_MASK_BITS) {
      const bit = 1 << mod(obs.epochDay, DAY_MASK_BITS);
      for (const b of [mod(e - 1, BIN_COUNT), e, mod(e + 1, BIN_COUNT)]) row.dayMasks[b] = (row.dayMasks[b] | bit) >>> 0;
    }
  }
}

/** Strictly increasing per walk: the walk's start in whole minutes since the epoch. */
export function walkKeyOf(startedAtMs: number): number {
  return Number.isFinite(startedAtMs) ? Math.max(0, Math.floor(startedAtMs / 60_000)) : 0;
}

/**
 * Fold one finished walk in. Decay (x0.97) is applied once, to every cell of the
 * habit, then the walk is added to its day-type cell and to `any`. `walkKey` is
 * `walkKeyOf(start)`: a walk already folded in (same or older key) changes
 * nothing, so a retried write cannot decay twice.
 */
export function applyWalk(state: HabitState, obs: WalkObservation, walkKey: number): HabitState {
  if (alreadyFolded(state, obs.habit, walkKey)) return state;

  let next: HabitState = state.map((r) => {
    if (r.habit !== obs.habit) return r;
    const c = cloneRow(r);
    c.succ = c.succ.map((v) => v * DECAY_GAMMA);
    c.opp = c.opp.map((v) => v * DECAY_GAMMA);
    return c;
  });
  for (const dayType of [obs.dayType, "any"] as const) {
    const row = cloneRow(findRow(next, obs.habit, dayType) ?? emptyRow(obs.habit, dayType));
    addToCell(row, obs);
    row.lastWalkKey = Math.max(row.lastWalkKey, walkKey);
    next = withRow(next, row);
  }
  return next;
}

// --- learning "no" ------------------------------------------------------------

/** Minimum days between asks after `streak` consecutive declines: 0, 1, 2, then muted. */
export function minGapDays(streak: number): number {
  return streak <= 0 ? 0 : 2 ** (Math.min(streak, MUTE_STREAK) - 1);
}

export function truncatedHourMs(ms: number): number {
  return Math.floor(ms / HOUR_MS) * HOUR_MS;
}

export interface AnswerEvent {
  habit: Habit;
  dayType: Exclude<DayType, "any">;
  answer: HabitAnswer;
  /** Bin the question was asked in. */
  bin: number;
  /** Fix/clock time the question was asked, epoch ms. */
  askedAtMs: number;
  /** "not-now" only: the walker visited food within 30 min after. */
  visitedFoodWithin30Min?: boolean;
}

/**
 * Three-tier "no":
 *  - take-me:  streak resets, timing "on time".
 *  - already:  streak resets, timing "too late". The habit itself is real; its
 *              success is counted by the walk observation (first event = the ask bin).
 *  - not-now:  soft failure (opp +0.5 in the bin) and streak + 1; 3 in a row mutes
 *              the habit for 30 days. If food was visited within 30 min it was only
 *              early: timing "too early", no failure, no streak.
 *  - timeout:  no habit evidence at all (the arbiter's pAct already hears it).
 * Every answer records the ask time (hour-truncated) for the minimum-gap rule.
 */
export function applyAnswer(state: HabitState, e: AnswerEvent): HabitState {
  if (!validBin(e.bin)) return state;
  const anyRow = cloneRow(findRow(state, e.habit, "any") ?? emptyRow(e.habit, "any"));
  const dayRow = cloneRow(findRow(state, e.habit, e.dayType) ?? emptyRow(e.habit, e.dayType));
  let dayTouched = false;
  anyRow.lastAskedMs = Number.isFinite(e.askedAtMs) ? truncatedHourMs(e.askedAtMs) : anyRow.lastAskedMs;

  switch (e.answer) {
    case "take-me":
      anyRow.declineStreak = 0;
      anyRow.timing.onTime += 1;
      break;
    case "already":
      anyRow.declineStreak = 0;
      anyRow.timing.tooLate += 1;
      break;
    case "not-now":
      if (e.visitedFoodWithin30Min) {
        anyRow.timing.tooEarly += 1;
      } else {
        dayRow.opp[e.bin] += NOT_NOW_OPP_PENALTY;
        dayTouched = true;
        anyRow.opp[e.bin] += NOT_NOW_OPP_PENALTY;
        anyRow.declineStreak += 1;
        if (anyRow.declineStreak >= MUTE_STREAK) {
          anyRow.mutedUntilMs = e.askedAtMs + MUTE_DAYS * DAY_MS;
        }
      }
      break;
    case "timeout":
      break;
  }
  return withRow(dayTouched ? withRow(state, dayRow) : state, anyRow);
}

/** True when this walk is already folded in (a retried write must not count twice). */
export function alreadyFolded(state: HabitState, habit: Habit, walkKey: number): boolean {
  const row = findRow(state, habit, "any");
  return !!row && walkKey <= row.lastWalkKey;
}

/** Muted for 30 days after 3 consecutive declines. */
export function isMuted(state: HabitState, habit: Habit, nowMs: number): boolean {
  const m = findRow(state, habit, "any")?.mutedUntilMs;
  return m != null && nowMs < m;
}

/** Muted, or asked more recently than the decline streak's minimum gap allows. */
export function askBlocked(state: HabitState, habit: Habit, nowMs: number): boolean {
  if (isMuted(state, habit, nowMs)) return true;
  const row = findRow(state, habit, "any");
  if (!row || row.lastAskedMs == null) return false;
  return nowMs - row.lastAskedMs < minGapDays(row.declineStreak) * DAY_MS;
}

// --- estimate ---------------------------------------------------------------

export interface HabitEstimate {
  habit: Habit;
  bin: number;
  mean: number;
  wilsonLower: number;
  opp: number;
  /** Which cell supplied the numbers. */
  source: DayType;
}

/** Numbers for one bin: the day-type cell if it has >= 3 opportunities there, else `any`. */
function cellForBin(state: HabitState, habit: Habit, dayType: DayType, bin: number): HabitRow | undefined {
  const day = dayType === "any" ? undefined : findRow(state, habit, dayType);
  if (day && day.opp[bin] >= DAY_TYPE_MIN_OPP) return day;
  return findRow(state, habit, "any");
}

/** The established estimate for one bin, or null when any part of the gate fails. */
export function estimateForBin(
  state: HabitState,
  habit: Habit,
  dayType: DayType,
  bin: number,
): HabitEstimate | null {
  if (!validBin(bin)) return null;
  const row = cellForBin(state, habit, dayType, bin);
  if (!row) return null;
  const succ = row.succ[bin];
  const opp = row.opp[bin];
  if (opp < MIN_OPPORTUNITIES) return null;
  if (popcount(row.dayMasks[bin]) < MIN_DISTINCT_DAYS) return null;
  const mean = betaMean(succ, opp);
  if (mean < MIN_MEAN) return null;
  const lower = wilsonLower(succ, opp);
  if (lower < MIN_WILSON_LOWER) return null;
  return { habit, bin, mean, wilsonLower: lower, opp, source: row.dayType };
}

/** The established bin with the highest mean (ties: earlier bin), or null. */
export function peakEstimate(state: HabitState, habit: Habit, dayType: DayType): HabitEstimate | null {
  let best: HabitEstimate | null = null;
  for (let b = 0; b < BIN_COUNT; b++) {
    const est = estimateForBin(state, habit, dayType, b);
    if (est && (best === null || est.mean > best.mean)) best = est;
  }
  return best;
}

/** True when `minuteOfDay` is inside [peak - 30 min, peak + 15 min] (circular). */
export function inAskWindow(estimate: HabitEstimate, minuteOfDay: number): boolean {
  const peakStart = estimate.bin * BIN_MINUTES;
  const rel = mod(minuteOfDay - (peakStart - WINDOW_BEFORE_MIN), DAY_MINUTES);
  return rel <= WINDOW_BEFORE_MIN + WINDOW_AFTER_MIN;
}

/** "HH:MM" of a bin's start, for the "what Traike learned" view. */
export function binLabel(bin: number): string {
  const m = mod(bin, BIN_COUNT) * BIN_MINUTES;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

// --- sanitising stored rows -------------------------------------------------

function sanitizeArray(v: unknown): number[] | null {
  if (!Array.isArray(v) || v.length !== BIN_COUNT) return null;
  const out: number[] = [];
  for (const x of v) {
    if (typeof x !== "number" || !Number.isFinite(x) || x < 0 || x > 10_000) return null;
    out.push(x);
  }
  return out;
}

function sanitizeMasks(v: unknown): number[] {
  if (!Array.isArray(v) || v.length !== BIN_COUNT) return new Array<number>(BIN_COUNT).fill(0);
  return v.map((x) =>
    typeof x === "number" && Number.isInteger(x) && x >= 0 && x < 2 ** DAY_MASK_BITS ? x : 0,
  );
}

function nonNeg(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.min(v, 1e6) : 0;
}

/** Validates a stored/wire row; null when it is not a usable wall-clock row. */
export function sanitizeHabitRow(raw: unknown): HabitRow | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r.habit !== "eat" && r.habit !== "coffee") return null;
  if (r.dayType !== "weekday" && r.dayType !== "friday" && r.dayType !== "saturday" && r.dayType !== "any") {
    return null;
  }
  const succ = sanitizeArray(r.succ);
  const opp = sanitizeArray(r.opp);
  if (!succ || !opp) return null;
  const t = (typeof r.timing === "object" && r.timing !== null ? r.timing : {}) as Record<string, unknown>;
  const mutedUntilMs = typeof r.mutedUntilMs === "number" && Number.isFinite(r.mutedUntilMs) ? r.mutedUntilMs : null;
  const lastAskedMs = typeof r.lastAskedMs === "number" && Number.isFinite(r.lastAskedMs) ? r.lastAskedMs : null;
  return {
    habit: r.habit,
    dayType: r.dayType,
    succ,
    opp,
    dayMasks: sanitizeMasks(r.dayMasks),
    maskDay:
      typeof r.maskDay === "number" && Number.isInteger(r.maskDay) && r.maskDay >= 0 && r.maskDay < 2 ** 31
        ? r.maskDay
        : 0,
    timing: { onTime: nonNeg(t.onTime), tooLate: nonNeg(t.tooLate), tooEarly: nonNeg(t.tooEarly) },
    declineStreak: Math.min(100, Math.floor(nonNeg(r.declineStreak))),
    mutedUntilMs,
    lastAskedMs,
    lastWalkKey:
      typeof r.lastWalkKey === "number" && Number.isInteger(r.lastWalkKey) && r.lastWalkKey >= 0 && r.lastWalkKey < 2 ** 31
        ? r.lastWalkKey
        : 0,
  };
}
