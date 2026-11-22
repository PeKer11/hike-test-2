import type { Coordinates } from "@/lib/types";
import { boundsOf } from "@/lib/utils/geo";

export interface FitPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** How long the "whole route" view holds the map before it goes back to following the walker. */
export const OVERVIEW_HOLD_MS = 60_000;

/**
 * Room to keep clear when the map fits the whole route, in px. While walking, the stop chip row runs along the top
 * (72 px), and on a wide screen the zoom control sits on the end side; the map already ends above the sheet, so the
 * bottom needs only a margin. On a phone the controls overlay the corner, so the sides need only a margin too.
 */
export function fitPadding(hudInset: boolean, isPhone: boolean): FitPadding {
  const side = isPhone ? 24 : 64;
  return { top: hudInset ? 72 : 24, right: side, bottom: 24, left: side };
}

/**
 * What the "whole route" view has to show: the route still ahead, the part already walked, and where the walker is.
 * Null when there is nothing to frame yet (fewer than two points in all).
 */
export function overviewBounds(
  remaining: Coordinates[] | undefined,
  walked: Coordinates[] | undefined,
  position: Coordinates | undefined,
): { north: number; south: number; east: number; west: number } | null {
  const all = [...(remaining ?? []), ...(walked ?? []), ...(position ? [position] : [])];
  return boundsOf(all);
}
