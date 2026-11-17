import { tasteEnabled } from "./flag";

export interface TasteView {
  bullets: string[];
  tags: string[];
  areas: string[];
  createdAt: string;
  basedOnWalks: number;
  /** When a new summary may be made (null = now). */
  nextAvailableAt: string | null;
}

export type TasteStatus = "ok" | "cooldown" | "consent" | "not_enough_walks" | "resting" | "unavailable";

const strs = (v: unknown, n: number): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, n) : []);

function readView(body: Record<string, unknown>): TasteView | null {
  const s = body.summary as Record<string, unknown> | null | undefined;
  if (!s || typeof s !== "object") return null;
  return {
    bullets: strs(s.bullets, 3),
    tags: strs(s.tags, 6),
    areas: strs(s.areas, 3),
    createdAt: typeof body.createdAt === "string" ? body.createdAt : "",
    basedOnWalks: typeof body.basedOnWalks === "number" ? body.basedOnWalks : 0,
    nextAvailableAt: typeof body.nextAvailableAt === "string" ? body.nextAvailableAt : null,
  };
}

/** The cached summary. `available:false` = flag off or migration E missing: hide the card. */
export async function fetchTaste(fetchFn: typeof fetch = fetch): Promise<{ available: boolean; taste: TasteView | null }> {
  if (!tasteEnabled()) return { available: false, taste: null };
  try {
    const res = await fetchFn("/api/social/taste", { cache: "no-store" });
    if (!res.ok) return { available: false, taste: null };
    const body = (await res.json()) as Record<string, unknown>;
    return { available: body.available === true, taste: readView(body) };
  } catch {
    return { available: false, taste: null };
  }
}

/** Ask for a new summary (the server enforces consent, the 7-day window and the budget). */
export async function generateTaste(lang: "he" | "en", fetchFn: typeof fetch = fetch): Promise<{ status: TasteStatus; taste: TasteView | null }> {
  if (!tasteEnabled()) return { status: "unavailable", taste: null };
  try {
    const res = await fetchFn("/api/social/taste", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lang }) });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.status === 403) return { status: "consent", taste: null };
    if (res.status === 409) return { status: "not_enough_walks", taste: null };
    if (res.status === 429) return { status: "resting", taste: null };
    if (!res.ok || body.available === false) return { status: "unavailable", taste: null };
    return { status: body.cooldown === true ? "cooldown" : "ok", taste: readView(body) };
  } catch {
    return { status: "unavailable", taste: null };
  }
}

export async function deleteTaste(fetchFn: typeof fetch = fetch): Promise<boolean> {
  if (!tasteEnabled()) return false;
  try {
    return (await fetchFn("/api/social/taste", { method: "DELETE" })).ok;
  } catch {
    return false;
  }
}
