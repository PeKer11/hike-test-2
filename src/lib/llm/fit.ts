/** Per-block caps for structured untrusted JSON (see `UntrustedBlock.maxChars`). */
export const CANDIDATES_MAX_CHARS = 8_000;
export const WALK_END_MAX_CHARS = 4_000;

/**
 * Keeps the leading items of a list whose JSON stays within `maxChars`, so a long
 * list is shortened by count and never cut in the middle of a JSON value. The
 * caller passes the kept items on, so the model and the id check see the same list.
 */
export function fitListToChars<T>(items: readonly T[], maxChars: number): T[] {
  const kept: T[] = [];
  let size = 2; // "[]"
  for (const item of items) {
    const add = JSON.stringify(item).length + (kept.length > 0 ? 1 : 0);
    if (size + add > maxChars) break;
    kept.push(item);
    size += add;
  }
  return kept;
}
