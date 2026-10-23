/**
 * The social layer's master switch. Default OFF: every social code path
 * (setting toggle, consent line, API routes, fetches, badges) checks this first.
 * The literal `process.env.NEXT_PUBLIC_SOCIAL` is required so Next inlines it.
 */
export function socialEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SOCIAL === "1";
}

// S3 (friends nearby) is deliberately NOT built. It stays blocked until the legal
// gate + DPIA + 18+ age gate, per docs/PERSONALIZATION_SOCIAL_PLAN.md §4.5.
// There is no code, table or flag for it on purpose.

/** "Notable places" on the map button (Wikidata, CC0). Default OFF; needs no sign-in or personal data. */
export function notableEnabled(): boolean {
  return process.env.NEXT_PUBLIC_MAP_NOTABLE === "1";
}
