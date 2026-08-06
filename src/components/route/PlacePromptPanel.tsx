"use client";

import { useState } from "react";

import { Button, Card, LoadingSpinner } from "@/components/ui";
import type { Attraction, AttractionCategory, Coordinates } from "@/lib/types";

interface ExtractPlacesResponse {
  extractedNames?: string[];
  attractions?: Attraction[];
  unresolvedNames?: string[];
  contextCoordinates?: Coordinates | null;
  durationMinutes?: number | null;
  /** The prompt named a place and nothing else — ask what kind of walk. */
  needsClarification?: boolean;
  clarificationCategories?: AttractionCategory[];
  error?: string;
}

// Chip labels. The stored category names are a scoring vocabulary, not the
// words anyone would answer "what kind of walk?" with.
const CATEGORY_LABELS: Record<AttractionCategory, string> = {
  landmark: "History & landmarks",
  museum: "Museums",
  park: "Parks",
  food: "Food",
  viewpoint: "Views",
  religious: "Religious sites",
  shopping: "Shopping",
  entertainment: "Things to do",
  nature: "Nature",
  other: "Anything",
};

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
   * Fired when the text stated how long the walk is ("I have three hours"), so
   * the companion panel's time field can start from it. Nothing is fired when
   * no duration was stated — the field keeps whatever it had.
   */
  onDurationDetected?: (minutes: number) => void;
  /**
   * Fired when the text named an area we could locate ("in Zichron Yaakov"), so
   * the companion panel's coordinate fields can start from it. Nothing is fired
   * when no area was named or it could not be geocoded — the fields keep
   * whatever they had.
   */
  onOriginDetected?: (coordinates: Coordinates) => void;
  /**
   * Mirrors the "Remember my preferences" setting. When true the same text is
   * also read for what the walker likes, and stored on their profile if they
   * are signed in. Defaults to off so nothing is learned unless asked for.
   */
  learnPreferences?: boolean;
  /**
   * Whether the walk may add discovered stops on top of the named ones.
   *
   * Off by default, and that is the whole point of it existing. Naming three
   * places and allowing three hours is not a request for as many stops as three
   * hours holds — it is a request for those three places, with time to spare.
   * The app used to read the leftover budget as an instruction to keep
   * inserting POIs, which is only right for the other reading of a named stop
   * ("start me here, surprise me with the rest"), and there was no way to say
   * which of the two the walker meant.
   */
  fillRemainingTime?: boolean;
  onFillRemainingTimeChange?: (fill: boolean) => void;
}

export function PlacePromptPanel({
  nearLocation,
  acceptedAttractions,
  onAcceptAttractions,
  onPreview,
  onFoundPlacesChange,
  onDurationDetected,
  onOriginDetected,
  learnPreferences = false,
  fillRemainingTime = false,
  onFillRemainingTimeChange,
}: PlacePromptPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  // Set when the prompt named a place and stated no intent at all. Cleared as
  // soon as one is picked — the question has been answered, and leaving the
  // chips up would invite the walker to answer it again.
  const [clarificationCategories, setClarificationCategories] = useState<
    AttractionCategory[]
  >([]);
  // Extraction is fuzzy — the user drops the ones we got wrong before accepting.
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [unresolvedNames, setUnresolvedNames] = useState<string[]>([]);
  const [hasResult, setHasResult] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extract = async (categoryNeeds?: AttractionCategory[]) => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      setError("Describe the places you want to see.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setHasResult(false);
    setClarificationCategories([]);
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
          categoryNeeds,
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
      setClarificationCategories(
        data.needsClarification ? (data.clarificationCategories ?? []) : [],
      );

      if (typeof data.durationMinutes === "number") {
        onDurationDetected?.(data.durationMinutes);
      }

      if (data.contextCoordinates) {
        onOriginDetected?.(data.contextCoordinates);
      }
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

      {/* Asked instead of silently guessing a generic walk. The walk we would
          have guessed is still there underneath — tapping a chip just re-runs
          the same prompt with an answer, it does not block anything. */}
      {clarificationCategories.length > 0 && (
        <div className="space-y-2 rounded-md bg-cream/70 p-2">
          <p className="text-xs text-charcoal/80">
            What kind of walk are you after?
          </p>
          <div className="flex flex-wrap gap-2">
            {clarificationCategories.map((category) => (
              <button
                key={category}
                type="button"
                disabled={isLoading}
                onClick={() => void extract([category])}
                className="cursor-pointer rounded-full border border-terra/40 bg-white px-3 py-1 text-xs text-forest transition hover:bg-terra/10 disabled:cursor-default disabled:opacity-50"
              >
                {CATEGORY_LABELS[category]}
              </button>
            ))}
          </div>
        </div>
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
            {/* Asked here rather than in settings because this is the only
                moment the question exists — the walker has just named stops and
                is about to build the walk around them. */}
            <label className="flex items-start gap-2 text-xs text-charcoal/70">
              <input
                type="checkbox"
                checked={fillRemainingTime}
                onChange={(event) =>
                  onFillRemainingTimeChange?.(event.target.checked)
                }
                className="mt-0.5 h-4 w-4 rounded border-charcoal/15 text-terra focus:ring-terra"
              />
              <span>
                Add more stops to fill my time
                <span className="block text-charcoal/50">
                  {fillRemainingTime
                    ? "We'll find extra places to use up whatever time is left over."
                    : "Off — you'll get a walk through exactly these stops, even if time is left over."}
                </span>
              </span>
            </label>
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
