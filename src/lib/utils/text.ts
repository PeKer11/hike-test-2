/**
 * Strip combining marks — Latin accents and Hebrew niqqud in one pass, since
 * both are Unicode combining marks. "Zürich" reduces to "Zurich" and "זִכְרוֹן"
 * to its bare letters.
 *
 * Shared rather than written twice: the geocode plausibility check and the
 * standing-fact dedupe key both need the same normalization, and two copies of
 * it would eventually disagree about what counts as the same word.
 */
export function stripCombiningMarks(value: string): string {
  return value.normalize("NFD").replace(/\p{M}+/gu, "");
}
