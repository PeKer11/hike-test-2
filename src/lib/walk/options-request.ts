import { simplifyPath } from "@/lib/places/path";
import type { Coordinates } from "@/lib/types";
import type { DiscoveryItem } from "@/lib/types/discovery";
import {
  buildDirectionOptions,
  type DirectionOption,
} from "./direction-options";
import {
  OPTIONS_ROUNDTRIP_MAX_M,
  OPTIONS_ROUNDTRIP_MIN_M,
  OPTIONS_PLAN_MAX_POINTS,
  OPTIONS_WALKED_MAX_POINTS,
} from "./discovery-cadence";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Everything the option generator needs, read from the live walk at call time. */
export interface OptionsContext {
  origin: Coordinates;
  /** Where the old plan was heading, or the walk's start: `/api/walk-options` needs one. */
  endAnchor: Coordinates | null;
  /** Full walked track, oldest first; thinned here. */
  walked: Coordinates[];
  remainingMin: number;
  speedMpm: number;
  items: DiscoveryItem[];
  excludeIds: ReadonlySet<string>;
  /** The plan being left behind (its remaining line), for `overlapPlan`. */
  abandonedPlan: Coordinates[];
}

export type OfferTheme = "nature" | "food" | "short" | "back";

/** One direction the walker can pick, as `/api/walk-options` routed it. */
export interface OfferedOption {
  theme: OfferTheme;
  geometry: Coordinates[];
  distanceM: number;
  minutes: number;
  /** The collection items it passes through; empty for a route-engine fallback. */
  stops: DiscoveryItem[];
  overlapWalked: number;
}

interface WalkOptionsResponse {
  options?: Array<{
    theme: OfferTheme;
    geometry: Coordinates[];
    distanceM: number;
    minutes: number;
    overlapWalked: number;
  }>;
}

/** Client-side cap on `/api/walk-options`; past it the answer is "nothing to offer". */
export const OPTIONS_REQUEST_TIMEOUT_MS = 15_000;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** The options the collection can offer, before any routing. Pure and synchronous. */
export function planDirectionOptions(ctx: OptionsContext): DirectionOption[] {
  return buildDirectionOptions({
    origin: ctx.origin,
    endAnchor: ctx.endAnchor,
    walked: simplifyPath(ctx.walked, OPTIONS_WALKED_MAX_POINTS),
    remainingMin: ctx.remainingMin,
    speedMpm: ctx.speedMpm,
    items: ctx.items,
    excludeIds: ctx.excludeIds,
  });
}

/**
 * Route planned options with one `/api/walk-options` call. Empty when the
 * server found nothing that avoids the walked track, or the call failed.
 */
export async function routeDirectionOptions(
  ctx: OptionsContext,
  built: DirectionOption[],
  doFetch: FetchLike = (input, init) => fetch(input, init),
  timeoutMs: number = OPTIONS_REQUEST_TIMEOUT_MS,
): Promise<OfferedOption[]> {
  if (built.length === 0) return [];
  // A hung request counts as a failure: the caller shows "nothing to offer".
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await postOptions(ctx, built, doFetch, controller.signal);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function postOptions(
  ctx: OptionsContext,
  built: DirectionOption[],
  doFetch: FetchLike,
  signal: AbortSignal,
): Promise<OfferedOption[]> {
  const res = await doFetch("/api/walk-options", {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      origin: ctx.origin,
      ...(ctx.endAnchor ? { endAnchor: ctx.endAnchor } : {}),
      walked: simplifyPath(ctx.walked, OPTIONS_WALKED_MAX_POINTS),
      ...(ctx.abandonedPlan.length >= 2
        ? { abandonedPlan: simplifyPath(ctx.abandonedPlan, OPTIONS_PLAN_MAX_POINTS) }
        : {}),
      options: built.map((o) => ({
        theme: o.theme,
        mode: o.mode,
        stops: o.stops.map((s) => s.attraction.coordinates),
        score: o.score,
        ...(o.seed !== undefined ? { seed: o.seed } : {}),
        ...(o.roundTripLengthM !== undefined
          ? {
              roundTripLengthM: clamp(
                Math.round(o.roundTripLengthM),
                OPTIONS_ROUNDTRIP_MIN_M,
                OPTIONS_ROUNDTRIP_MAX_M,
              ),
            }
          : {}),
      })),
    }),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as WalkOptionsResponse;
  return (data.options ?? []).flatMap((o) => {
    // Themes are unique within a request, so the theme finds the stops again.
    const source = built.find((b) => b.theme === o.theme);
    if (!source || !Array.isArray(o.geometry) || o.geometry.length < 2) return [];
    return [
      {
        theme: o.theme,
        geometry: o.geometry,
        distanceM: o.distanceM,
        minutes: o.minutes,
        stops: source.stops,
        overlapWalked: o.overlapWalked,
      },
    ];
  });
}
