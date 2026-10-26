/** Weekly opening hours of one place, in the place's own local time. Days: 0 = Sunday. A period with no `close` is open all the time. */
export interface WeeklyHours {
  periods: Array<{ open: { day: number; minute: number }; close?: { day: number; minute: number } }>;
  /** Minutes east of UTC at the place; the walk's own offset is used when absent. */
  utcOffsetMin?: number;
}

export type OpenState = "open" | "closed" | "closes_during" | "unknown";

const WEEK = 7 * 1440;

/** Is the place open when the walker arrives, and does it stay open for `stayMin` minutes? */
export function openThrough(hours: WeeklyHours | undefined, arriveMs: number, stayMin: number, fallbackOffsetMin = 0): OpenState {
  if (!hours || !hours.periods.length) return "unknown";
  const offset = hours.utcOffsetMin ?? fallbackOffsetMin;
  const local = new Date(arriveMs + offset * 60000);
  const now = local.getUTCDay() * 1440 + local.getUTCHours() * 60 + local.getUTCMinutes();
  let closesDuring = false;
  for (const p of hours.periods) {
    const open = p.open.day * 1440 + p.open.minute;
    const length = p.close ? (((p.close.day * 1440 + p.close.minute - open) % WEEK) + WEEK) % WEEK || WEEK : WEEK;
    const into = (((now - open) % WEEK) + WEEK) % WEEK;
    if (into >= length) continue;
    if (length - into >= stayMin) return "open";
    closesDuring = true;
  }
  return closesDuring ? "closes_during" : "closed";
}

/** Closing time of the period that covers `arriveMs`, as minutes after arrival; null when open all the time or closed. */
export function minutesUntilClose(hours: WeeklyHours | undefined, arriveMs: number, fallbackOffsetMin = 0): number | null {
  if (!hours) return null;
  const offset = hours.utcOffsetMin ?? fallbackOffsetMin;
  const local = new Date(arriveMs + offset * 60000);
  const now = local.getUTCDay() * 1440 + local.getUTCHours() * 60 + local.getUTCMinutes();
  for (const p of hours.periods) {
    if (!p.close) continue;
    const open = p.open.day * 1440 + p.open.minute;
    const length = (((p.close.day * 1440 + p.close.minute - open) % WEEK) + WEEK) % WEEK || WEEK;
    const into = (((now - open) % WEEK) + WEEK) % WEEK;
    if (into < length) return length - into;
  }
  return null;
}

interface RawPeriodPoint {
  day?: number;
  hour?: number;
  minute?: number;
}

/** Google `currentOpeningHours.periods` -> WeeklyHours; undefined when the data is missing or malformed. */
export function hoursFromGoogle(raw: { periods?: Array<{ open?: RawPeriodPoint; close?: RawPeriodPoint }> } | undefined, utcOffsetMinutes?: number): WeeklyHours | undefined {
  if (!raw?.periods?.length) return undefined;
  const periods: WeeklyHours["periods"] = [];
  for (const p of raw.periods) {
    if (!p.open || typeof p.open.day !== "number") return undefined;
    const point = (x: RawPeriodPoint) => ({ day: x.day as number, minute: (x.hour ?? 0) * 60 + (x.minute ?? 0) });
    periods.push({ open: point(p.open), ...(p.close && typeof p.close.day === "number" ? { close: point(p.close) } : {}) });
  }
  return { periods, ...(typeof utcOffsetMinutes === "number" ? { utcOffsetMin: utcOffsetMinutes } : {}) };
}
