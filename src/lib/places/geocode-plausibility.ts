/**
 * A cheap "does this geocode result even look like what we asked for?" check.
 *
 * PARTIAL MITIGATION, not the real thing. The risk being covered is a
 * wrong-but-confident match: a name Gemini inferred goes to Nominatim,
 * Nominatim confidently returns *a* place, and that coordinate silently
 * becomes the walk's origin. The proper check is an independent second
 * geocoder agreeing within some radius — that needs a second (paid) API and is
 * deliberately out of scope. All this does is compare the name we asked for
 * against the `display_name` the one geocoder we already call handed back, and
 * say whether they share any real word. It catches the loud failures ("Zichron
 * Yaakov" → "France") and nothing subtler.
 */

/**
 * Words that carry no identity: present in half of all addresses, so an
 * overlap on one of them is not evidence of anything.
 */
const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "near",
  "street",
  "road",
  "avenue",
  "square",
  "city",
  "town",
  "village",
  "רחוב",
  "שדרות",
  "כיכר",
  "העיר",
]);

/** Below this a token is too generic to mean anything on its own. */
const MIN_TOKEN_LENGTH = 3;

/** Shortest token pair worth comparing by containment rather than equality. */
const MIN_CONTAINMENT_LENGTH = 4;

function significantTokens(value: string): string[] {
  return value
    .normalize("NFD")
    // Strips Latin accents and Hebrew niqqud in one pass: both are combining
    // marks, so "Zürich" and "זִכְרוֹן" reduce to their bare letters.
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(
      (token) => token.length >= MIN_TOKEN_LENGTH && !STOPWORDS.has(token),
    );
}

function tokensOverlap(a: string, b: string): boolean {
  if (a === b) {
    return true;
  }
  // "yaakov" vs "yaakovs", "tel" vs "telaviv" — one spelling of a name being a
  // prefix/substring of another is common enough across transliterations to
  // count, but only once both are long enough that the match isn't accidental.
  if (a.length >= MIN_CONTAINMENT_LENGTH && b.includes(a)) {
    return true;
  }
  if (b.length >= MIN_CONTAINMENT_LENGTH && a.includes(b)) {
    return true;
  }
  return false;
}

/**
 * True when `displayName` plausibly describes `query`, or when there is not
 * enough to judge on. Deliberately biased towards true: a false alarm on every
 * short or unusual name would be worse than the silence it replaces.
 */
export function isPlausibleGeocodeMatch(
  query: string,
  displayName: string | null | undefined,
): boolean {
  if (!displayName) {
    // Nothing came back to compare against — not a mismatch, just nothing said.
    return true;
  }

  const queryTokens = significantTokens(query);
  const resultTokens = significantTokens(displayName);
  if (queryTokens.length === 0 || resultTokens.length === 0) {
    // A name made entirely of very short or generic words ("Ur", "the city")
    // gives this check nothing to work with. Unjudgeable, not suspect.
    return true;
  }

  return queryTokens.some((queryToken) =>
    resultTokens.some((resultToken) => tokensOverlap(queryToken, resultToken)),
  );
}
