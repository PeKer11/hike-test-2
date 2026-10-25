/** Hourly forecast for a planned walk. Pure helpers; the assistant tool does the I/O. */

export interface ForecastHour {
  time: string;
  feelsC: number | null;
  precipProbPct: number | null;
  precipMm: number | null;
  gustKmh: number | null;
  code: number | null;
}

export type WeatherIssueKind = "rain" | "thunderstorm" | "heat" | "cold" | "wind";

export interface WeatherIssue {
  kind: WeatherIssueKind;
  /** First and last walk hour (1 = the first hour of the walk) the issue covers. */
  fromHour: number;
  toHour: number;
  /** Local clock time the issue starts, e.g. "16:00". */
  at: string;
  detail: string;
}

export const FORECAST_ATTRIBUTION = "Weather data by Open-Meteo.com (CC BY 4.0)";

const RAIN_PROB_PCT = 50;
const RAIN_MM = 0.5;
const HEAT_FEELS_C = 35;
const COLD_FEELS_C = 5;
const GUST_KMH = 50;
const THUNDER_CODE = 95;

export function forecastUrl(lat: number, lng: number): string {
  const q = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    hourly: "apparent_temperature,precipitation_probability,precipitation,wind_gusts_10m,weather_code",
    forecast_hours: "72",
    daily: "sunset",
    timezone: "auto",
  });
  return `https://api.open-meteo.com/v1/forecast?${q.toString()}`;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Tolerant parse: missing values become null, and a malformed body gives no hours. Index 0 is the current hour. */
export function parseForecast(json: unknown): ForecastHour[] {
  const hourly = ((json as { hourly?: Record<string, unknown> } | null)?.hourly ?? {}) as Record<string, unknown>;
  const times = Array.isArray(hourly.time) ? hourly.time : [];
  const col = (key: string): unknown[] => (Array.isArray(hourly[key]) ? (hourly[key] as unknown[]) : []);
  const feels = col("apparent_temperature");
  const prob = col("precipitation_probability");
  const mm = col("precipitation");
  const gust = col("wind_gusts_10m");
  const code = col("weather_code");
  return times.flatMap((t, i) =>
    typeof t === "string"
      ? [{ time: t, feelsC: num(feels[i]), precipProbPct: num(prob[i]), precipMm: num(mm[i]), gustKmh: num(gust[i]), code: num(code[i]) }]
      : [],
  );
}

function hourIssues(h: ForecastHour): Array<{ kind: WeatherIssueKind; detail: string }> {
  const out: Array<{ kind: WeatherIssueKind; detail: string }> = [];
  if ((h.code ?? 0) >= THUNDER_CODE) out.push({ kind: "thunderstorm", detail: "thunderstorm" });
  if ((h.precipProbPct ?? 0) >= RAIN_PROB_PCT || (h.precipMm ?? 0) >= RAIN_MM) {
    const mm = h.precipMm ?? 0;
    out.push({ kind: "rain", detail: `${h.precipProbPct ?? "?"}% chance of rain${mm > 0 ? `, ~${mm.toFixed(1)} mm` : ""}` });
  }
  if ((h.feelsC ?? 0) >= HEAT_FEELS_C) out.push({ kind: "heat", detail: `feels like ${Math.round(h.feelsC!)}°C` });
  if (h.feelsC !== null && h.feelsC <= COLD_FEELS_C) out.push({ kind: "cold", detail: `feels like ${Math.round(h.feelsC)}°C` });
  if ((h.gustKmh ?? 0) >= GUST_KMH) out.push({ kind: "wind", detail: `gusts up to ${Math.round(h.gustKmh!)} km/h` });
  return out;
}

/**
 * Issues during a walk that starts `startInHours` from the first forecast hour and lasts `durationMin`.
 * Consecutive hours with the same issue merge into one range.
 */
export function assessWalkWindow(hours: ForecastHour[], startInHours: number, durationMin: number): WeatherIssue[] {
  const start = Math.max(0, Math.floor(startInHours));
  const count = Math.max(1, Math.ceil(durationMin / 60));
  const issues: WeatherIssue[] = [];
  const open = new Map<WeatherIssueKind, WeatherIssue>();
  for (let k = 0; k < count; k++) {
    const h = hours[start + k];
    if (!h) break;
    const here = hourIssues(h);
    for (const { kind, detail } of here) {
      const run = open.get(kind);
      if (run && run.toHour === k) {
        run.toHour = k + 1;
        run.detail = `${run.detail}; ${detail}`;
      } else {
        const issue: WeatherIssue = { kind, fromHour: k + 1, toHour: k + 1, at: h.time.slice(11, 16), detail };
        open.set(kind, issue);
        issues.push(issue);
      }
    }
  }
  return issues;
}

/**
 * The soonest start (hours from the first forecast hour, from `fromHour` up to `toHour`) at which the walk has no
 * rain or thunderstorm; null when there is none. Used to offer "start later" when the planned window is wet.
 */
export function nextDryStart(hours: ForecastHour[], durationMin: number, fromHour: number, toHour = 48): number | null {
  for (let h = Math.max(0, Math.floor(fromHour)); h <= toHour; h++) {
    if (!hours[h]) break;
    const wet = assessWalkWindow(hours, h, durationMin).some((i) => i.kind === "rain" || i.kind === "thunderstorm");
    if (!wet) return h;
  }
  return null;
}

/** Local sunset ("2026-10-25T17:08") for each date in the forecast, keyed "2026-10-25". Tolerant of a missing block. */
export function parseSunsets(json: unknown): Record<string, string> {
  const daily = ((json as { daily?: { time?: unknown; sunset?: unknown } } | null)?.daily ?? {}) as { time?: unknown; sunset?: unknown };
  const out: Record<string, string> = {};
  if (Array.isArray(daily.time) && Array.isArray(daily.sunset)) {
    daily.time.forEach((d, i) => {
      const sun = daily.sunset ? (daily.sunset as unknown[])[i] : null;
      if (typeof d === "string" && typeof sun === "string") out[d] = sun;
    });
  }
  return out;
}

/** True when the walk, started at forecast hour `startInHours`, ends after that day's sunset. Times are local ISO strings. */
export function endsAfterDark(hours: ForecastHour[], sunsets: Record<string, string>, startInHours: number, durationMin: number): boolean {
  const start = hours[Math.max(0, Math.floor(startInHours))];
  if (!start) return false;
  const sunset = sunsets[start.time.slice(0, 10)];
  if (!sunset) return false;
  const endMs = Date.parse(`${start.time}:00Z`) + durationMin * 60_000;
  return endMs > Date.parse(`${sunset}:00Z`);
}
