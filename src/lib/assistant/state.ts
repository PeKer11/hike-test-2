import type { AttractionCategory, Coordinates } from "@/lib/types";
import type { Verdict } from "@/lib/walk/rule-verdict";

/** What the walker has said about the walk. Anything unset means "no limit". */
export interface WalkParams {
  timeMinutes?: number;
  radiusKm?: number;
  endDistanceKm?: number;
  /** Cap on the total distance walked (the whole route, not the distance from the start). */
  maxWalkKm?: number;
  paceMinPerKm?: number;
  /** Never walk the same street twice. */
  noRepeat?: boolean;
  /** Street names the walker does not want to walk along. */
  avoidStreets?: string[];
  /** Avoid roads OSM marks as unsafe on foot. */
  avoidDangerous?: boolean;
  /** Town the whole walk must stay inside (a name Nominatim can resolve, e.g. "Caesarea, Israel"). */
  stayInArea?: string;
  /** Streets the walk must pass along (one point on each becomes a stop with no visiting time). */
  viaStreets?: string[];
}

/** Average adult walking pace (~4.8 km/h) until we have learned the walker's own. */
export const DEFAULT_PACE_MIN_PER_KM = 12.5;

/** Minutes spent at a stop, by kind of place. */
export function visitMinutes(category: string): number {
  if (category === "area") return 0; // a street the walk must pass: nothing to visit
  return category === "food" ? 45 : category === "museum" ? 60 : category === "park" || category === "nature" ? 25 : 30;
}

/** A real place Sol has seen. Sol only ever refers to it by `id`. */
export interface Candidate {
  id: string;
  name: string;
  coordinates: Coordinates;
  category: AttractionCategory | "area";
  placeId: string;
  distanceMeters?: number;
  /** Google rating and the number of ratings behind it (assistant nearby search only; never shown on the map). */
  rating?: number;
  ratingCount?: number;
}

const RATING_PRIOR = 4.0;
const RATING_PRIOR_WEIGHT = 10;

/**
 * How good a place looks, 1-5, from its rating shrunk toward an average place so a 5.0 from two reviews does
 * not beat a 4.6 from two thousand. A place with no rating is an average one: unrated never loses to rated.
 */
export function placeScore(c: Pick<Candidate, "rating" | "ratingCount">): number {
  if (c.rating === undefined || !c.ratingCount) return RATING_PRIOR;
  return (c.rating * c.ratingCount + RATING_PRIOR * RATING_PRIOR_WEIGHT) / (c.ratingCount + RATING_PRIOR_WEIGHT);
}

/**
 * Everything the server needs between turns. The client stores it and sends it
 * back, so the endpoint stays stateless.
 */
export interface AssistantState {
  origin: Coordinates | null;
  params: WalkParams;
  candidates: Candidate[];
  /** Candidate ids the walker has agreed to. */
  chosen: string[];
  /** The walker has answered (or waived) time / radius / distance limits. */
  limitsSettled?: boolean;
  /** Recent route checks (verdict + visiting order), so build_walk reuses what estimate_walk found. In-memory only. Only the newest check keeps its route geometry. */
  checks?: Array<{ key: string; verdict: Verdict; orderIds: string[]; geometry?: Coordinates[] }>;
}

export const EMPTY_STATE: AssistantState = {
  origin: null,
  params: {},
  candidates: [],
  chosen: [],
};

/** What a `build_walk` call asks the client to run through the existing planner. */
export interface BuildAction {
  type: "build";
  origin: Coordinates;
  params: WalkParams;
  stops: Candidate[];
  /** The walker stated an order for the stops; the walk must visit them exactly in that order. */
  ordered?: boolean;
  /** The route that was checked; the planner shows exactly this one when it is sent along. */
  geometry?: Coordinates[];
}
