/**
 * What a finished walk may show the summary model. Server-side, field by field:
 * numbers and enums only. Anything not named here (start time, area label,
 * habit data, answer ids, free text) is dropped, whatever the client sent.
 */

/** The app's own place id (`Attraction.id`); `name@lat,lng` fallback keys carry a name and coordinates and never qualify. */
export const OSM_POI_KEY = /^osm-(node|way|relation)-\d+$/;

export function isOsmPoiKey(key: unknown): key is string {
  return typeof key === "string" && key.length <= 40 && OSM_POI_KEY.test(key);
}

export function cleanOsmPoiKeys(keys: unknown, max = 60): string[] {
  if (!Array.isArray(keys)) return [];
  return [...new Set(keys.filter(isOsmPoiKey))].slice(0, max);
}

const ENVS = ["urban", "park", "rural"] as const;
const QUESTION_KINDS = [
  "pace-slow", "pace-fast", "toward-green", "sunset", "heat-water", "rest", "stop-closing", "rain",
] as const; // habit-* kinds are deliberately absent: habits never go to the AI
const INTERACTION_KINDS = ["visited", "dismissed", "declined_detour", "added", "offered"] as const;
const CATEGORY = /^[a-z_]{1,30}$/;

function num(v: unknown, min: number, max: number): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : undefined;
}

export function whitelistWalkEnd(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const scalars: Array<[string, number]> = [
    ["plannedMin", 1440], ["actualMin", 1440], ["distanceM", 200_000],
    ["stopsPlanned", 100], ["stopsVisited", 100], ["collapseCount", 1000],
  ];
  for (const [k, max] of scalars) {
    const v = num(raw[k], 0, max);
    if (v !== undefined) out[k] = v;
  }
  if (typeof raw.envMinutes === "object" && raw.envMinutes !== null && !Array.isArray(raw.envMinutes)) {
    const env: Record<string, number> = {};
    for (const e of ENVS) {
      const v = num((raw.envMinutes as Record<string, unknown>)[e], 0, 1440);
      if (v !== undefined) env[e] = v;
    }
    out.envMinutes = env;
  }
  if (Array.isArray(raw.questions)) {
    out.questions = raw.questions
      .slice(0, 20)
      .flatMap((q) => {
        const r = q as Record<string, unknown> | null;
        const kind = r && (QUESTION_KINDS as readonly unknown[]).includes(r.kind) ? r.kind : null;
        // Only whether it was answered; the answer id itself stays home.
        return kind ? [{ kind, answered: r!.answer !== "ignored" }] : [];
      });
  }
  if (Array.isArray(raw.interactions)) {
    out.interactions = raw.interactions.slice(0, 60).flatMap((i) => {
      const r = i as Record<string, unknown> | null;
      if (!r || !isOsmPoiKey(r.poiKey)) return [];
      if (!(INTERACTION_KINDS as readonly unknown[]).includes(r.kind)) return [];
      if (typeof r.category !== "string" || !CATEGORY.test(r.category)) return [];
      return [{ poiKey: r.poiKey, kind: r.kind, category: r.category }];
    });
  }
  return out;
}
