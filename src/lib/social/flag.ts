/**
 * The social layer's master switch. Default OFF: every social code path
 * (setting toggle, consent line, API routes, fetches, badges) checks this first.
 * The literal `process.env.NEXT_PUBLIC_SOCIAL` is required so Next inlines it.
 */
export function socialEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SOCIAL === "1";
}

// Round 2 (docs/PLAN-round2-2026-11.md §3) adds social profiles, walking-now and walk-together as separate flags.
// Each is OFF by default and is never the only guard: the code also hides the feature when its migration is missing.
// Strangers nearby (P8) needs counsel + a DPIA + the owner's explicit OK before its migration is pasted and the flag set.

/** Social profiles, blocking and reporting (migration A). Default OFF. */
export function socialProfilesEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SOCIAL_PROFILES === "1";
}

/** Coarse "walking now" for friends and walk-together requests (migrations B and C). Default OFF; needs profiles. */
export function presenceEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SOCIAL_PRESENCE === "1";
}

/**
 * Strangers nearby (P8, migration D). Default OFF, and OFF in production until counsel and the owner say so.
 * Server routes check `process.env.SOCIAL_NEARBY` too: the client flag alone can never switch this on.
 */
export function nearbyEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SOCIAL_NEARBY === "1";
}

/** Server-side half of the nearby flag (read by API routes only). */
export function nearbyServerEnabled(): boolean {
  return process.env.SOCIAL_NEARBY === "1" && process.env.NEXT_PUBLIC_SOCIAL_NEARBY === "1";
}

/** Opt-in AI taste summary (P9, migration E). Default OFF. */
export function tasteEnabled(): boolean {
  return process.env.NEXT_PUBLIC_TASTE_SUMMARY === "1";
}

/** "Notable places" on the map button (Wikidata, CC0). Default OFF; needs no sign-in or personal data. */
export function notableEnabled(): boolean {
  return process.env.NEXT_PUBLIC_MAP_NOTABLE === "1";
}
