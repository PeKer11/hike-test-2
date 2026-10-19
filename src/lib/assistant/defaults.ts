import type { WalkParams } from "./state";

export type TasteLevel = "less" | "more";

/** The walker's standing answers from the chat's gear menu. Anything missing means "not set". */
export interface AssistantDefaults extends WalkParams {
  /** Per kind of place: "more" / "less" than normal. A kind that is absent is neutral. */
  tastes?: Record<string, TasteLevel>;
}

const KINDS = ["food", "nature", "park", "museum", "landmark", "viewpoint", "religious", "shopping", "entertainment"];

function pick(value: unknown, max: number): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= max ? value : undefined;
}

export function parseDefaults(raw: unknown): AssistantDefaults {
  if (typeof raw !== "object" || raw === null) return {};
  const r = raw as Record<string, unknown>;
  const tastes: Record<string, TasteLevel> = {};
  if (typeof r.tastes === "object" && r.tastes !== null) {
    for (const [kind, level] of Object.entries(r.tastes)) {
      if (KINDS.includes(kind) && (level === "less" || level === "more")) tastes[kind] = level;
    }
  }
  return {
    timeMinutes: pick(r.timeMinutes, 1440),
    radiusKm: pick(r.radiusKm, 200),
    endDistanceKm: pick(r.endDistanceKm, 200),
    maxWalkKm: pick(r.maxWalkKm, 200),
    paceMinPerKm: pick(r.paceMinPerKm, 60),
    tastes,
  };
}

/** The limits part of the defaults, without undefined keys, to seed a new chat's params. */
export function defaultParams(d: AssistantDefaults): WalkParams {
  const params: WalkParams = {};
  if (d.timeMinutes) params.timeMinutes = d.timeMinutes;
  if (d.radiusKm) params.radiusKm = d.radiusKm;
  if (d.endDistanceKm) params.endDistanceKm = d.endDistanceKm;
  if (d.maxWalkKm) params.maxWalkKm = d.maxWalkKm;
  if (d.paceMinPerKm) params.paceMinPerKm = d.paceMinPerKm;
  return params;
}

/**
 * What the model is told about taste. Stated settings and learned weights (decayed history) are
 * both soft: they steer an open-ended "interesting places" request, never an explicit one.
 */
export function tasteNote(d: AssistantDefaults, learned: Map<string, number>): string {
  const more = Object.entries(d.tastes ?? {}).filter(([, v]) => v === "more").map(([k]) => k);
  const less = Object.entries(d.tastes ?? {}).filter(([, v]) => v === "less").map(([k]) => k);
  const total = [...learned.values()].reduce((a, b) => a + b, 0);
  const history = [...learned.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([k, w]) => `${k} ${total ? Math.round((w / total) * 100) : 0}%`);
  const top = [...learned.values()].sort((a, b) => b - a)[0] ?? 0;
  const dominated = total > 0 && top / total > 0.6;
  const lines: string[] = [];
  if (more.length) lines.push(`Walker wants more of: ${more.join(", ")}.`);
  if (less.length) lines.push(`Walker wants less of: ${less.join(", ")}.`);
  if (history.length) lines.push(`Learned from past walks (share of choices): ${history.join(", ")}.`);
  if (dominated) lines.push("Their past choices are dominated by one kind of place.");
  return lines.length ? `\nTaste (soft guidance only):\n${lines.join("\n")}` : "";
}
