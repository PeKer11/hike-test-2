"use client";

import { useEffect, useState } from "react";

import type { StoredFact } from "@/lib/preferences/fact-extractor";

/**
 * "Things I remember about you" — the standing facts the app has picked up from
 * what the walker typed, each with when it was last heard and a way to delete
 * it.
 *
 * Not optional dressing. These facts go in front of the model on every walk the
 * walker asks for, and a memory that silently changes results but cannot be
 * inspected or removed is the worst version of this feature. It ships alongside
 * the injection, not after it.
 */

interface StandingFactsPanelProps {
  /** Whether there is an account to read facts from. */
  isSignedIn?: boolean;
  /**
   * Mirrors the "Remember my preferences" setting — the same gate the writes
   * are behind. With learning off nothing new is recorded, but what is already
   * stored still shows, because that is exactly when a walker wants to look.
   */
  learnPreferences?: boolean;
}

/** How long ago a fact was last heard, in words rather than a timestamp. */
function lastHeard(timestamp: number, now: number): string {
  const days = Math.floor((now - timestamp) / (24 * 60 * 60 * 1000));

  if (days <= 0) return "heard today";
  if (days === 1) return "heard yesterday";
  if (days < 30) return `heard ${days} days ago`;

  const months = Math.floor(days / 30);
  return months === 1 ? "heard a month ago" : `heard ${months} months ago`;
}

export function StandingFactsPanel({
  isSignedIn = false,
  learnPreferences = false,
}: StandingFactsPanelProps) {
  const [facts, setFacts] = useState<StoredFact[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  // Read once, when the facts land, rather than on every render: "heard 3 days
  // ago" must not change under the walker because something else re-rendered.
  const [loadedAt, setLoadedAt] = useState(0);

  useEffect(() => {
    if (!isSignedIn) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch("/api/standing-facts");
        if (!res.ok) return;

        const rows = (await res.json()) as StoredFact[];
        if (cancelled || !Array.isArray(rows)) return;

        setFacts(rows);
        setLoadedAt(Date.now());
      } catch {
        // Offline, or nothing stored — an empty list is the honest answer.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSignedIn]);

  /**
   * Dropped locally first and then on the account. The walker asked for the
   * fact gone; leaving it on screen while a request is in flight reads as
   * hesitation about whether they meant it.
   */
  const forget = (factId: string) => {
    setFacts((current) => current.filter((fact) => fact.id !== factId));

    void fetch(`/api/standing-facts?id=${encodeURIComponent(factId)}`, {
      method: "DELETE",
    }).catch(() => {
      // Nothing to report: the row the walker was looking at is already gone.
    });
  };

  if (!isSignedIn || facts.length === 0) {
    return null;
  }

  return (
    <section className="space-y-2 rounded-[10px] border border-charcoal/10 bg-cream/60 p-3">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full cursor-pointer items-center justify-between text-sm font-medium text-charcoal/80 hover:text-forest"
      >
        <span>Things I remember about you ({facts.length})</span>
        <span aria-hidden="true">{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && (
        <>
          <ul aria-label="Things I remember about you" className="space-y-1">
            {facts.map((fact) => (
              <li
                key={fact.id}
                className="flex items-center justify-between gap-2 rounded-md bg-white/70 px-2 py-1.5 text-xs"
              >
                <span className="text-charcoal/80">
                  {fact.text}
                  <span className="ml-2 text-charcoal/40">
                    {lastHeard(fact.lastSeenAt, loadedAt)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => forget(fact.id)}
                  aria-label={`Forget "${fact.text}"`}
                  className="shrink-0 cursor-pointer text-charcoal/40 hover:text-terra"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-charcoal/60">
            {learnPreferences
              ? "These shape how we read what you ask for. Delete anything that isn't true."
              : "Preference learning is off, so nothing new is being added — but these are still used."}
          </p>
        </>
      )}
    </section>
  );
}
