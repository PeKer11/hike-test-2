import type { AttractionCategory, Coordinates } from "@/lib/types";

/** What the walker has said about the walk. Anything unset means "no limit". */
export interface WalkParams {
  timeMinutes?: number;
  radiusKm?: number;
  endDistanceKm?: number;
  paceMinPerKm?: number;
}

/** A real place Sol has seen. Sol only ever refers to it by `id`. */
export interface Candidate {
  id: string;
  name: string;
  coordinates: Coordinates;
  category: AttractionCategory | "area";
  placeId: string;
  distanceMeters?: number;
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
}
