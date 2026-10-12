import type { EvalCase } from "./eval-runner";
import type { ProviderCall } from "./types";

/**
 * Oracle provider for the eval's `--mock` dry run: answers each case from its
 * own expectations, so the pipeline (task build, parse, scoring, report) can be
 * exercised without keys. A model score of 100% here proves the plumbing, not
 * any model's quality.
 */
export function mockOracleProvider(cases: EvalCase[]): ProviderCall {
  return async (req) => {
    // The same sentence can appear as an extraction case and as a facts case.
    const wantFacts = req.taskName === "facts";
    const found = cases.find(
      (c) => (c.kind === "facts") === wantFacts && req.user.includes(c.prompt),
    );
    const e = found?.expect ?? {};
    let body: unknown;
    if (req.taskName === "facts") {
      const n = e.factCount ?? e.minFacts ?? 0;
      body = {
        facts: Array.from({ length: n }, (_, i) => ({
          text: `fact ${i + 1}`,
          importance: e.minImportance ?? 2,
          replaces: null,
        })),
      };
    } else {
      body = {
        places: e.places ?? [],
        contextLocation: e.contextLocation ?? null,
        durationMinutes: e.durationMinutes ?? null,
        categoryNeeds: e.categoryNeeds ?? [],
        stopCount: e.stopCount ?? null,
        notableOnly: e.notableOnly ?? null,
        maxEndDistanceKm: e.maxEndDistanceKm ?? null,
        searchRadiusKm: e.searchRadiusKm ?? null,
      };
    }
    return { text: JSON.stringify(body), inTok: 300, outTok: 60 };
  };
}
