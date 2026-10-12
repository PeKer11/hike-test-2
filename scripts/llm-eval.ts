/**
 * Manual LLM eval (NEXT_PHASE_PLAN B3). Never run in CI; needs real keys.
 *
 *   npx --yes tsx --conditions react-server scripts/llm-eval.ts --mock
 *   GEMINI_API_KEY=... ANTHROPIC_API_KEY=... OPENAI_API_KEY=... \
 *     npx --yes tsx --conditions react-server scripts/llm-eval.ts \
 *     gemini:gemini-3.1-flash-lite anthropic:claude-haiku-5-5 openai:gpt-5-nano \
 *     openai-compatible:<open-weight-model>      # needs LLM_BASE_URL + LLM_API_KEY
 *
 * `--baseline <pct>` is production's field-exact % (run the current model first
 * and pass its number) and turns on the PASS/fail column. `--mock` swaps every
 * provider for an oracle that answers each case from its own expectations, to
 * exercise the pipeline without keys. `--conditions react-server` makes the
 * `server-only` import a no-op outside Next.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { formatReport, runEval, type EvalCase } from "../src/lib/llm/eval-runner";
import { mockOracleProvider } from "../src/lib/llm/eval-mock";
import type { LlmProviderName } from "../src/lib/llm/types";

const PROVIDERS = ["gemini", "anthropic", "openai", "openai-compatible"];

async function main() {
  const args = process.argv.slice(2);
  const mock = args.includes("--mock");
  const baselineIdx = args.indexOf("--baseline");
  const baseline = baselineIdx >= 0 ? Number(args[baselineIdx + 1]) : undefined;
  const specs = args.filter(
    (a, i) => !a.startsWith("--") && !(baselineIdx >= 0 && i === baselineIdx + 1),
  );

  const lines = readFileSync(resolve(process.cwd(), "tests/llm-eval/cases.jsonl"), "utf8")
    .split("\n")
    .filter(Boolean);
  const cases = lines.map((l) => JSON.parse(l) as EvalCase);

  const choices = (specs.length ? specs : ["gemini:gemini-3.1-flash-lite"]).map((spec) => {
    const [provider, ...rest] = spec.split(":");
    if (!PROVIDERS.includes(provider) || rest.length === 0) {
      throw new Error(`Bad model spec "${spec}", expected provider:model`);
    }
    return { provider: provider as LlmProviderName, model: rest.join(":") };
  });

  const reports = [];
  for (const choice of choices) {
    console.error(`Running ${cases.length} cases on ${choice.provider}/${choice.model}...`);
    const deps = mock
      ? { providers: { [choice.provider]: mockOracleProvider(cases) } }
      : {};
    reports.push(await runEval(cases, choice, deps));
  }
  console.log(formatReport(reports, baseline));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
