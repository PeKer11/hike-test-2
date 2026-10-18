"use client";

import type { Habit } from "@/lib/preferences/habit-model";
import type { HabitHint } from "@/lib/preferences/habit-hints";

const DISMISS: Record<"en" | "he", string> = { en: "Dismiss", he: "סגירה" };

/**
 * Plan-time routine hint ("You usually eat around 16:00"): a small chip with
 * fixed server-side text in the walker's language. Informational for now; the
 * walker can dismiss it. Renders nothing without hints.
 */
export function HabitHintChip({
  hints,
  lang,
  onDismiss,
}: {
  hints: HabitHint[];
  lang: "en" | "he";
  onDismiss: (habit: Habit) => void;
}) {
  if (hints.length === 0) return null;
  return (
    <ul className="space-y-1" aria-label={lang === "he" ? "הצעות לפי הרגלים" : "Routine suggestions"}>
      {hints.map((h) => (
        <li
          key={h.habit}
          data-testid={`habit-hint-${h.habit}`}
          className="flex items-center gap-2 rounded-full border border-forest/20 bg-white px-3 py-1 text-xs text-charcoal/80"
        >
          <span className="flex-1">{h.text[lang]}</span>
          <button
            type="button"
            onClick={() => onDismiss(h.habit)}
            aria-label={DISMISS[lang]}
            className="px-1 font-semibold text-charcoal/60"
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}
