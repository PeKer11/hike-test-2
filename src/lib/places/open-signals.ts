/**
 * Open popularity signal for a place (docs/SOCIAL_PLAN_V2.md §2.2): Wikipedia pageviews, which are CC0.
 * Pure helpers plus one fetch; not yet wired into the ranker.
 */

/** Pageviews over the last 12 months of an OSM `wikipedia=lang:Title` tag, or null when unavailable. */
export async function wikipediaPageviews12m(tag: string, now = new Date(), fetchImpl: typeof fetch = fetch): Promise<number | null> {
  const m = /^([a-z-]{2,8}):(.+)$/.exec(tag.trim());
  if (!m) return null;
  const [, lang, title] = m;
  const pad = (n: number) => String(n).padStart(2, "0");
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const start = new Date(Date.UTC(end.getUTCFullYear() - 1, end.getUTCMonth(), 1));
  const fmt = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}01`;
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${lang}.wikipedia/all-access/user/${encodeURIComponent(title.replace(/ /g, "_"))}/monthly/${fmt(start)}/${fmt(end)}`;
  try {
    const res = await fetchImpl(url, { headers: { "User-Agent": "Traike/1.0 (place popularity; contact via site)" }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { items?: Array<{ views?: number }> };
    return (data.items ?? []).reduce((a, i) => a + (typeof i.views === "number" ? i.views : 0), 0);
  } catch {
    return null;
  }
}

/** 0..1, log-scaled: about 1 000 views a year is ~0.3, 100 000 is ~0.8, 1 000 000 is 1. */
export function popularityScore(views: number | null): number {
  if (views === null || views <= 0) return 0;
  return Math.min(1, Math.log10(1 + views) / 6);
}
