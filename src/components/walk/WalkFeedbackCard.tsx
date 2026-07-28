"use client";

import { useState } from "react";

import { Button, Card } from "@/components/ui";
import type { AttractionCategory } from "@/lib/types";

interface WalkFeedbackCardProps {
  /** Categories the finished walk was made of — what the rating is recorded against. */
  categories: AttractionCategory[];
  /** Mirrors the "Remember my preferences" setting; the server re-checks it. */
  learnPreferences: boolean;
  onDismiss: () => void;
}

/**
 * Post-walk question. Deliberately answerable in one tap and dismissable at any
 * point — it appears while the walker is putting their phone away, so it can
 * never block anything or demand an answer.
 */
export function WalkFeedbackCard({
  categories,
  learnPreferences,
  onDismiss,
}: WalkFeedbackCardProps) {
  const [liked, setLiked] = useState<boolean | null>(null);
  const [comment, setComment] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const submit = async (likedValue: boolean, commentValue: string) => {
    setIsSaving(true);
    try {
      await fetch("/api/walk-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          liked: likedValue,
          comment: commentValue.trim() || undefined,
          categories,
          learnPreferences,
        }),
      });
    } catch {
      // Nothing to say to the walker: they rated a walk that is already over,
      // and a retry prompt would be more annoying than the lost signal.
    } finally {
      setIsSaving(false);
      setIsDone(true);
    }
  };

  if (isDone) {
    return (
      <Card className="space-y-2">
        <p className="text-sm text-slate-700">
          Thanks — that shapes your next walk.
        </p>
        <Button variant="secondary" fullWidth onClick={onDismiss}>
          Close
        </Button>
      </Card>
    );
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Did you like this walk?
          </h2>
          <p className="text-xs text-slate-500">
            One tap is enough — it helps us build your next one.
          </p>
        </div>
        <button
          type="button"
          aria-label="Dismiss feedback"
          onClick={onDismiss}
          className="cursor-pointer text-sm leading-none text-slate-400 transition hover:text-slate-600"
        >
          ×
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant={liked === true ? "primary" : "secondary"}
          onClick={() => setLiked(true)}
          disabled={isSaving}
        >
          👍 Liked it
        </Button>
        <Button
          variant={liked === false ? "primary" : "secondary"}
          onClick={() => setLiked(false)}
          disabled={isSaving}
        >
          👎 Not really
        </Button>
      </div>

      {liked !== null && (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-slate-700">
            {liked
              ? "What did you like about it? (optional)"
              : "What didn't work for you? (optional)"}
          </label>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={2}
            placeholder="I loved the nature stops, less into the shopping streets"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm focus:border-emerald-500 focus:outline-none"
          />
          <Button
            fullWidth
            disabled={isSaving}
            onClick={() => void submit(liked, comment)}
          >
            {isSaving ? "Saving…" : "Send"}
          </Button>
        </div>
      )}

      <button
        type="button"
        onClick={onDismiss}
        className="w-full cursor-pointer text-center text-xs text-slate-400 transition hover:text-slate-600"
      >
        Skip
      </button>
    </Card>
  );
}
