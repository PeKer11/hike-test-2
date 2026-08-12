import { toCandidate } from "@/lib/places/place-extractor";
import { stripCombiningMarks } from "@/lib/utils/text";

/**
 * Standing facts — the things about a walker that outlive any one walk, as
 * opposed to the category preferences next door in `preference-extractor.ts`.
 *
 * Pure by design and for the same reason that module is: `gemini-client.ts` is
 * `server-only`, so a prompt or a parser that lives there cannot be read by a
 * test. Everything here is a function of its arguments, including the clock.
 */

/** A model can name any number of facts in one sentence; cap what we believe. */
const MAX_FACTS_PER_CALL = 3;

/** Matches the `char_length(fact_text) between 3 and 120` check on the table. */
export const MIN_FACT_TEXT_LENGTH = 3;
export const MAX_FACT_TEXT_LENGTH = 120;

/** The most facts one walker may accumulate. Past this the weakest is evicted. */
export const MAX_STANDING_FACTS = 20;

/**
 * How much a fact's own stated weight counts, versus how often it has been
 * repeated, versus how recently it was heard.
 *
 * Deliberately on the same scale the ranker already uses
 * (`PREFERRED_CATEGORY_BOOST = 4`, `MAX_DOWNVOTE_PENALTY = 8`) so the two
 * systems stay readable against each other. Total range is roughly 3–15.
 */
export const IMPORTANCE_WEIGHT = 2;
export const OCCURRENCE_CAP = 5;
export const RECENCY_MAX = 4;
export const HALF_LIFE_DAYS = 60;
export const MIN_FACT_SCORE = 5;
export const MAX_FACTS_IN_PROMPT = 5;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * 3 = a hard constraint the walk must respect, 2 = a persistent habit that
 * changes what fits, 1 = a soft leaning.
 */
export type FactImportance = 1 | 2 | 3;

/** One fact as the model returned it, before it has been stored. */
export interface ExtractedFact {
  text: string;
  importance: FactImportance;
  /**
   * The stored fact this one contradicts, in the model's own words, or null.
   * Set when the walker has changed their mind — "I've started eating meat
   * again" against a stored "does not eat meat".
   */
  replaces: string | null;
}

/** One fact as it comes back out of the database. */
export interface StoredFact {
  id: string;
  text: string;
  key: string;
  importance: FactImportance;
  occurrenceCount: number;
  /** Epoch millis. */
  lastSeenAt: number;
}

/**
 * System instruction for the fact pass. Inherits the preference prompt's
 * discipline verbatim — the walker is describing a walk, not filling in a
 * profile, and a guessed fact is worse than none because it silently colours
 * every future walk.
 *
 * The one real overlap with the preference pass is category liking, which is
 * why it gets an explicit rule and its own example: a fact that says "loves
 * museums" would be written twice, once as a fact and once as a preference,
 * and the two would then drift apart.
 */
export const FACT_EXTRACTION_SYSTEM_PROMPT = [
  "You read a walker's free text and extract only STANDING FACTS about them — things that stay true beyond this one walk.",
  "Return `facts`: a list of { text, importance, replaces }, at most 3.",
  "Return an empty list when the text contains no standing fact. That is the normal, expected answer — most texts have none.",
  "A fact must be standing and general: 'always walks with a dog', 'does not eat meat', 'cannot manage stairs'.",
  "Never something about this one walk: 'today I only have an hour', 'let's start at the station', 'I'm tired' are not facts.",
  "Never a place name, a duration, a distance, or a mood.",
  "Never a liking or disliking of a KIND of place — 'I love museums', 'no shopping streets' belong to the preference pass and must not be repeated here.",
  "Rewrite each fact in short third person, at most 80 characters, so the same fact phrased two ways comes out identical.",
  "importance: 3 = a hard constraint the walk must respect (dietary rule, allergy, mobility limit); 2 = a persistent habit that changes what fits (walks with a dog, always with small children); 1 = a soft leaning. Default to 1 when unsure.",
  "You may be given a list of facts already known about this walker.",
  "`replaces`: when the text contradicts one of those known facts, set `replaces` to that known fact's exact text. Otherwise set it to null.",
  "A contradiction is the walker saying the opposite of what is stored, not merely a related fact. 'walks with a dog' and 'walks with children' are both true at once.",
  "Examples:",
  '"אני לא אוכל בשר, ואני תמיד עם הכלב" -> [{ text: "does not eat meat", importance: 3, replaces: null }, { text: "always walks with a dog", importance: 2, replaces: null }].',
  '"I love museums but today I only have an hour" -> [] — a category liking and a fact about this one walk, neither of which belongs here.',
  '"Actually I eat meat again these days" with "does not eat meat" known -> [{ text: "eats meat", importance: 3, replaces: "does not eat meat" }].',
  '"Take me to Habima Square, about 2 hours" -> [] — a stop and a duration.',
].join("\n");

/**
 * The known facts as the block that goes in front of the walker's text on a
 * fact-extraction call, or an empty string when there are none — in which case
 * the request sent is byte-identical to one made before contradictions existed.
 */
export function buildKnownFactsBlock(facts: StoredFact[]): string {
  if (facts.length === 0) {
    return "";
  }

  return [
    "Already known about this walker:",
    ...facts.map((fact) => `- ${fact.text}`),
    "",
  ].join("\n");
}

/**
 * The walker's request with their standing facts in front of it, as the
 * `contents` of a place-extraction call.
 *
 * Goes in the user contents rather than the system instruction on purpose: the
 * system instruction is shared across every walker and is the cacheable half,
 * while this is per-user text. With no facts the return value is the prompt
 * itself, unchanged — which is what makes the injection safe to ship, since a
 * walker with nothing on record sends byte-identical requests to before.
 */
export function buildPromptWithFacts(
  prompt: string,
  facts: StoredFact[],
): string {
  if (facts.length === 0) {
    return prompt;
  }

  return [
    "Standing facts about this walker:",
    ...facts.map((fact) => `- ${fact.text}`),
    "",
    "Request:",
    prompt,
  ].join("\n");
}

/**
 * The dedupe identity of a fact: lowercased, combining marks stripped,
 * punctuation dropped, whitespace collapsed. "Does not eat meat!" and
 * "does not eat  meat" are one fact.
 *
 * Stored rather than generated in SQL because the mark strip is a Unicode
 * property match, and computing it on both sides would be two implementations
 * of the same rule waiting to disagree.
 */
export function normalizeFactKey(text: string): string {
  return stripCombiningMarks(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function toImportance(value: unknown): FactImportance | null {
  const importance = Number(value);
  return importance === 1 || importance === 2 || importance === 3
    ? importance
    : null;
}

/**
 * Read the fact list off a model reply — a JSON-mode text reply, an
 * already-parsed object, or a bare array — dropping anything malformed.
 * Returns an empty array rather than throwing, exactly like
 * `parseCategoryPreferences`: "no facts" is the common answer, and a garbled
 * reply has to degrade to it rather than to a 500.
 *
 * A fact whose text is longer than the column allows is truncated rather than
 * dropped: the model was told 80 characters and the column takes 120, so
 * anything past that is a run-on, not a different fact. One that is too short
 * ("no", "ok") carries nothing and is dropped.
 */
export function parseStandingFacts(input: unknown): ExtractedFact[] {
  const candidate = toCandidate(input);

  const list = Array.isArray(candidate)
    ? candidate
    : candidate !== null && typeof candidate === "object"
      ? (candidate as Record<string, unknown>).facts
      : null;

  if (!Array.isArray(list)) {
    return [];
  }

  const seen = new Set<string>();
  const facts: ExtractedFact[] = [];

  for (const raw of list) {
    if (raw === null || typeof raw !== "object") continue;

    const { text, importance, replaces } = raw as Record<string, unknown>;
    if (typeof text !== "string") continue;

    const trimmed = text.trim().slice(0, MAX_FACT_TEXT_LENGTH);
    if (trimmed.length < MIN_FACT_TEXT_LENGTH) continue;

    const weight = toImportance(importance);
    if (weight === null) continue;

    const key = normalizeFactKey(trimmed);
    if (!key || seen.has(key)) continue;

    seen.add(key);
    facts.push({
      text: trimmed,
      importance: weight,
      replaces:
        typeof replaces === "string" && replaces.trim() ? replaces.trim() : null,
    });

    if (facts.length >= MAX_FACTS_PER_CALL) break;
  }

  return facts;
}

/**
 * How much a stored fact deserves to be in front of the model right now.
 *
 *   score = IMPORTANCE_WEIGHT * importance      // 2..6, the flat stated term
 *         + min(occurrenceCount, OCCURRENCE_CAP) // 1..5, the accumulated term
 *         + RECENCY_MAX * 0.5 ** (days / HALF_LIFE_DAYS)  // 0..4
 *
 * The same "flat for an explicit statement, scaled for repetition" split that
 * `PREFERRED_CATEGORY_BOOST` and `occurrencePreferenceBoost` already encode.
 *
 * Recency demotes but never deletes, and the asymmetry that produces is the
 * point: a hard constraint heard a year ago still clears `MIN_FACT_SCORE` on
 * importance alone, while a soft leaning mentioned once a year ago does not.
 * A fact heard in the future — a clock skew, not a real timestamp — is treated
 * as heard now rather than given a bonus for it.
 */
export function scoreFact(fact: StoredFact, now: Date): number {
  const days = Math.max(0, (now.getTime() - fact.lastSeenAt) / MS_PER_DAY);
  const occurrences = Math.min(
    Math.max(1, fact.occurrenceCount),
    OCCURRENCE_CAP,
  );

  return (
    IMPORTANCE_WEIGHT * fact.importance +
    occurrences +
    RECENCY_MAX * 0.5 ** (days / HALF_LIFE_DAYS)
  );
}

/**
 * The handful of facts worth spending prompt tokens on: everything scoring at
 * least `MIN_FACT_SCORE`, strongest first, capped at `MAX_FACTS_IN_PROMPT`.
 *
 * Ties break on the more recently heard fact, so the selection is stable rather
 * than dependent on whatever order the rows came back in.
 */
export function selectFactsForPrompt(
  facts: StoredFact[],
  now: Date,
): StoredFact[] {
  return facts
    .map((fact) => ({ fact, score: scoreFact(fact, now) }))
    .filter(({ score }) => score >= MIN_FACT_SCORE)
    .sort((a, b) => b.score - a.score || b.fact.lastSeenAt - a.fact.lastSeenAt)
    .slice(0, MAX_FACTS_IN_PROMPT)
    .map(({ fact }) => fact);
}

/**
 * The weakest fact on record — what gets dropped when the walker hits the cap.
 * Ties break on the *less* recently heard fact, the mirror of the tiebreak
 * above. Returns null for an empty list.
 */
export function weakestFact(facts: StoredFact[], now: Date): StoredFact | null {
  let weakest: { fact: StoredFact; score: number } | null = null;

  for (const fact of facts) {
    const score = scoreFact(fact, now);
    if (
      !weakest ||
      score < weakest.score ||
      (score === weakest.score && fact.lastSeenAt < weakest.fact.lastSeenAt)
    ) {
      weakest = { fact, score };
    }
  }

  return weakest?.fact ?? null;
}

/**
 * The stored fact a newly-extracted one contradicts, or null.
 *
 * Matched on the normalized key rather than the raw string: the model is asked
 * to echo the stored fact's exact text back, and "Does not eat meat" coming
 * back for "does not eat meat" is the same claim. A `replaces` naming something
 * that is not on record is ignored rather than guessed at — the model has
 * invented a memory, and acting on it would retire a real fact.
 *
 * A fact cannot contradict itself: a repeat statement is a repeat, not a
 * reversal, and treating it as one would supersede a row with its own successor.
 */
export function findContradicted(
  fact: ExtractedFact,
  stored: StoredFact[],
): StoredFact | null {
  if (!fact.replaces) {
    return null;
  }

  const replacesKey = normalizeFactKey(fact.replaces);
  const factKey = normalizeFactKey(fact.text);
  if (!replacesKey || replacesKey === factKey) {
    return null;
  }

  return stored.find((candidate) => candidate.key === replacesKey) ?? null;
}
