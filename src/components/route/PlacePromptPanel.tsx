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

      {hasResult && attractions.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-700">Found</p>
          <ul className="space-y-1">
            {attractions.map((attraction) => (
              <li
                key={attraction.id}
                className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"
              >
                {attraction.name}
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
        ) : (
          <Button
            variant="secondary"
            fullWidth
            onClick={() => onAcceptAttractions(attractions)}
          >
            Use these stops in my walk
          </Button>
        ))}
    </Card>
  );
}
