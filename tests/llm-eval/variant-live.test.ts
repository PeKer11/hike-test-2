import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/google-places-client", () => ({ searchTextPlaces: vi.fn(async () => []), searchNearbyPlaces: vi.fn(async () => []) }));

import { EMPTY_STATE } from "@/lib/assistant/state";
import { runAssistantTurn } from "@/lib/assistant/turn";
import type { MakeVariantFn } from "@/lib/assistant/tools";
import { toolCallFor } from "@/lib/llm/providers/anthropic-tools";
import type { SavedWalk } from "@/lib/walks/saved-walks";

// Opt-in, paid model check of the "same walk but ..." flow. No database and no router: the saved walk is a
// fixture and make_variant is a recorder, so nothing is read from or written to production.
// The shared test setup removes provider keys; reload them only for this explicit opt-in.
if (process.env.RUN_LIVE_VARIANT_EVAL) process.loadEnvFile(".env.local");
const provider = process.env.ANTHROPIC_API_KEY ? "anthropic" : "openai";
const live = Boolean(process.env.RUN_LIVE_VARIANT_EVAL && (process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY));
const callTools = toolCallFor(provider);

const ID = "11111111-1111-1111-1111-111111111111";
const walk: SavedWalk = {
  id: ID, title: "שוק הכרמל", status: "completed", areaLabel: "תל אביב", start: { lat: 32.068, lng: 34.768 }, totalMin: 90, distanceM: 4000,
  stops: [{ name: "שוק הכרמל", category: "food", lat: 32.068, lng: 34.768 }, { name: "נחלת בנימין", category: "other", lat: 32.066, lng: 34.77 }],
  params: {}, visibility: "private", createdAt: "2026-11-09T10:00:00Z", completedAt: null,
};

describe.skipIf(!live)("live make_variant behavior", () => {
  it.each([
    { prompt: "אותו מסלול מאתמול אבל הפוך", kind: "reverse" },
    { prompt: "כמו בשבוע שעבר אבל קצר יותר, 45 דקות", kind: "shorter" },
    { prompt: "אותו מסלול רק תוסיף בית קפה", kind: "add_stop" },
  ])("$prompt -> recall_walks, then make_variant $kind, never a rebuild from scratch", { timeout: 120_000 }, async ({ prompt, kind }) => {
    const order: string[] = [];
    const variants: Array<{ id: string; request: unknown }> = [];
    const makeVariantFn: MakeVariantFn = async (id, request) => {
      variants.push({ id, request });
      return { ok: true, saved_walk_id: "new", title: "שוק הכרמל · גרסה", totalMin: 80, km: 3.6, note: "saved as a new walk; the original is unchanged" };
    };
    const recording: typeof callTools = async (req) => {
      const result = await callTools(req);
      for (const t of result.toolCalls) order.push(t.function.name);
      return result;
    };
    await runAssistantTurn(
      {
        summary: null,
        history: [{ role: "user", content: prompt }],
        state: { ...EMPTY_STATE, origin: walk.start, params: {}, limitsSettled: true },
        choice: { provider, model: provider === "anthropic" ? "claude-sonnet-5-5" : "gpt-6.1-sol" },
        loadWalks: async () => [walk],
        makeVariantFn,
      },
      { call: recording },
    );
    expect(order.indexOf("recall_walks")).toBeGreaterThanOrEqual(0);
    expect(order.indexOf("recall_walks")).toBeLessThan(order.indexOf("make_variant"));
    if (kind === "add_stop") {
      expect(order).toContain("make_variant"); // the AI kinds come back for the normal estimate/build loop
    } else {
      expect(order).not.toContain("build_walk");
      expect(variants[0]?.id).toBe(ID);
      expect(variants[0]?.request).toMatchObject({ kind });
    }
  });
});
