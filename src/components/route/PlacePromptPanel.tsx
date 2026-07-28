"use client";

import { useState } from "react";

import { Button, Card, LoadingSpinner } from "@/components/ui";
import type { Attraction, Coordinates } from "@/lib/types";

interface ExtractPlacesResponse {
  extractedNames?: string[];
  attractions?: Attraction[];
  unresolvedNames?: string[];
  error?: string;
}

interface PlacePromptPanelProps {
  /** Biases geocoding so "Habima" resolves in the right city. */
  nearLocation?: Coordinates | null;
  /** Accepted places become `explicitAttractions` on the next walk build. */
  acceptedAttractions: Attraction[] | null;
  onAcceptAttractions: (attractions: Attraction[] | null) => void;
  /** Fly the map to a found place so the user can check we got the right one. */
  onPreview: (coordinates: Coordinates, name: string) => void;
  /** Keeps the map's candidate markers in sync with the list shown here. */
  onFoundPlacesChange: (attractions: Attraction[]) => void;
  /**
   * Mirrors the "Remember my preferences" setting. When true the same text is
   * also read for what the walker likes, and stored on their profile if they
   * are signed in. Defaults to off so nothing is learned unless asked for.
   */
  learnPreferences?: boolean;
}

export function PlacePromptPanel({
  nearLocation,
  acceptedAttractions,
  onAcceptAttractions,
  onPreview,
  onFoundPlacesChange,
  learnPreferences = false,
}: PlacePromptPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  // Extraction is fuzzy — the user drops the ones we got wrong before accepting.
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [unresolvedNames, setUnresolvedNames] = useState<string[]>([]);
  const [hasResult, setHasResult] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extract = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      setError("Describe the places you want to see.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setHasResult(false);
    // Drop the previous run's pins now — a failed extraction must not leave the
    // old candidates sitting on the map.
    onFoundPlacesChange([]);
    try {
      const res = await fetch("/api/extract-places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmed,
          nearLocation: nearLocation ?? undefined,
          learnPreferences,
        }),
      });
      const data = (await res.json()) as ExtractPlacesResponse;

      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Failed to extract places.");
      }

      setAttractions(data.attractions ?? []);
      setRemovedIds([]);
      onFoundPlacesChange(data.attractions ?? []);
      setUnresolvedNames(data.unresolvedNames ?? []);
      setHasResult(true);
    } catch (extractError) {
      setError(
        extractError instanceof Error
          ? extractError.message
          : "Failed to extract places.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const selectedAttractions = attractions.filter(
    (attraction) => !removedIds.includes(attraction.id),
  );

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="font-display text-base font-bold text-forest">
          Name your own stops
        </h2>
        <p className="text-xs text-charcoal/60">
          Type where you want to go — we&apos;ll find the places and build the
          walk around them.
        </p>
      </div>

      <textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        rows={3}
        placeholder="I want to see Habima Square, the Jaffa port, and a good market"
        className="w-full rounded-md border border-charcoal/15 px-3 py-2 text-base sm:text-sm focus:border-terra focus:outline-none"
      />

      <Button onClick={() => void extract()} disabled={isLoading} fullWidth>
        {isLoading ? (
          <span className="inline-flex items-center gap-2">
            <LoadingSpinner size="sm" />
            Finding places…
          </span>
        ) : (
          "Find these places"
        )}
      </Button>

      {error && (
        <p className="rounded-md bg-rose-50 p-2 text-xs text-rose-700">{error}</p>
      )}

      {hasResult && selectedAttractions.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-charcoal/80">
            Found — tap a place to see it on the map
          </p>
          <ul className="space-y-1">
            {selectedAttractions.map((attraction) => (
              <li
                key={attraction.id}
                className="flex items-center justify-between gap-2 rounded-md border border-charcoal/10 bg-cream/70 px-3 py-2 text-xs text-charcoal/80 hover:bg-cream"
              >
                <button
                  type="button"
                  onClick={() =>
                    onPreview(attraction.coordinates, attraction.name)
                  }
                  className="flex-1 cursor-pointer text-left"
                >
                  {attraction.name}
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${attraction.name}`}
                  onClick={() => {
                    const next = [...removedIds, attraction.id];
                    setRemovedIds(next);
                    onFoundPlacesChange(
                      attractions.filter((a) => !next.includes(a.id)),
                    );
                  }}
                  className="cursor-pointer text-sm leading-none text-charcoal/40 transition hover:text-rose-600"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasResult && unresolvedNames.length > 0 && (
        <div className="rounded-md bg-amber-50 p-2 text-xs text-amber-800">
          Couldn&apos;t locate: {unresolvedNames.join(", ")}. Try a more specific
          name.
        </div>
      )}

      {hasResult && attractions.length === 0 && unresolvedNames.length === 0 && (
        <p className="text-xs text-charcoal/60">
          No places found in that text — mention them by name.
        </p>
      )}

      {attractions.length > 0 &&
        (acceptedAttractions ? (
          <div className="space-y-2">
            <p className="rounded-md bg-terra/10 p-2 text-xs text-forest">
              {acceptedAttractions.length} stop
              {acceptedAttractions.length === 1 ? "" : "s"} will be used for the
              next walk you build.
            </p>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => onAcceptAttractions(null)}
            >
              Clear these stops
            </Button>
          </div>
        ) : selectedAttractions.length > 0 ? (
          <Button
            variant="secondary"
            fullWidth
            onClick={() => onAcceptAttractions(selectedAttractions)}
          >
            Use these stops in my walk
          </Button>
        ) : (
          <p className="text-xs text-charcoal/60">
            You removed every place — search again to start over.
          </p>
        ))}
    </Card>
  );
}
