/** Who is walking: a stroller or a wheelchair changes the router, the pace and what counts as a bad stretch. */
export type Access = "stroller" | "wheelchair";

export interface RouteMode {
  profile: "foot-walking" | "wheelchair";
  /** ORS `options` merged into every request (avoid_features, profile_params). */
  options: Record<string, unknown>;
  /** Stable text for cache keys. */
  key: string;
}

export interface AccessProfile {
  mode: RouteMode;
  /** Slower than the walker's own pace, and climbing costs more. */
  paceFactor: number;
  climbFactor: number;
  /** Steepest comfortable grade, in percent (the walker may override it). */
  maxGradePct: number;
}

export const ACCESS_PROFILES: Record<Access, AccessProfile> = {
  stroller: {
    mode: { profile: "foot-walking", options: { avoid_features: ["steps"] }, key: "stroller" },
    paceFactor: 1.1,
    climbFactor: 1.5,
    maxGradePct: 8,
  },
  wheelchair: {
    mode: { profile: "wheelchair", options: { profile_params: { restrictions: { maximum_incline: 6, maximum_sloped_kerb: 0.06 } } }, key: "wheelchair" },
    paceFactor: 1.2,
    climbFactor: 1.5,
    maxGradePct: 6,
  },
};

export function isAccess(v: unknown): v is Access {
  return v === "stroller" || v === "wheelchair";
}

export function routeModeFor(access: Access | undefined): RouteMode | undefined {
  return access ? ACCESS_PROFILES[access].mode : undefined;
}
