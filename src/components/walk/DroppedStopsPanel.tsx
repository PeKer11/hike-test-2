"use client";

import { Card } from "@/components/ui";
import { CATEGORY_EMOJI } from "@/lib/constants/categories";
import type { LostStop } from "@/lib/walk/planner-actions";

interface Props {
  stops: LostStop[];
  onRecall: (attractionId: string) => void;
  onDismiss: () => void;
}

/**
 * What the last rebuild cost, and one tap to undo it.
 *
 * A card in the sidebar rather than a toast or one of the fixed banners, and
 * the choice is about how long the information stays true. The three banners
 * (`OffRouteNotification`, `PaceConfirmationNotification`,
 * `DeviationConfirmationNotification`) are *questions with a deadline* — they
 * lapse, and lapsing means something. A toast is the same shape with a shorter
 * fuse. But a stop that got cut is a standing fact about the walk: it is just
 * as true four minutes later, when the walker finally looks down and notices
 * the museum is gone, as it was the second it happened. Anything that expires
 * would make noticing late the same as not being told.
 *
 * So it borrows the shape of the card it sits next to instead — the pinned-stop
 * time warning, which is the app's existing answer to "the rebuild did
 * something to your walk you should know about, here are your options". Amber,
 * persistent, dismissible, one button per option.
 */
export function DroppedStopsPanel({ stops, onRecall, onDismiss }: Props) {
  if (stops.length === 0) return null;

  return (
    <Card className="space-y-2 border-amber-300 bg-amber-50">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-amber-800">
          Dropped from your walk
        </p>
        <button
          onClick={onDismiss}
          aria-label="Dismiss dropped stops"
          className="shrink-0 rounded-full px-1.5 text-sm text-amber-700/60 transition hover:text-amber-900"
        >
          ✕
        </button>
      </div>
      <ul className="space-y-1.5">
        {stops.map(({ attraction, reason }) => (
          <li key={attraction.id} className="flex items-center gap-2">
            <span className="text-base leading-none">
              {CATEGORY_EMOJI[attraction.category] ?? "📍"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-amber-900">
                {attraction.name}
              </p>
              <p className="text-xs text-amber-700/80">
                {reason === "behind"
                  ? "Behind you now — you'd have to turn back"
                  : "Didn't fit the time you have left"}
              </p>
            </div>
            <button
              onClick={() => onRecall(attraction.id)}
              aria-label={`Put ${attraction.name} back in the walk`}
              className="shrink-0 rounded-full border border-amber-400 bg-white px-2 py-0.5 text-xs font-medium text-amber-800 transition hover:bg-amber-100"
            >
              Put it back
            </button>
          </li>
        ))}
      </ul>
      {/* Said up front rather than discovered afterwards: recall pins, and a pin
          is the one thing the planner will not drop, so it can push the walk
          over budget. */}
      <p className="text-xs text-amber-700/80">
        Putting a stop back pins it, so it stays through later rebuilds — even if
        that runs the walk over your remaining time.
      </p>
    </Card>
  );
}
