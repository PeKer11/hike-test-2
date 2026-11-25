/**
 * Manual eval of "minimal by default" (docs/EXACT-ADDS-DOT-FREEZE-DEFAULT-ROUTE-PLAN-2026-11-25.md, section 4). Never run in CI.
 *
 *   env -u OPENAI_API_KEY npx --yes tsx --conditions react-server scripts/walk-minimal-eval.ts --mock
 *   OPENAI_API_KEY=... npx --yes tsx --conditions react-server scripts/walk-minimal-eval.ts openai:gpt-6.1-sol
 *
 * `--mock` swaps the model for a scripted one that is deliberately greedy (it proposes one place too many first), so
 * the run proves the guards (maxAdds, keyword path, prompt rules), not the model. A spec runs the real model through
 * `runWalkTurn` with a mocked `find_places` (5 places). Rows 18-20 are Sol turns: with `--mock` only their prompt
 * rules are checked; a live Sol turn needs the app. Pass bar: 19/20.
 */
import Module from "node:module";

import type { WalkTurnPlaces } from "../src/lib/assistant/walk-turn";
import type { callOpenAiTools } from "../src/lib/llm/providers/openai-tools";
import type { LlmProviderName } from "../src/lib/llm/types";

// `server-only` is resolved by Next, not by node: outside Next it is a no-op.
const load = (Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown })._load;
(Module as unknown as { _load: typeof load })._load = (request, ...rest) => (request === "server-only" ? {} : load(request, ...rest));
let runWalkTurn: typeof import("../src/lib/assistant/walk-turn").runWalkTurn;
let ASSISTANT_SYSTEM: string;
let toolCallFor: typeof import("../src/lib/llm/providers/anthropic-tools").toolCallFor;
let requestedAddCount: typeof import("../src/lib/walk/chat/count").requestedAddCount;
let isAffirm: typeof import("../src/lib/walk/chat/affirm").isAffirm;
let isExploreRequest: typeof import("../src/lib/walk/chat/explore").isExploreRequest;
let parseIntent: typeof import("../src/lib/walk/chat/intent").parseIntent;
let radiusFromText: typeof import("../src/lib/walk/chat/intent").radiusFromText;
async function loadModules() {
  ({ runWalkTurn } = await import("../src/lib/assistant/walk-turn"));
  ({ ASSISTANT_SYSTEM } = await import("../src/lib/assistant/prompt"));
  ({ toolCallFor } = await import("../src/lib/llm/providers/anthropic-tools"));
  ({ requestedAddCount } = await import("../src/lib/walk/chat/count"));
  ({ isAffirm } = await import("../src/lib/walk/chat/affirm"));
  ({ isExploreRequest } = await import("../src/lib/walk/chat/explore"));
  ({ parseIntent, radiusFromText } = await import("../src/lib/walk/chat/intent"));
}

const POSITION = { lat: 32.08, lng: 34.78 };
const STOPS = ["המוזיאון", "הקתדרלה הישנה", "קפה רומא"];
const PLACES = ["גלידריית הים", "קפה השוק", "גן הפסלים", "ספרייה ישנה", "מזרקת העיר"].map((name, i) => ({
  name,
  coordinates: { lat: POSITION.lat + (i + 1) * 0.0008, lng: POSITION.lng },
}));
const places: WalkTurnPlaces = { text: (async () => PLACES) as never, nearby: (async () => PLACES) as never };
const AHEAD = { elapsedMin: 20, remainingMin: 30, availableMin: 80, overBudget: false, plannedKmh: 4, measuredKmh: 5, spareMin: 25 };

type Row =
  | { n: number; text: string; kind: "card"; adds: number; skip?: number[]; orNothing?: boolean; timing?: typeof AHEAD }
  | { n: number; text: string; kind: "answer"; timing?: typeof AHEAD; names?: boolean }
  | { n: number; text: string; kind: "keyword"; check: () => boolean }
  | { n: number; text: string; kind: "sol"; rule: RegExp };

const ROWS: Row[] = [
  { n: 1, text: "תוסיף אטרקציה", kind: "card", adds: 1 },
  { n: 2, text: "תוסיף עוד אטרקציה או שתיים", kind: "card", adds: 1 },
  { n: 3, text: "תגדיל את זה תעשה עוד אטרקציה או שניים", kind: "card", adds: 1 },
  { n: 4, text: "תוסיף שתי אטרקציות", kind: "card", adds: 2 },
  { n: 5, text: "תוסיף בית קפה", kind: "card", adds: 1 },
  { n: 6, text: "תגדיל את המסלול", kind: "card", adds: 1 },
  { n: 7, text: "תוסיף גלידה עד 300 מטר מכאן", kind: "card", adds: 1, orNothing: true },
  { n: 8, text: "תוריד את העצירה השנייה", kind: "card", adds: 0, skip: [1] },
  { n: 9, text: "תחליף את המוזיאון במשהו אחר", kind: "card", adds: 1, skip: [0] },
  { n: 10, text: "דלג על הבאה", kind: "keyword", check: () => {
    const i = parseIntent("דלג על הבאה", STOPS.map((name, k) => ({ id: `s${k}`, name, pinned: false })));
    return i.intent === "skip" && (!i.stopId || i.stopId === "s0");
  } },
  { n: 11, text: "תחזיר אותי להתחלה", kind: "keyword", check: () => parseIntent("תחזיר אותי להתחלה", []).intent === "head-back" },
  { n: 12, text: "יש פה שירותים?", kind: "answer" },
  { n: 13, text: "מתי נסיים?", kind: "answer", timing: AHEAD },
  { n: 14, text: "מה זה הבניין הזה?", kind: "answer" },
  { n: 15, text: "כן", kind: "keyword", check: () => isAffirm("כן") },
  { n: 16, text: "תפתיע אותי", kind: "card", adds: 1 },
  { n: 17, text: "מה יש מעניין בסביבה?", kind: "answer", names: true },
  { n: 18, text: "Sol: מסלול של שעה מכאן", kind: "sol", rule: /no exploration stop: at most 3 stops/ },
  { n: 19, text: "Sol: מסלול לחוף", kind: "sol", rule: /route to a place has no stops in between/ },
  { n: 20, text: "Sol: מסלול עם שתי אטרקציות, קפה ואז פארק", kind: "sol", rule: /deliver exactly that many stops/ },
];

const tc = (id: string, name: string, args: object) => ({ id, type: "function" as const, function: { name, arguments: JSON.stringify(args) } });

/** A scripted model that is greedy on purpose: one place too many first, then what the error asks for. */
function greedyModel(row: Row & { kind: "card" | "answer" }): typeof callOpenAiTools {
  let step = 0;
  return (async (req: { messages: Array<{ role: string; content: string | null }> }) => {
    step += 1;
    const base = { inTok: 1, outTok: 1 };
    if (row.kind === "answer") {
      if (row.names && step === 1) return { ...base, content: null, toolCalls: [tc("f", "find_places", { query: "interesting" })] };
      return { ...base, content: row.names ? `יש ${PLACES[0].name} ו${PLACES[1].name} לא רחוק.` : "אני לא בטוח, אבל זה נראה כמו מבנה ישן.", toolCalls: [] };
    }
    if (step === 1) return { ...base, content: null, toolCalls: [tc("f", "find_places", { query: "x" })] };
    const last = String(req.messages.at(-1)?.content ?? "");
    const exact = /propose exactly (\d+)/.exec(last);
    const want = exact ? Number(exact[1]) : row.adds > 0 ? row.adds + 1 : 0;
    const add = PLACES.slice(0, Math.min(want, 5)).map((_, i) => `p${i + 1}`);
    return { ...base, content: null, toolCalls: [tc("p", "propose_plan", { add, skip: (row.skip ?? []).map((i) => i + 1) })] };
  }) as never;
}

async function runRow(row: Row, call: ((r: Row & { kind: "card" | "answer" }) => typeof callOpenAiTools) | null, choice: { provider: LlmProviderName; model: string }): Promise<string | null> {
  if (row.kind === "keyword") return row.check() ? null : "keyword path gave the wrong intent";
  if (row.kind === "sol") return ASSISTANT_SYSTEM.match(row.rule) ? null : `Sol prompt lacks ${row.rule}`;
  const text = row.text;
  const turn = await runWalkTurn(
    {
      history: [{ role: "user", content: text }],
      position: POSITION,
      stops: STOPS,
      timing: row.timing,
      choice,
      maxAdds: requestedAddCount(text) ?? undefined,
      explore: isExploreRequest(text) || undefined,
      radiusM: radiusFromText(text) ?? undefined,
    },
    call ? call(row) : toolCallFor(choice.provider),
    places,
  );
  if (turn.reply.includes("?")) return `the reply asks a question: ${turn.reply}`;
  if (row.kind === "answer") {
    if (turn.proposal) return "a card on a plain question";
    if (!turn.reply.trim()) return "no answer text";
    if (row.timing && /הוסף|תוסיף|add a stop|longer loop|עוד עצירה/.test(turn.reply)) return "offered an extra stop unprompted";
    if (row.names) {
      const named = PLACES.filter((p) => turn.reply.includes(p.name)).length;
      if (named < 1 || named > 3) return `named ${named} places`;
    }
    return null;
  }
  if (!turn.proposal) return row.orNothing && turn.noMatch ? null : "no card";
  if (turn.proposal.adds.length !== row.adds) return `card has ${turn.proposal.adds.length} adds, wanted ${row.adds}`;
  const skip = (row.skip ?? []).join(",");
  if (turn.proposal.skipStopIndexes.join(",") !== skip) return `card skips [${turn.proposal.skipStopIndexes}], wanted [${skip}]`;
  return null;
}

async function main() {
  await loadModules();
  const args = process.argv.slice(2);
  const mock = args.includes("--mock");
  const spec = args.find((a) => !a.startsWith("--"));
  if (!mock && !spec) throw new Error("pass --mock, or provider:model for a live run");
  const [provider, ...rest] = (spec ?? "openai:gpt-6.1-sol").split(":");
  const choice = { provider: provider as LlmProviderName, model: rest.join(":") };
  let pass = 0;
  for (const row of ROWS) {
    const why = await runRow(row, mock ? greedyModel : null, choice).catch((e) => `threw: ${e instanceof Error ? e.message : e}`);
    if (!why) pass += 1;
    console.log(`${String(row.n).padStart(2)} ${why ? "FAIL" : "ok  "} ${row.text}${why ? `  <- ${why}` : ""}`);
  }
  console.log(`\n${pass}/${ROWS.length} (bar 19/20)`);
  process.exit(pass >= 19 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
