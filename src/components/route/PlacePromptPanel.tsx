"use client";

import { useRef, useState } from "react";

import { Button, Card, LoadingSpinner } from "@/components/ui";
import { MAX_CATEGORY_NEEDS } from "@/lib/places/place-extractor";
import type { Attraction, AttractionCategory, Coordinates } from "@/lib/types";

interface ExtractPlacesResponse {
  extractedNames?: string[];
  attractions?: Attraction[];
  unresolvedNames?: string[];
  contextCoordinates?: Coordinates | null;
  /** The area's geocode didn't look like the area asked for — don't trust it. */
  contextLocationSuspect?: boolean;
  durationMinutes?: number | null;
  /** How many stops the prompt asked for, or null when it stated no count. */
  stopCount?: number | null;
  /** The prompt asked for famous places rather than just places. */
  notableOnly?: boolean | null;
  /** How far from the start the prompt said the walk may finish, in km. */
  maxEndDistanceKm?: number | null;
  /** How far from the origin the prompt said to search for places, in km. */
  searchRadiusKm?: number | null;
  /** The prompt named a place and nothing else — ask what kind of walk. */
  needsClarification?: boolean;
  clarificationCategories?: AttractionCategory[];
  /** The prompt named a town and nothing more specific. */
  areaOnlyPrompt?: boolean;
  /** Echoed back so a follow-up turn can see its own categories survived. */
  categoryNeeds?: AttractionCategory[];
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

/**
 * Everything the clarifying conversation has established, carried from one turn
 * to the next. Two turns is the whole of it — a kind of walk, then how long and
 * how far — so this is a merged snapshot rather than a message history.
 */
interface KnownSoFar {
  categoryNeeds: AttractionCategory[];
  durationMinutes: number | null;
  maxEndDistanceKm: number | null;
}

const NOTHING_KNOWN: KnownSoFar = {
  categoryNeeds: [],
  durationMinutes: null,
  maxEndDistanceKm: null,
};

/**
 * One thing the walker sent and what came back of it, for the session log above
 * the prompt box. Deliberately not `KnownSoFar`: that is the state of one
 * conversation and resets when a new topic starts, this is a flat record of
 * everything asked in this browser session and never resets. Nothing here is
 * read back into a request — it is display only, and it dies with the page.
 */
interface ScrollbackEntry {
  id: number;
  prompt: string;
  responseSummary: string;
  timestamp: number;
}

/** Enough to see what you just tried, not so much it becomes a transcript. */
const MAX_SCROLLBACK = 5;

const MAX_SCROLLBACK_PROMPT_CHARS = 60;

function truncatePrompt(text: string): string {
  return text.length <= MAX_SCROLLBACK_PROMPT_CHARS
    ? text
    : `${text.slice(0, MAX_SCROLLBACK_PROMPT_CHARS - 1).trimEnd()}…`;
}

/**
 * The one line the log shows for an extraction, built from what the panel
 * already reads off the response. A question asked is the outcome when one was
 * asked — the walk was not built, and saying "found 0 stops" would read as a
 * failure rather than as the app's own follow-up.
 */
function summarizeExtraction(data: ExtractPlacesResponse): string {
  if (data.needsClarification) {
    return "Asked what kind of walk you're after";
  }

  const found = data.attractions?.length ?? 0;
  const unresolved = data.unresolvedNames ?? [];

  if (found > 0) {
    const stops = `Found ${found} stop${found === 1 ? "" : "s"}`;
    return unresolved.length > 0
      ? `${stops}, couldn't locate ${unresolved.join(", ")}`
      : stops;
  }
  if (unresolved.length > 0) {
    return `Couldn't locate ${unresolved.join(", ")}`;
  }
  return "Didn't find anything for that";
}

type MissingField = "duration" | "endDistance";

/**
 * The second question, phrased for whichever halves of it are still open. A
 * walker who already said "I have three hours" should not be asked how long
 * they have — being asked something you just answered reads as not listening.
 */
function followUpQuestion(missing: MissingField[]): string {
  if (missing.length === 2) {
    return "How much time do you have, and how far do you want to end up?";
  }
  return missing[0] === "duration"
    ? "How much time do you have?"
    : "How far from where you start do you want to end up?";
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
   * Fired when the text stated how long the walk is ("I have three hours"), so
   * the companion panel's time field can start from it. Nothing is fired when
   * no duration was stated — the field keeps whatever it had.
   */
  onDurationDetected?: (minutes: number) => void;
  /**
   * Always called on a successful extraction, with null when the prompt stated
   * no count. Unlike `onDurationDetected` — which only fires on a real number
   * because it pre-fills a form field the walker may have typed in themselves —
   * these two describe the current prompt and nothing else, so a new prompt
   * without them has to clear what the last one set.
   */
  onStopCountDetected?: (count: number | null) => void;
  onNotableOnlyDetected?: (notableOnly: boolean) => void;
  /**
   * Fired when the text said how far from the start the walk may finish
   * ("finish within 1km of here"), so the companion panel's max-distance field
   * can start from it. Mirrors `onDurationDetected`: nothing is fired when no
   * distance was stated, and the field keeps whatever it had.
   */
  onMaxEndDistanceDetected?: (km: number) => void;
  /**
   * Fired when the text said how far from the origin to look for stops ("search
   * up to 10km from here"), so the companion panel's search-radius field can
   * start from it. Mirrors `onMaxEndDistanceDetected`: nothing is fired when no
   * radius was stated, and the field keeps whatever it had.
   */
  onSearchRadiusDetected?: (km: number) => void;
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
  onStopCountDetected,
  onNotableOnlyDetected,
  onMaxEndDistanceDetected,
  onSearchRadiusDetected,
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
  // The chips the walker has ticked but not yet sent. "Nature AND food" is a
  // normal answer to "what kind of walk?", so the question stays up until they
  // say they are done with it.
  const [selectedCategories, setSelectedCategories] = useState<
    AttractionCategory[]
  >([]);
  // What the conversation has established so far, across every turn of it.
  //
  // Deliberately not a transcript: nothing here is displayed, and the panel
  // never shows a thread of previous messages. It exists so the second turn
  // cannot lose the first — "3 hours, up to 1km" is a sentence about time, and
  // sending it on its own would otherwise come back with no categories and no
  // stops, silently undoing the answer the walker gave one tap earlier.
  const [known, setKnown] = useState<KnownSoFar>(NOTHING_KNOWN);
  // Which halves of "how long, and how far?" are still unanswered, or null when
  // there is nothing left to ask.
  const [followUpMissing, setFollowUpMissing] = useState<MissingField[] | null>(
    null,
  );
  const [followUpText, setFollowUpText] = useState("");
  // Extraction is fuzzy — the user drops the ones we got wrong before accepting.
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [unresolvedNames, setUnresolvedNames] = useState<string[]>([]);
  const [hasResult, setHasResult] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Everything sent this session, oldest first. Survives a new prompt on
  // purpose — `known` is per-conversation, this is per-session.
  const [scrollback, setScrollback] = useState<ScrollbackEntry[]>([]);
  const [isScrollbackOpen, setIsScrollbackOpen] = useState(false);
  const nextEntryId = useRef(0);

  const logExchange = (promptText: string, responseSummary: string) => {
    const entry: ScrollbackEntry = {
      id: nextEntryId.current++,
      prompt: promptText,
      responseSummary,
      timestamp: Date.now(),
    };
    setScrollback((current) => [...current, entry].slice(-MAX_SCROLLBACK));
  };

  const extract = async (categoryNeeds?: AttractionCategory[]) => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      setError("Describe the places you want to see.");
      return;
    }

    // A chip turn re-sends the same words, so the text alone would log two
    // identical-looking entries. The chips are what the walker actually did.
    const loggedPrompt = categoryNeeds?.length
      ? `${trimmed} — ${categoryNeeds.map((c) => CATEGORY_LABELS[c]).join(", ")}`
      : trimmed;

    setIsLoading(true);
    setError(null);
    setHasResult(false);
    setClarificationCategories([]);
    setSelectedCategories([]);
    setFollowUpMissing(null);
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

      logExchange(loggedPrompt, summarizeExtraction(data));

      setAttractions(data.attractions ?? []);
      setRemovedIds([]);
      onFoundPlacesChange(data.attractions ?? []);
      setUnresolvedNames(data.unresolvedNames ?? []);
      setHasResult(true);
      setClarificationCategories(
        data.needsClarification ? (data.clarificationCategories ?? []) : [],
      );

      const duration =
        typeof data.durationMinutes === "number" ? data.durationMinutes : null;
      const endDistance =
        typeof data.maxEndDistanceKm === "number"
          ? data.maxEndDistanceKm
          : null;
      setKnown({
        categoryNeeds: categoryNeeds ?? [],
        durationMinutes: duration,
        maxEndDistanceKm: endDistance,
      });

      // Only after the chip turn. A first prompt that said nothing about time
      // is not an invitation to interrogate the walker — the whole conversation
      // exists because the app asked a question, and it asks two at most.
      if (categoryNeeds) {
        const missing: MissingField[] = [];
        if (duration === null) missing.push("duration");
        if (endDistance === null) missing.push("endDistance");
        setFollowUpMissing(missing.length > 0 ? missing : null);
      }

      // "A walk in Zichron Yaakov" is the other reading of a named stop —
      // start me here, surprise me with the rest — so the leftover time really
      // is an invitation to discover more, and the fill toggle starts on. It
      // stays a toggle: this proposes an answer, it does not lock one in.
      if (data.areaOnlyPrompt) {
        onFillRemainingTimeChange?.(true);
      }

      if (typeof data.durationMinutes === "number") {
        onDurationDetected?.(data.durationMinutes);
      }

      onStopCountDetected?.(
        typeof data.stopCount === "number" ? data.stopCount : null,
      );
      onNotableOnlyDetected?.(data.notableOnly === true);

      if (typeof data.maxEndDistanceKm === "number") {
        onMaxEndDistanceDetected?.(data.maxEndDistanceKm);
      }

      if (typeof data.searchRadiusKm === "number") {
        onSearchRadiusDetected?.(data.searchRadiusKm);
      }

      // A suspect area (the geocoder's own name for what it found doesn't look
      // like the area that was asked for) still comes back, but it does not get
      // to overwrite the origin field — whatever is there, typed or detected,
      // is better than a confident wrong city.
      if (data.contextCoordinates && data.contextLocationSuspect !== true) {
        onOriginDetected?.(data.contextCoordinates);
      }
    } catch (extractError) {
      const message =
        extractError instanceof Error
          ? extractError.message
          : "Failed to extract places.";
      setError(message);
      // A failed attempt is logged too. "I typed that and it didn't work" is
      // the thing a walker most wants to look back at, and an entry that
      // silently never appears reads as the app losing the request.
      logExchange(loggedPrompt, message);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedAttractions = attractions.filter(
    (attraction) => !removedIds.includes(attraction.id),
  );

  /**
   * Turn two: the walker's plain-text answer to how long and how far.
   *
   * It goes to the same endpoint with the same schema — the numbers in "3
   * hours, up to 1km" are read by the parsers a first prompt already uses — but
   * it is flagged as a follow-up so nothing gets re-geocoded, and it carries
   * what the earlier turns established so a half-answer cannot erase the half
   * already given. The found stops stay exactly as they are; this sentence
   * names no places, and reading it as if it did would empty the list.
   */
  const submitFollowUp = async () => {
    const trimmed = followUpText.trim();
    if (!trimmed) {
      setError("Tell us how long you have.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/extract-places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmed,
          nearLocation: nearLocation ?? undefined,
          followUp: true,
          categoryNeeds: known.categoryNeeds,
          knownDurationMinutes: known.durationMinutes,
          knownMaxEndDistanceKm: known.maxEndDistanceKm,
        }),
      });
      const data = (await res.json()) as ExtractPlacesResponse;

      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Failed to read that.");
      }

      const merged: KnownSoFar = {
        categoryNeeds: data.categoryNeeds ?? known.categoryNeeds,
        durationMinutes:
          typeof data.durationMinutes === "number"
            ? data.durationMinutes
            : known.durationMinutes,
        maxEndDistanceKm:
          typeof data.maxEndDistanceKm === "number"
            ? data.maxEndDistanceKm
            : known.maxEndDistanceKm,
      };
      setKnown(merged);
      setFollowUpMissing(null);
      setFollowUpText("");

      logExchange(
        trimmed,
        selectedAttractions.length > 0
          ? `Built a walk through ${selectedAttractions.length} stop${
              selectedAttractions.length === 1 ? "" : "s"
            }`
          : "Noted that, but there are no stops yet",
      );

      if (merged.durationMinutes !== null) {
        onDurationDetected?.(merged.durationMinutes);
      }
      if (merged.maxEndDistanceKm !== null) {
        onMaxEndDistanceDetected?.(merged.maxEndDistanceKm);
      }

      // The conversation was the app's idea, and this was the last question in
      // it — hand the stops over rather than making the walker confirm a list
      // they never typed.
      if (selectedAttractions.length > 0) {
        onAcceptAttractions(selectedAttractions);
      }
    } catch (followUpError) {
      const message =
        followUpError instanceof Error
          ? followUpError.message
          : "Failed to read that.";
      setError(message);
      logExchange(trimmed, message);
    } finally {
      setIsLoading(false);
    }
  };

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

      {/* What has been asked in this session, above the box it was asked in.
          Collapsed by default: it is context for when you want it, not a
          transcript the walker has to scroll past to reach the prompt. */}
      {scrollback.length > 0 && (
        <div className="rounded-md border border-charcoal/10 bg-cream/50">
          <button
            type="button"
            aria-expanded={isScrollbackOpen}
            onClick={() => setIsScrollbackOpen((open) => !open)}
            className="flex w-full cursor-pointer items-center justify-between px-2 py-1.5 text-xs text-charcoal/70 hover:text-forest"
          >
            <span>Recent requests ({scrollback.length})</span>
            <span aria-hidden="true">{isScrollbackOpen ? "▲" : "▼"}</span>
          </button>
          {isScrollbackOpen && (
            <ul
              aria-label="Recent requests"
              className="max-h-32 space-y-1 overflow-y-auto px-2 pb-2"
            >
              {scrollback.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-md bg-white/70 px-2 py-1 text-xs"
                >
                  <p className="text-charcoal/80">
                    {truncatePrompt(entry.prompt)}
                  </p>
                  <p className="text-charcoal/50">{entry.responseSummary}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

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
          have guessed is still there underneath — answering just re-runs the
          same prompt with an answer, it does not block anything.

          The chips toggle rather than firing on tap: "nature and food" is a
          normal answer, and a chip that resolves the walk the moment it is
          touched makes the second one unreachable. */}
      {clarificationCategories.length > 0 && (
        <div className="space-y-2 rounded-md bg-cream/70 p-2">
          <p className="text-xs text-charcoal/80">
            What kind of walk are you after? Pick up to {MAX_CATEGORY_NEEDS}.
          </p>
          <div className="flex flex-wrap gap-2">
            {clarificationCategories.map((category) => {
              const isSelected = selectedCategories.includes(category);
              // The cap is the extractor's own: offering a fourth selection
              // that `parseCategoryNeeds` would then drop is a lie.
              const isFull = selectedCategories.length >= MAX_CATEGORY_NEEDS;
              return (
                <button
                  key={category}
                  type="button"
                  aria-pressed={isSelected}
                  disabled={isLoading || (isFull && !isSelected)}
                  onClick={() =>
                    setSelectedCategories((current) =>
                      current.includes(category)
                        ? current.filter((item) => item !== category)
                        : current.length >= MAX_CATEGORY_NEEDS
                          ? current
                          : [...current, category],
                    )
                  }
                  className={`cursor-pointer rounded-full px-3 py-1 text-xs transition disabled:cursor-default disabled:opacity-50 ${
                    isSelected
                      ? "bg-terra text-white shadow-sm"
                      : "border border-terra/40 bg-white text-forest hover:bg-terra/10"
                  }`}
                >
                  {CATEGORY_LABELS[category]}
                </button>
              );
            })}
          </div>
          <Button
            fullWidth
            disabled={isLoading || selectedCategories.length === 0}
            onClick={() => void extract(selectedCategories)}
          >
            Continue
          </Button>
        </div>
      )}

      {/* Turn two, and the last one. Plain text rather than chips: a time
          budget and a finish distance are numbers the walker states, not a
          menu, and "3 hours, up to 1km" answers both in one line. */}
      {followUpMissing && (
        <div className="space-y-2 rounded-md bg-cream/70 p-2">
          <p className="text-xs text-charcoal/80">
            {followUpQuestion(followUpMissing)}
          </p>
          <input
            type="text"
            value={followUpText}
            aria-label={followUpQuestion(followUpMissing)}
            onChange={(event) => setFollowUpText(event.target.value)}
            placeholder="3 hours, up to 1km"
            className="w-full rounded-md border border-charcoal/15 px-3 py-2 text-base sm:text-sm focus:border-terra focus:outline-none"
          />
          <Button
            fullWidth
            disabled={isLoading || followUpText.trim().length === 0}
            onClick={() => void submitFollowUp()}
          >
            Build my walk
          </Button>
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
