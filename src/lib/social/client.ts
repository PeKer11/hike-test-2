import {
  cleanPoiKeys,
  EMPTY_AGGREGATES,
  sanitizeSimilarRows,
  sanitizeSupportRows,
  type CommunityAggregates,
} from "./aggregates";
import { socialEnabled } from "./flag";

/** Aggregates for keys the client holds. Makes NO request unless the flag is on and the walker opted in. */
export async function fetchAggregates(
  poiKeys: readonly string[],
  optedIn: boolean,
  fetchFn: typeof fetch = fetch,
): Promise<CommunityAggregates> {
  if (!socialEnabled() || !optedIn) return EMPTY_AGGREGATES;
  const keys = cleanPoiKeys(poiKeys);
  if (keys.length === 0) return EMPTY_AGGREGATES;
  try {
    const res = await fetchFn("/api/social/aggregates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ poiKeys: keys }),
    });
    if (!res.ok) return EMPTY_AGGREGATES;
    const raw = (await res.json()) as { support?: unknown; similar?: unknown };
    // Re-validated on the way in: the page never renders anything unfamiliar.
    return {
      support: sanitizeSupportRows(
        Object.entries((raw.support as Record<string, string>) ?? {}).map(([poi_key, supporters_bucket]) => ({
          poi_key,
          supporters_bucket,
        })),
        keys,
      ),
      similar: sanitizeSimilarRows(
        Object.entries((raw.similar as Record<string, string[]>) ?? {}).map(([poi_key, reason_categories]) => ({
          poi_key,
          reason_categories,
        })),
        keys,
      ),
    };
  } catch {
    return EMPTY_AGGREGATES;
  }
}

/** Tell the server the walker's choice. Call only from an explicit toggle, never to push a stored local value. No request unless the flag is on. */
export async function syncOptIn(enabled: boolean, fetchFn: typeof fetch = fetch): Promise<void> {
  if (!socialEnabled()) return;
  try {
    await fetchFn("/api/social/optin", { method: enabled ? "PUT" : "DELETE" });
  } catch {
    // Quiet: the next change or page load tries again.
  }
}

/** The server's opt-in state; null when unknown (flag off, signed out, offline, error). */
export async function fetchOptIn(fetchFn: typeof fetch = fetch): Promise<boolean | null> {
  if (!socialEnabled()) return null;
  try {
    const res = await fetchFn("/api/social/optin", { method: "GET" });
    if (!res.ok) return null;
    const raw = (await res.json()) as { optedIn?: unknown };
    return typeof raw.optedIn === "boolean" ? raw.optedIn : null;
  } catch {
    return null;
  }
}
