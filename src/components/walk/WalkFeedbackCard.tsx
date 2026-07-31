"use client";

import { useState } from "react";

import { Button, Card } from "@/components/ui";
import { CATEGORY_EMOJI } from "@/lib/constants/categories";
import type { Attraction } from "@/lib/types";

interface WalkFeedbackCardProps {
  /** The stops the finished walk was made of — one rating row per stop. */
  attractions: Attraction[];
  /** Mirrors the "Remember my preferences" setting; the server re-checks it. */
  learnPreferences: boolean;
  onDismiss: () => void;
}

/**
 * Post-walk question, asked per stop rather than about the walk as a whole: a
 * walk with a museum and a park used to send both the same signal even when the
 * walker only cared about one of them.
 *
 * Every tap is sent on its own, so a walker who rates two stops and pockets the
 * phone keeps those two. Deliberately dismissable at any point — it appears
 * while the walker is putting their phone away, so it can never block anything
 * or demand an answer for every stop.
 */
export function WalkFeedbackCard({
  attractions,
  learnPreferences,
  onDismiss,
}: WalkFeedbackCardProps) {
  const [ratings, setRatings] = useState<Record<string, boolean>>({});
  const [comment, setComment] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const send = async (body: Record<string, unknown>) => {
    try {
      await fetch("/api/walk-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, learnPreferences }),
      });
    } catch {
      // Nothing to say to the walker: they rated a walk that is already over,
      // and a retry prompt would be more annoying than the lost signal.
    }
  };

  const rate = (attraction: Attraction, liked: boolean) => {
    setRatings((current) => ({ ...current, [attraction.id]: liked }));
    void send({
      ratings: [
        {
          id: attraction.id,
          name: attraction.name,
          lat: attraction.coordinates.lat,
          lng: attraction.coordinates.lng,
          category: attraction.category,
          liked,
        },
      ],
    });
  };

  const submitComment = async () => {
    setIsSaving(true);
    await send({ comment: comment.trim() });
    setIsSaving(false);
    setIsDone(true);
  };

  if (isDone) {
    return (
      <Card className="space-y-2">
        <p className="text-sm text-charcoal/80">
          Thanks — that shapes your next walk.
        </p>
        <Button variant="secondary" fullWidth onClick={onDismiss}>
          Close
        </Button>
      </Card>
    );
  }

  const ratedCount = Object.keys(ratings).length;

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-bold text-forest">
            How were the stops?
          </h2>
          <p className="text-xs text-charcoal/60">
            Rate any of them — one tap each, skip the rest.
          </p>
        </div>
        <button
          type="button"
          aria-label="Dismiss feedback"
          onClick={onDismiss}
          className="cursor-pointer text-sm leading-none text-charcoal/40 transition hover:text-charcoal/70"
        >
          ×
        </button>
      </div>

      <ul className="divide-y divide-charcoal/10 rounded-lg border border-charcoal/10">
        {attractions.map((attraction) => {
          const rating = ratings[attraction.id];

          return (
            <li
              key={attraction.id}
              className="flex items-center justify-between gap-2 px-3 py-2"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="text-base leading-none">
                  {CATEGORY_EMOJI[attraction.category] ?? "📍"}
                </span>
                <span className="truncate text-sm text-charcoal/80">
                  {attraction.name}
                </span>
              </div>
              <button
                type="button"
                onClick={() => rate(attraction, true)}
                aria-label={`Liked ${attraction.name}`}
                aria-pressed={rating === true}
                className={`shrink-0 rounded-full px-1.5 py-0.5 text-sm transition ${
                  rating === true
                    ? "bg-terra/15 opacity-100"
                    : "opacity-30 hover:opacity-70"
                }`}
              >
                👍
              </button>
              <button
                type="button"
                onClick={() => rate(attraction, false)}
                aria-label={`Did not like ${attraction.name}`}
                aria-pressed={rating === false}
                className={`shrink-0 rounded-full px-1.5 py-0.5 text-sm transition ${
                  rating === false
                    ? "bg-charcoal/10 opacity-100"
                    : "opacity-30 hover:opacity-70"
                }`}
              >
                👎
              </button>
            </li>
          );
        })}
      </ul>

      <div className="space-y-2">
        <label className="block text-xs font-medium text-charcoal/80">
          Anything else about this walk? (optional)
        </label>
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={2}
          placeholder="I loved the nature stops, less into the shopping streets"
          className="w-full rounded-md border border-charcoal/15 px-3 py-2 text-base sm:text-sm focus:border-terra focus:outline-none"
        />
        <Button
          fullWidth
          disabled={isSaving || !comment.trim()}
          onClick={() => void submitComment()}
        >
          {isSaving ? "Saving…" : "Send"}
        </Button>
      </div>

      <button
        type="button"
        onClick={ratedCount > 0 ? () => setIsDone(true) : onDismiss}
        className="w-full cursor-pointer text-center text-xs text-charcoal/40 transition hover:text-charcoal/70"
      >
        {ratedCount > 0 ? "Done" : "Skip"}
      </button>
    </Card>
  );
}
