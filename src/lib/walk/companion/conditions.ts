import type { ConditionsSnapshot } from "./producers/conditions";

/** Weather lookup helpers for `/api/conditions`. Pure; the route does the I/O. */

export const CONDITIONS_CELL_DEG = 0.1;
export const CONDITIONS_CACHE_MS = 30 * 60_000;
export const OPEN_METEO_ATTRIBUTION = "Weather data by Open-Meteo.com (CC BY 4.0)";

/** Snap to a 0.1 degree cell; also what keeps the exact position off the upstream. */
export function conditionsCell(lat: number, lng: number): {
  key: string;
  lat: number;
  lng: number;
} {
  const cLat = Math.round(lat / CONDITIONS_CELL_DEG) * CONDITIONS_CELL_DEG;
  const cLng = Math.round(lng / CONDITIONS_CELL_DEG) * CONDITIONS_CELL_DEG;
  const la = Number(cLat.toFixed(1));
  const ln = Number(cLng.toFixed(1));
  return { key: `${la},${ln}`, lat: la, lng: ln };
}

export function openMeteoUrl(lat: number, lng: number): string {
  const q = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current: "apparent_temperature",
    hourly: "precipitation_probability",
    forecast_hours: "2",
    timezone: "auto",
  });
  return `https://api.open-meteo.com/v1/forecast?${q.toString()}`;
}

function finiteOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Tolerant parse: anything missing becomes null (no question is raised from it). */
export function parseOpenMeteo(json: unknown): ConditionsSnapshot {
  const obj = (typeof json === "object" && json !== null ? json : {}) as Record<
    string,
    unknown
  >;
  const current = (obj.current ?? {}) as Record<string, unknown>;
  const hourly = (obj.hourly ?? {}) as Record<string, unknown>;
  const probs = Array.isArray(hourly.precipitation_probability)
    ? (hourly.precipitation_probability as unknown[])
        .map(finiteOrNull)
        .filter((n): n is number => n !== null)
    : [];
  return {
    apparentTempC: finiteOrNull(current.apparent_temperature),
    precipProbabilityPct: probs.length > 0 ? Math.max(...probs) : null,
  };
}
