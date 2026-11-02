import { describe, it, vi } from "vitest";
import { writeFileSync } from "node:fs";

vi.mock("@/lib/walk/town-boundary", () => ({
  fetchTownFootprint: vi.fn(async () => null),
  fetchTownBoundary: vi.fn(async () => null),
}));
vi.mock("@/lib/api/google-places-client", () => ({ searchTextPlaces: vi.fn(), searchNearbyPlaces: vi.fn() }));

import { searchNearbyPlaces, searchTextPlaces } from "@/lib/api/google-places-client";
import { needsDeepThinking } from "@/lib/assistant/effort";
import { EMPTY_STATE } from "@/lib/assistant/state";
import { runAssistantTurn } from "@/lib/assistant/turn";
import { callAnthropicTools } from "@/lib/llm/providers/anthropic-tools";
import { callOpenAiTools } from "@/lib/llm/providers/openai-tools";

// Opt-in, paid A/B: the same real prompts on claude-sonnet-5-5 and gpt-6.1-sol. Writes EVAL_OUT (JSON) for reading.
// The shared test setup removes provider keys; reload only for this explicit opt-in.
if (process.env.RUN_LIVE_MODEL_COMPARE) process.loadEnvFile(".env.local");
const live = Boolean(process.env.RUN_LIVE_MODEL_COMPARE && process.env.ANTHROPIC_API_KEY && process.env.OPENAI_API_KEY);

const origin = { lat: 32.0668, lng: 34.7647 };
const PLACES = [
  { placeId: "p1", name: "Carmel Market", coordinates: { lat: 32.0680, lng: 34.7685 }, primaryType: "market", types: ["market"] },
  { placeId: "p2", name: "Neve Tzedek Cafe", coordinates: { lat: 32.0612, lng: 34.7672 }, primaryType: "cafe", types: ["cafe"] },
  { placeId: "p3", name: "Jaffa Port", coordinates: { lat: 32.0515, lng: 34.7508 }, primaryType: "tourist_attraction", types: [] },
  { placeId: "p4", name: "Yarkon Park", coordinates: { lat: 32.0990, lng: 34.8100 }, primaryType: "park", types: ["park"] },
  { placeId: "p5", name: "Habima Square", coordinates: { lat: 32.0727, lng: 34.7798 }, primaryType: "tourist_attraction", types: [] },
];

const PROMPTS: Array<{ id: string; text: string }> = [
  { id: "he-simple", text: "תמצא לי בית קפה קרוב" },
  { id: "he-route", text: "אני רוצה סיבוב של שעה וחצי עם שוק, בית קפה ונקודת תצפית, ולחזור לנקודת ההתחלה" },
  { id: "he-vague", text: "בא לי לעשות משהו" },
  { id: "he-constraints", text: "מסלול עם עגלה, בלי מדרגות, עם צל, וילדים קטנים, אבל בלי לצאת משכונת נווה צדק" },
  { id: "en-route", text: "Plan a two hour loop that passes Carmel Market, Habima Square and somewhere to sit for coffee" },
  { id: "en-vague", text: "surprise me" },
  { id: "en-constraints", text: "I use a wheelchair, want to avoid dangerous roads, no more than 3 km, end near Jaffa Port, include one park" },
  { id: "he-change", text: "תחליף את הפארק במשהו עם אוכל" },
];

describe.skipIf(!live)("live model compare", () => {
  it("runs each prompt on both models", { timeout: 1_800_000 }, async () => {
    vi.mocked(searchTextPlaces).mockResolvedValue(PLACES.slice(0, 2));
    vi.mocked(searchNearbyPlaces).mockResolvedValue(PLACES);
    const out: unknown[] = [];
    for (const p of PROMPTS) {
      for (const model of ["claude-sonnet-5-5", "gpt-6.1-sol"] as const) {
        const anthropic = model.startsWith("claude");
        const tools: string[] = [];
        const call: typeof callOpenAiTools = async (req) => {
          const res = await (anthropic ? callAnthropicTools : callOpenAiTools)(req);
          for (const t of res.toolCalls) tools.push(t.function.name);
          return res;
        };
        const state = { ...EMPTY_STATE, origin, limitsSettled: true, params: {} };
        const effort = anthropic ? (needsDeepThinking(p.text, state) ? "high" : "medium") : "low";
        const t0 = Date.now();
        try {
          const r = await runAssistantTurn(
            { summary: null, history: [{ role: "user", content: p.text }], state, choice: { provider: anthropic ? "anthropic" : "openai", model }, effort },
            { call },
          );
          out.push({ prompt: p.id, model, effort, ms: Date.now() - t0, costUsd: +(r.billedMicros / 1e6).toFixed(4), tools, reply: r.reply, choices: r.choices ?? null, askLimits: Boolean(r.askLimits), built: Boolean(r.action) });
        } catch (err) {
          out.push({ prompt: p.id, model, effort, ms: Date.now() - t0, tools, error: String(err).slice(0, 300) });
        }
      }
    }
    writeFileSync(process.env.EVAL_OUT ?? "model-compare.json", JSON.stringify(out, null, 2));
  });
});
