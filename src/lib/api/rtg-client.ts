import rtgTrails from "@/lib/data/rtg-trails.json";
import type { Coordinates, RtgTrail, TrailDataSource } from "@/lib/types";
import { fromOrsCoord } from "@/lib/utils/geo";

const ISRAEL_BOUNDS = {
  minLat: 29.5,
  maxLat: 33.3,
  minLng: 34.2,
  maxLng: 35.9,
} as const;

type RawCoordinate = Coordinates | [number, number];

interface RawRtgTrail {
  id?: unknown;
  name?: unknown;
  region?: unknown;
  geometry?: unknown;
  lengthMeters?: unknown;
  difficulty?: unknown;
  source?: unknown;
  dataVersion?: unknown;
  lastUpdated?: unknown;
  metadata?: unknown;
}

interface TrailValidationResult {
  valid: boolean;
  reason?: string;
}

interface TrailLoadDiagnostics {
  validTrailCount: number;
  skippedTrailCount: number;
}

let diagnosticsCache: TrailLoadDiagnostics | null = null;

function isCoordinateObject(value: unknown): value is Coordinates {
  if (!value || typeof value !== "object") {
    return false;
  }

  const coordinate = value as Coordinates;
  return Number.isFinite(coordinate.lat) && Number.isFinite(coordinate.lng);
}

function normalizeCoordinate(value: RawCoordinate): Coordinates {
  if (Array.isArray(value)) {
    return fromOrsCoord(value);
  }

  return value;
}

function isInIsraelBounds(point: Coordinates): boolean {
  return (
    point.lat >= ISRAEL_BOUNDS.minLat &&
    point.lat <= ISRAEL_BOUNDS.maxLat &&
    point.lng >= ISRAEL_BOUNDS.minLng &&
    point.lng <= ISRAEL_BOUNDS.maxLng
  );
}

function normalizeGeometry(rawGeometry: unknown): Coordinates[] {
  if (!Array.isArray(rawGeometry)) {
    return [];
  }

  return rawGeometry
    .filter((value): value is RawCoordinate => Array.isArray(value) || isCoordinateObject(value))
    .map((value) => normalizeCoordinate(value))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
    .filter((point) => isInIsraelBounds(point));
}

function normalizeSource(value: unknown): TrailDataSource {
  return value === "rtg-official" ? "rtg-official" : "rtg-curated";
}

export function normalizeTrail(rawTrail: RawRtgTrail): RtgTrail {
  return {
    id: typeof rawTrail.id === "string" ? rawTrail.id : "",
    name: typeof rawTrail.name === "string" ? rawTrail.name : "",
    region: typeof rawTrail.region === "string" ? rawTrail.region : "Unknown",
    geometry: normalizeGeometry(rawTrail.geometry),
    lengthMeters:
      typeof rawTrail.lengthMeters === "number" && Number.isFinite(rawTrail.lengthMeters)
        ? rawTrail.lengthMeters
        : 0,
    difficulty:
      typeof rawTrail.difficulty === "string" ? rawTrail.difficulty : undefined,
    source: normalizeSource(rawTrail.source),
    dataVersion:
      typeof rawTrail.dataVersion === "string" ? rawTrail.dataVersion : "unknown",
    lastUpdated:
      typeof rawTrail.lastUpdated === "string"
        ? rawTrail.lastUpdated
        : new Date(0).toISOString(),
    metadata:
      rawTrail.metadata && typeof rawTrail.metadata === "object"
        ? (rawTrail.metadata as Record<string, unknown>)
        : undefined,
  };
}

export function validateTrail(trail: RtgTrail): TrailValidationResult {
  if (!trail.id.trim()) {
    return { valid: false, reason: "missing id" };
  }

  if (!trail.name.trim()) {
    return { valid: false, reason: "missing name" };
  }

  if (!Number.isFinite(trail.lengthMeters) || trail.lengthMeters <= 0) {
    return { valid: false, reason: "invalid length" };
  }

  if (trail.geometry.length < 3) {
    return { valid: false, reason: "geometry must contain at least 3 points" };
  }

  if (
    !trail.geometry.every(
      (point) =>
        Number.isFinite(point.lat) &&
        Number.isFinite(point.lng) &&
        isInIsraelBounds(point),
    )
  ) {
    return { valid: false, reason: "geometry contains invalid coordinates" };
  }

  return { valid: true };
}

function loadRtgTrails(): RtgTrail[] {
  let skippedTrailCount = 0;
  const normalized = (rtgTrails as RawRtgTrail[]).flatMap((rawTrail) => {
    const trail = normalizeTrail(rawTrail);
    const validation = validateTrail(trail);

    if (!validation.valid) {
      skippedTrailCount += 1;
      if (process.env.NODE_ENV !== "production") {
        console.warn(`Skipping RTG trail "${trail.id || "unknown"}": ${validation.reason}`);
      }
      return [];
    }

    return [trail];
  });

  diagnosticsCache = {
    validTrailCount: normalized.length,
    skippedTrailCount,
  };

  return normalized;
}

const cachedTrails = loadRtgTrails();

export async function getRtgTrails(): Promise<RtgTrail[]> {
  return cachedTrails;
}

export function getRtgTrailDiagnostics(): TrailLoadDiagnostics {
  return (
    diagnosticsCache ?? {
      validTrailCount: cachedTrails.length,
      skippedTrailCount: 0,
    }
  );
}
