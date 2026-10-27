import { isAccess } from "@/lib/walk/access";

import { expireCandidates, type AssistantState, type Candidate } from "./state";

export function parseOrigin(value: unknown): { lat: number; lng: number } | null {
  if (typeof value !== "object" || value === null) return null;
  const { lat, lng } = value as Record<string, unknown>;
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

const MAX_STORED_CANDIDATES = 60;
const MAX_STORED_NAME = 120;
const MAX_STORED_STREETS = 10;
const MAX_STORED_AREA = 80;

// The walker can edit the stored state directly (their own row), so it is trimmed to the same limits the tools use.
const cleanText = (v: unknown, max: number): string => (typeof v === "string" ? v.replace(/[\u0000-\u001F\u007F]/g, " ").slice(0, max) : "");

const NUMERIC_PARAMS = ["timeMinutes", "radiusKm", "endDistanceKm", "maxWalkKm", "paceMinPerKm"] as const;

export function asState(raw: unknown): AssistantState {
  const s = (raw ?? {}) as Partial<AssistantState>;
  const params = { ...(s.params ?? {}) } as Record<string, unknown>;
  for (const key of ["viaStreets", "avoidStreets"]) {
    if (Array.isArray(params[key])) params[key] = (params[key] as unknown[]).slice(0, MAX_STORED_STREETS).map((v) => cleanText(v, MAX_STORED_NAME)).filter(Boolean);
  }
  if (typeof params.stayInArea === "string") params.stayInArea = cleanText(params.stayInArea, MAX_STORED_AREA);
  if (!isAccess(params.access)) delete params.access;
  for (const key of NUMERIC_PARAMS) {
    const v = params[key];
    if (v !== undefined && !(typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 10_000)) delete params[key];
  }
  const grade = params.maxGradePct;
  if (grade !== undefined && !(typeof grade === "number" && Number.isFinite(grade) && grade > 0 && grade <= 30)) delete params.maxGradePct;
  const candidates = (Array.isArray(s.candidates) ? expireCandidates(s.candidates, Date.now()) : [])
    .filter((c): c is Candidate => typeof c?.id === "string" && typeof c.placeId === "string" && parseOrigin(c.coordinates) !== null)
    .slice(0, MAX_STORED_CANDIDATES);
  return {
    origin: parseOrigin(s.origin),
    params: params as AssistantState["params"],
    candidates: candidates.map((c) => ({ ...c, name: cleanText(c.name, MAX_STORED_NAME) })),
    chosen: Array.isArray(s.chosen) ? s.chosen.filter((x): x is string => typeof x === "string").slice(0, MAX_STORED_CANDIDATES) : [],
    limitsSettled: s.limitsSettled === true,
  };
}
