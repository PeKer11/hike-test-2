import { searchNearbyPlaces, searchTextPlaces } from "@/lib/api/google-places-client";
import type { ProviderChoice } from "@/lib/llm/config";
import { estimateCostMicros } from "@/lib/llm/pricing";
import { callOpenAiTools, type ChatMessage, type ToolDef } from "@/lib/llm/providers/openai-tools";
import type { AttractionCategory, Coordinates } from "@/lib/types";
import { haversineDistance } from "@/lib/utils/geo";

const MAX_MODEL_CALLS = 5;
const MAX_OUTPUT_TOKENS = 500;
const TURN_TIMEOUT_MS = 30_000;
const CATEGORIES: AttractionCategory[] = ["food", "nature", "park", "museum", "landmark", "viewpoint", "religious", "shopping", "entertainment", "other"];

export const WALK_SYSTEM = `You are Traike's companion for a walker who is walking right now. Talk to them like a friendly local who knows the area: answer anything, in their language, in one or two short sentences. Be natural and free: opinions, suggestions and chat are all fine.
- To mention a real place you must look it up with find_places first (it uses their current position). Only name places the tool returned.
- You can offer a tap button for what you suggest: propose_add_stop (a place you found), propose_skip_stop (one of their remaining stops, by number) or propose_head_back. The walker must tap; never say it is already done.
- If they ask for several changes (add two places, remove one, swap one), call a propose_ tool for EVERY one of them in the same turn; the app combines them into one button. If they ask to remove a stop, always call propose_skip_stop for it, even if they asked before.
- If they ask you to add or pick a stop, choose the best fit yourself (find_places, then propose_add_stop for ONE place) and say in a few words why it suits them.
- Use what you know about the walker (below) to choose; never ask again for what you already know. When they tell you something lasting about themselves (diet, mobility, kids or a dog, strong likes or dislikes), call remember once. Never remember one-off requests.
- You do not know opening hours, prices or crowds; say so rather than guess.`;

const TOOLS: ToolDef[] = [
  {
    type: "function",
    function: {
      name: "remember",
      description: "Save ONE lasting fact about the walker for all future chats (diet, mobility, who they walk with, strong like/dislike). Short phrase in their language. Never a one-off request or a place.",
      parameters: { type: "object", properties: { fact: { type: "string" } }, required: ["fact"], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "find_places",
      description: "Find real places near the walker's current position. Give a free-text `query` (e.g. 'bench in a park', 'ice cream') or a `category`.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          category: { type: "string", enum: CATEGORIES },
          radius_m: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_add_stop",
      description: "Show a tap button that adds a place (by id from find_places) as a stop.",
      parameters: { type: "object", properties: { place_id: { type: "string" } }, required: ["place_id"], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_skip_stop",
      description: "Show a tap button that skips one remaining stop, by its number in the list.",
      parameters: { type: "object", properties: { stop_number: { type: "number" } }, required: ["stop_number"], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_head_back",
      description: "Show a tap button that takes the walker back to the start.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
];

export type WalkAction =
  | { kind: "add-place"; name: string; coordinates: Coordinates }
  | { kind: "skip-stop"; stopIndex: number }
  | { kind: "head-back" };

export interface WalkTurnInput {
  history: Array<{ role: "user" | "assistant"; content: string }>;
  position: Coordinates;
  stops: string[];
  /** What is already remembered about the walker (see route.ts). */
  memoryNote?: string;
  choice: ProviderChoice;
  effort?: string;
}

export async function runWalkTurn(
  input: WalkTurnInput,
  call: typeof callOpenAiTools = callOpenAiTools,
): Promise<{ reply: string; actions: WalkAction[]; remembered: string[]; billedMicros: number }> {
  const found = new Map<string, { name: string; coordinates: Coordinates }>();
  const actions: WalkAction[] = [];
  const remembered: string[] = [];
  let billedMicros = 0;
  const ctx = `\nWalker position known. Remaining stops: ${input.stops.length ? input.stops.map((s, i) => `${i + 1}. ${s}`).join("; ") : "none"}.` + (input.memoryNote ?? "");
  const messages: ChatMessage[] = [
    { role: "system", content: WALK_SYSTEM + ctx },
    ...input.history.map((m) => ({ role: m.role, content: m.content }) as ChatMessage),
  ];
  const signal = AbortSignal.timeout(TURN_TIMEOUT_MS);

  for (let i = 0; i < MAX_MODEL_CALLS; i += 1) {
    const response = await call({
      model: input.choice.model,
      messages,
      tools: TOOLS,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      signal,
      reasoningEffort: input.effort,
    });
    billedMicros += estimateCostMicros(input.choice.model, response.inTok, response.outTok);
    if (response.toolCalls.length === 0) return { reply: (response.content ?? "").trim(), actions, remembered, billedMicros };

    messages.push({ role: "assistant", content: response.content, tool_calls: response.toolCalls });
    for (const tc of response.toolCalls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments || "{}") as Record<string, unknown>;
      } catch {
        // fall through with empty args
      }
      let output: unknown = { error: "unknown tool" };
      try {
        const name = tc.function.name;
        if (name === "find_places") {
          const radius = typeof args.radius_m === "number" ? Math.min(3000, Math.max(100, args.radius_m)) : 1000;
          const category = CATEGORIES.find((c) => c === args.category);
          const query = typeof args.query === "string" ? args.query.trim().slice(0, 100) : "";
          const places = query
            ? await searchTextPlaces(query, input.position, 6)
            : category
              ? await searchNearbyPlaces(category, input.position, radius, 6)
              : [];
          output = places
            .map((p) => ({ p, d: Math.round(haversineDistance(input.position, p.coordinates)) }))
            .sort((a, b) => a.d - b.d)
            .slice(0, 5)
            .map(({ p, d }, n) => {
              const id = `p${found.size + n + 1}`;
              found.set(id, { name: p.name, coordinates: p.coordinates });
              return { id, name: p.name, dist_m: d };
            });
          if ((output as unknown[]).length === 0) output = { error: "nothing found" };
        } else if (name === "remember") {
          const fact = typeof args.fact === "string" ? args.fact.trim().slice(0, 120) : "";
          if (fact.length < 3) output = { error: "fact too short" };
          else {
            remembered.push(fact);
            output = { ok: true, saved: fact };
          }
        } else if (name === "propose_add_stop") {
          const p = found.get(String(args.place_id));
          if (p) {
            actions.push({ kind: "add-place", ...p });
            output = { ok: true };
          } else output = { error: "unknown place_id" };
        } else if (name === "propose_skip_stop") {
          const idx = Number(args.stop_number) - 1;
          if (Number.isInteger(idx) && idx >= 0 && idx < input.stops.length) {
            actions.push({ kind: "skip-stop", stopIndex: idx });
            output = { ok: true };
          } else output = { error: "no such stop" };
        } else if (name === "propose_head_back") {
          actions.push({ kind: "head-back" });
          output = { ok: true };
        }
      } catch {
        output = { error: "lookup failed" };
      }
      messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(output) });
    }
  }
  return { reply: "", actions, remembered, billedMicros };
}
