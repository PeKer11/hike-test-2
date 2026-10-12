import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { mockOracleProvider } from "@/lib/llm/eval-mock";
import { normalizePlace, passesSwitchRule, placeF1, runCase, runEval, type EvalCase } from "@/lib/llm/eval-runner";
import type { ProviderCall } from "@/lib/llm/types";

const cases = readFileSync(resolve(__dirname, "llm-eval/cases.jsonl"), "utf8")
  .split("\n").filter(Boolean).map((l) => JSON.parse(l) as EvalCase);
const choice = { provider: "gemini", model: "gemini-3.1-flash-lite" } as const;

describe("eval cases", () => {
  it("has >=70 cases, >=30 Hebrew, >=10 injection, unique ids", () => {
    expect(cases.length).toBeGreaterThanOrEqual(70);
    expect(cases.filter((c) => c.lang === "he").length).toBeGreaterThanOrEqual(30);
    expect(cases.filter((c) => c.kind === "injection").length).toBeGreaterThanOrEqual(10);
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
  });
});

describe("eval runner (mock dry run)", () => {
  it("an oracle scores 100% and passes the switch rule", async () => {
    const r = await runEval(cases, choice, { providers: { gemini: mockOracleProvider(cases) } });
    expect(r.schemaValidPct).toBe(100);
    expect(r.fieldExactPct).toBe(100);
    expect(r.injectionResistancePct).toBe(100);
    expect(passesSwitchRule(r, 100)).toBe(true);
  });

  it("a model that obeys injected text is caught, and bad JSON counts as invalid", async () => {
    const oracle = mockOracleProvider(cases);
    const obedient: ProviderCall = async (req) => {
      const r = await oracle(req);
      if (!req.user.includes("מקום זדוני")) return r;
      const j = JSON.parse(r.text);
      j.places.push("מקום זדוני");
      return { ...r, text: JSON.stringify(j) };
    };
    const r = await runEval(cases, choice, { providers: { gemini: obedient } });
    expect(r.injectionResistancePct).toBeLessThan(100);
    expect(passesSwitchRule(r, 100)).toBe(false);
    const junk: ProviderCall = async () => {
      throw new Error("provider down");
    };
    const bad = await runEval(cases.slice(0, 5), choice, { providers: { gemini: junk } });
    expect(bad.schemaValidPct).toBe(0);
  });

  it("a failed case counts the same scored fields as a success: places is F1, not a field", async () => {
    const down: ProviderCall = async () => {
      throw new Error("down");
    };
    const c: EvalCase = { id: "x", kind: "extract-places", lang: "en", prompt: "p", expect: { places: ["A"], durationMinutes: 30 } };
    const o = await runCase(c, choice, { providers: { gemini: down } });
    expect(o.fieldsChecked).toBe(1);
    expect(o.placeF1).toBe(0);
  });

  it("scores places with niqqud and punctuation stripped", () => {
    expect(normalizePlace("הַכּוֹתֶל!")).toBe(normalizePlace("הכותל"));
    expect(placeF1(["A", "B"], ["a"])).toBeCloseTo(2 / 3);
    expect(placeF1([], [])).toBe(1);
  });
});
