/** Wall-clock helpers on top of Intl (no dependency). Times are "HH:MM" in a named time zone. */

const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export function parseHHMM(text: string): number | null {
  const m = HHMM.exec(text.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** A fixed-offset zone name that tzOffsetMin understands ("UTC+03:00"), for a place whose IANA zone is not known. */
export function fixedZone(offsetMin: number): string {
  const a = Math.abs(offsetMin);
  return `UTC${offsetMin < 0 ? "-" : "+"}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`;
}

/** Minutes east of UTC that `timeZone` is at `epochMs`; null for an unknown zone. */
export function tzOffsetMin(timeZone: string, epochMs: number): number | null {
  const fixed = /^UTC([+-])(\d{2}):(\d{2})$/.exec(timeZone);
  if (fixed) return (fixed[1] === "-" ? -1 : 1) * (Number(fixed[2]) * 60 + Number(fixed[3]));
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(epochMs));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
    return Math.round((asUtc - Math.floor(epochMs / 1000) * 1000) / 60000);
  } catch {
    return null;
  }
}

/** "HH:MM" on the local day of `dayOfMs` (default: the same day as `epochMs`) -> epoch ms. */
export function localTimeOnDay(hhmm: string, timeZone: string, dayOfMs: number): number | null {
  const minutes = parseHHMM(hhmm);
  const offset = tzOffsetMin(timeZone, dayOfMs);
  if (minutes === null || offset === null) return null;
  const localMidnight = Math.floor((dayOfMs + offset * 60000) / 86400000) * 86400000;
  const guess = localMidnight + minutes * 60000 - offset * 60000;
  // The offset at the target moment may differ (daylight saving): correct once.
  const offset2 = tzOffsetMin(timeZone, guess) ?? offset;
  return localMidnight + minutes * 60000 - offset2 * 60000;
}

/** The next time the clock shows `hhmm` at or after `nowMs` (today, else tomorrow). */
export function nextLocalTime(hhmm: string, timeZone: string, nowMs: number): number | null {
  const today = localTimeOnDay(hhmm, timeZone, nowMs);
  if (today === null) return null;
  if (today >= nowMs - 5 * 60000) return today;
  // Noon of the next local day, so a daylight-saving change cannot land on the same date again.
  const offset = tzOffsetMin(timeZone, nowMs) ?? 0;
  const nextNoon = Math.floor((nowMs + offset * 60000) / 86400000) * 86400000 + 36 * 3600000 - offset * 60000;
  return localTimeOnDay(hhmm, timeZone, nextNoon);
}

export function formatClock(epochMs: number, offsetMin: number): string {
  const d = new Date(epochMs + offsetMin * 60000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}
