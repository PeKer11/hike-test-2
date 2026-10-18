import { amenityKindOfTags } from "@/lib/attractions/amenity-tags";
import { poiKey } from "@/lib/preferences/poi-key";
import type { QuestionEntry, WalkEndInput } from "@/lib/preferences/companion-memory";
import type { Attraction, Coordinates, NearbyPlace } from "@/lib/types";
import type { DiscoveryItem, WalkEnvironment } from "@/lib/types/discovery";
import { haversineDistance } from "@/lib/utils/geo";
import { canOfferAdd } from "@/lib/walk/detour-offer";
import type { CopyLang } from "@/lib/walk/discovery-copy";
import { companionText, questionKey } from "@/lib/walk/companion-copy";

import { pickAmenity, type AmenityItem } from "./amenity-detour";
import type { AmenityKind, AskRecord, Candidate } from "./companion-types";
import {
  heatCandidate,
  rainCandidate,
  type ConditionsSnapshot,
} from "./producers/conditions";
import {
  habitCandidates,
  type HabitTickExtras,
  type HabitTickFacts,
} from "./habit-ticker";
import { paceCandidate, type PaceStop } from "./producers/pace";
import { towardGreenCandidate } from "./producers/places";
import { sunsetCandidate } from "./producers/sunset";

/**
 * Pure glue between the planner screen and the companion modules: what to feed
 * the producers, how a candidate becomes card text, what a finished walk
 * writes to memory. Nothing here touches the DOM, the clock or the network.
 */

/** How often the ticker looks for something to ask. */
export const COMPANION_TICK_MS = 15_000;
/** Weather is read at walk start, then at most this often. */
export const CONDITIONS_REFRESH_MS = 60 * 60_000;

export function conditionsDue(lastFetchMs: number | null, nowMs: number): boolean {
  return lastFetchMs === null || nowMs - lastFetchMs >= CONDITIONS_REFRESH_MS;
}

/**
 * Hebrew UI when the browser language says so; the document (layout) language
 * is only the fallback when the browser reports none, because the app itself
 * writes `document.documentElement.lang` and must never read its own answer back.
 */
export function detectUiLang(
  documentLang?: string | null,
  navigatorLang?: string | null,
): CopyLang {
  const tag = (navigatorLang || documentLang || "").toLowerCase();
  return tag.startsWith("he") || tag.startsWith("iw") ? "he" : "en";
}

// --- amenities ----------------------------------------------------------------

/** Water / toilets from the scan, with their place along the route when known. */
export function amenityItemsFromPlaces(
  places: NearbyPlace[],
  frameOf: (p: Coordinates) => { alongM: number; lateralM: number } | null,
): AmenityItem[] {
  const out: AmenityItem[] = [];
  for (const p of places) {
    const kind = amenityKindOfTags(p.tags ?? {});
    if (!kind) continue;
    const frame = frameOf(p.coordinates);
    out.push({
      id: p.id,
      kind,
      name: p.tags?.name,
      coordinates: p.coordinates,
      lateralM: frame?.lateralM ?? null,
      alongM: frame?.alongM ?? null,
    });
  }
  return out;
}

// --- candidates ---------------------------------------------------------------

export interface PaceAdviceInput {
  advice: "slow" | "fast";
  currentPaceMinPerKm: number;
  plannedPaceMinPerKm: number;
}

export interface TickInput {
  /** Fix timestamp, ms (never the wall clock). */
  nowMs: number;
  position: Coordinates;
  environment: WalkEnvironment;
  /** Walking speed, metres per minute. */
  speedMpm: number;
  remainingWalkMin: number;
  /** Stops not yet visited, in visit order. */
  remainingStops: PaceStop[];
  pace: PaceAdviceInput | null;
  /** A collection place worth adding when the walker is ahead of time. */
  addPlace: { name: string; detourMin: number } | null;
  conditions: ConditionsSnapshot | null;
  amenities: AmenityItem[];
  walkerAlongM: number | null;
  green: { parkName: string; score: number; headingTowardM: number } | null;
  /**
   * Routine-habit inputs; absent/null without the walker's learning consent
   * (then no habit question is ever built). `items` and `lang` feed it.
   */
  habit?: (HabitTickFacts & HabitTickExtras & { items: DiscoveryItem[]; lang: CopyLang }) | null;
}

/** Every question worth considering right now; the arbiter picks at most one. */
export function buildCandidates(i: TickInput): Candidate[] {
  const out: Candidate[] = [];
  const droppable = [...i.remainingStops].reverse().find((s) => !s.pinned);

  if (i.pace) {
    const c = paceCandidate({
      advice: i.pace.advice,
      currentPaceMinPerKm: i.pace.currentPaceMinPerKm,
      plannedPaceMinPerKm: i.pace.plannedPaceMinPerKm,
      remainingPlannedMin: i.remainingWalkMin,
      remainingStops: i.remainingStops,
      addPlace: i.addPlace ?? undefined,
      nowMs: i.nowMs,
    });
    if (c) out.push(c);
  }

  const sunset = sunsetCandidate({
    nowMs: i.nowMs,
    position: i.position,
    remainingWalkMin: i.remainingWalkMin,
    dropStopId: droppable?.id,
    remainingStopCount: i.remainingStops.length,
  });
  if (sunset) out.push(sunset);

  if (i.conditions) {
    const water = pickAmenity({
      items: i.amenities,
      kind: "drinking_water",
      position: i.position,
      environment: i.environment,
      speedMpm: i.speedMpm,
      remainingWalkMin: i.remainingWalkMin,
      walkerAlongM: i.walkerAlongM,
    });
    const heat = heatCandidate(
      i.conditions,
      water ? { name: water.item.name ?? "", distM: water.distM } : null,
      i.nowMs,
    );
    if (heat) out.push(heat);
    const rain = rainCandidate(i.conditions, i.nowMs);
    if (rain) out.push(rain);
  }

  if (i.green) {
    const g = towardGreenCandidate({ ...i.green, nowMs: i.nowMs });
    if (g) out.push(g);
  }

  if (i.habit) {
    const { items, lang, weeklyAsks, askedThisWalk, ...facts } = i.habit;
    out.push(
      ...habitCandidates({
        facts,
        extras: { weeklyAsks, askedThisWalk },
        items,
        amenities: i.amenities,
        position: i.position,
        environment: i.environment,
        speedMpm: i.speedMpm,
        remainingWalkMin: i.remainingWalkMin,
        walkerAlongM: i.walkerAlongM,
        nowMs: i.nowMs,
        lang,
      }),
    );
  }
  return out;
}

/** The amenity to route to for an answered find-amenity question, recomputed at answer time. */
export function amenityForAnswer(
  i: Pick<
    TickInput,
    "amenities" | "position" | "environment" | "speedMpm" | "remainingWalkMin" | "walkerAlongM"
  >,
  kind: AmenityKind,
) {
  return pickAmenity({ ...i, items: i.amenities, kind });
}

// --- "toward green" -----------------------------------------------------------

/**
 * A park or wood the walker is heading toward. A satellite (detected) find is
 * never a target: it is not a registered place and must not be suggested as a
 * destination.
 */
export function isGreenTarget(item: DiscoveryItem): boolean {
  if (item.tier === "detected") return false;
  if (item.state === "dismissed" || item.state === "visited") return false;
  const c = item.attraction.category;
  return item.kind === "scenery" || c === "park" || c === "nature";
}

export const GREEN_MAX_DISTANCE_M = 500;
export const GREEN_MAX_ANGLE_DEG = 30;

function bearingDeg(a: Coordinates, b: Coordinates): number {
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la = (a.lat * Math.PI) / 180;
  const lb = (b.lat * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lb);
  const x = Math.cos(la) * Math.sin(lb) - Math.sin(la) * Math.cos(lb) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function angleDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** The best green place within 500 m, within 30 degrees of the walker's heading. */
export function pickGreenTarget(
  items: DiscoveryItem[],
  position: Coordinates,
  headingDeg: number | null,
): { item: DiscoveryItem; distanceM: number } | null {
  if (headingDeg === null || !Number.isFinite(headingDeg)) return null;
  let best: { item: DiscoveryItem; distanceM: number } | null = null;
  for (const item of items) {
    if (!isGreenTarget(item)) continue;
    const distanceM = haversineDistance(position, item.attraction.coordinates);
    if (distanceM > GREEN_MAX_DISTANCE_M || distanceM < 20) continue;
    if (angleDiff(bearingDeg(position, item.attraction.coordinates), headingDeg) > GREEN_MAX_ANGLE_DEG) continue;
    if (best === null || item.score > best.item.score) best = { item, distanceM };
  }
  return best;
}

/** Metres walked continuously toward the same target; resets when it changes or the walker turns away. */
export class TowardGreenTracker {
  private id: string | null = null;
  private startM = 0;
  private lastM = 0;

  update(target: { id: string; distanceM: number } | null): number {
    if (target === null) {
      this.id = null;
      return 0;
    }
    if (target.id !== this.id || target.distanceM > this.lastM + 15) {
      this.id = target.id;
      this.startM = target.distanceM;
    }
    this.lastM = target.distanceM;
    return Math.max(0, this.startM - target.distanceM);
  }
}

// --- card text ------------------------------------------------------------------

export interface QuestionCard {
  id: string;
  title: string;
  answers: Array<{ id: string; label: string }>;
}

/** The question and its answer labels in the walker's language. */
export function questionCard(cand: Candidate, lang: CopyLang, shownAtMs: number): QuestionCard {
  return {
    id: `companion-${cand.kind}-${shownAtMs}`,
    title: companionText(lang, questionKey(cand.kind, cand.context), cand.context),
    answers: cand.answers.map((a) => ({
      id: a.id,
      label: companionText(lang, a.label, cand.context),
    })),
  };
}

// --- walk end ---------------------------------------------------------------------

export function questionEntries(records: AskRecord[]): QuestionEntry[] {
  return records.map((r) => ({
    kind: r.kind,
    answer: r.outcome === "ignored" || !r.answerId ? "ignored" : r.answerId,
  }));
}

/** Visited / dismissed / added places of this walk as interaction rows (no coordinates, no free text). */
export function interactionsFromItems(items: DiscoveryItem[]): WalkEndInput["interactions"] {
  const out: WalkEndInput["interactions"] = [];
  for (const item of items) {
    if (item.tier === "detected") continue;
    const kind =
      item.state === "visited" ? "visited" : item.state === "dismissed" ? "dismissed" : item.state === "added" ? "added" : null;
    if (!kind) continue;
    const a: Attraction = item.attraction;
    const key = poiKey({
      osmId: a.id.startsWith("osm-") ? a.id : null,
      name: a.name,
      lat: a.coordinates.lat,
      lng: a.coordinates.lng,
    });
    if (key === "") continue;
    out.push({ poiKey: key, kind, category: a.category });
  }
  return out;
}

/** Add-offer: the best collection place the walker can afford to add right now. */
export function pickAddPlace(
  items: DiscoveryItem[],
  args: { speedMpm: number; remainingWalkMin: number; environment: WalkEnvironment },
): { name: string; detourMin: number } | null {
  let best: DiscoveryItem | null = null;
  for (const item of items) {
    if (item.tier !== "registered" || item.state !== "new" || item.frame === null) continue;
    if (
      !canOfferAdd({
        lateralM: item.frame.lateralM,
        fallbackDistanceM: Math.abs(item.frame.lateralM),
        speedMpm: args.speedMpm,
        remainingWalkMin: args.remainingWalkMin,
        environment: args.environment,
      })
    ) {
      continue;
    }
    if (best === null || item.score > best.score) best = item;
  }
  return best ? { name: best.attraction.name, detourMin: best.detourMin } : null;
}
