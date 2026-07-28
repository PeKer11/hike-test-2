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
}

export function PlacePromptPanel({
  nearLocation,
  acceptedAttractions,
  onAcceptAttractions,
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
    try {
      const res = await fetch("/api/extract-places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmed,
          nearLocation: nearLocation ?? undefined,
        }),
      });
      const data = (await res.json()) as ExtractPlacesResponse;

      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Failed to extract places.");
      }

      setAttractions(data.attractions ?? []);
      setRemovedIds([]);
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
        <h2 className="text-base font-semibold text-slate-900">
          Name your own stops
        </h2>
        <p className="text-xs text-slate-500">
          Type where you want to go — we&apos;ll find the places and build the
          walk around them.
        </p>
      </div>

      <textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        rows={3}
        placeholder="I want to see Habima Square, the Jaffa port, and a good market"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm focus:border-emerald-500 focus:outline-none"
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
          <p className="text-xs font-medium text-slate-700">Found</p>
          <ul className="space-y-1">
            {selectedAttractions.map((attraction) => (
              <li
                key={attraction.id}
                className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"
              >
                {attraction.name}
                <button
                  type="button"
                  aria-label={`Remove ${attraction.name}`}
                  onClick={() =>
                    setRemovedIds((current) => [...current, attraction.id])
                  }
                  className="text-sm leading-none text-slate-400 transition hover:text-rose-600"
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
        <p className="text-xs text-slate-500">
          No places found in that text — mention them by name.
        </p>
      )}

      {attractions.length > 0 &&
        (acceptedAttractions ? (
          <div className="space-y-2">
            <p className="rounded-md bg-emerald-50 p-2 text-xs text-emerald-800">
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
          <p className="text-xs text-slate-500">
            You removed every place — search again to start over.
          </p>
        ))}
    </Card>
  );
}
