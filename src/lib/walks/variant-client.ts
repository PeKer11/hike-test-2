import { decodePolyline } from "./polyline";
import type { SavedWalk } from "./saved-walks";
import type { VariantRequest } from "./variants";

export type VariantAnswer = { ok: true; walk: SavedWalk; ascentM: number | null } | { ok: false; error: string; needsAi: boolean };

/** Ask the server for a variant of a saved walk. It is saved as a new walk; the original is untouched. */
export async function requestVariant(walkId: string, request: VariantRequest): Promise<VariantAnswer> {
  try {
    const res = await fetch("/api/walks/variant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walkId, ...request }),
    });
    const body = (await res.json()) as { error?: string; needsAi?: boolean; ascentM?: number | null; walk?: SavedWalk & { geometryEncoded?: string } };
    if (!res.ok || !body.walk) return { ok: false, error: body.error ?? "Could not make that version.", needsAi: body.needsAi === true };
    const { geometryEncoded, ...walk } = body.walk;
    const geometry = geometryEncoded ? decodePolyline(geometryEncoded) : [];
    return { ok: true, walk: { ...walk, ...(geometry.length >= 2 ? { geometry } : {}) }, ascentM: body.ascentM ?? null };
  } catch {
    return { ok: false, error: "Could not make that version.", needsAi: false };
  }
}
