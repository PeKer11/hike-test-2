"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  buildCandidates,
  COMPANION_TICK_MS,
  conditionsDue,
  CONDITIONS_REFRESH_MS,
  questionCard,
  type QuestionCard,
  type TickInput,
} from "@/lib/walk/companion/companion-glue";
import {
  CompanionEngine,
  type AnsweredQuestion,
  type EngineCtx,
} from "@/lib/walk/companion/companion-engine";
import { askedHabitQuestion, type HabitTickFacts } from "@/lib/walk/companion/habit-ticker";
import { countWeeklyAsks, loadHabitAsks, recordHabitAsk } from "@/lib/walk/companion/habit-ask-log";
import type { DiscoveryItem } from "@/lib/types/discovery";
import type { AskPriors, AskRecord, Candidate } from "@/lib/walk/companion/companion-types";
import type { ConditionsSnapshot } from "@/lib/walk/companion/producers/conditions";
import type { CopyLang } from "@/lib/walk/discovery-copy";
import { speak, stopSpeaking } from "@/lib/walk/tts";

export interface CompanionSnapshot {
  /** `habit` is null/absent without learning consent: no routine question is then built. */
  tick: Omit<TickInput, "conditions" | "habit"> & {
    habit?: (HabitTickFacts & { items: DiscoveryItem[] }) | null;
  };
  ctx: EngineCtx;
}

export interface UseWalkCompanionOptions {
  /** True while a walk is being tracked. */
  active: boolean;
  lang: CopyLang;
  /** Opted in to spoken questions (default off). */
  voice: boolean;
  /** Read from the screen's refs on every tick; null before the first fix. */
  getSnapshot: () => CompanionSnapshot | null;
  /** A question just went up. */
  onShown?: (cand: Candidate) => void;
  /** The walker answered: run the operator. */
  onAnswered: (answered: AnsweredQuestion, snapshot: CompanionSnapshot | null) => void;
}

/** A failed weather read is retried after this long, not on the next tick. */
const CONDITIONS_RETRY_MS = 5 * 60_000;

/**
 * Runs the walk companion: a ticker that builds candidates from the screen's
 * snapshot, lets the arbiter pick at most one, and exposes it as a card. The
 * decisions live in `CompanionEngine`; this hook is only timers and state.
 */
export function useWalkCompanion(options: UseWalkCompanionOptions) {
  const opts = useRef(options);
  useEffect(() => {
    opts.current = options;
  });

  const engine = useRef<CompanionEngine>(new CompanionEngine());
  const conditions = useRef<ConditionsSnapshot | null>(null);
  const lastConditionsAt = useRef<number | null>(null);
  const [card, setCard] = useState<(QuestionCard & { kind: Candidate["kind"] }) | null>(null);
  const [attribution, setAttribution] = useState<string | null>(null);

  const publish = useCallback(() => {
    const q = engine.current.question;
    setCard(q ? { ...questionCard(q.cand, opts.current.lang, q.askedAt), kind: q.cand.kind } : null);
  }, []);

  const fetchConditions = useCallback((nowMs: number, lat: number, lng: number) => {
    lastConditionsAt.current = nowMs;
    // Rounded before it leaves the device; the route snaps to a 0.1 degree cell anyway.
    const url = `/api/conditions?lat=${lat.toFixed(2)}&lng=${lng.toFixed(2)}`;
    void fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error("conditions");
        const data = (await res.json()) as ConditionsSnapshot & { attribution?: string };
        conditions.current = {
          apparentTempC: data.apparentTempC ?? null,
          precipProbabilityPct: data.precipProbabilityPct ?? null,
        };
        if (data.attribution) setAttribution(data.attribution);
      })
      .catch(() => {
        lastConditionsAt.current = nowMs - CONDITIONS_REFRESH_MS + CONDITIONS_RETRY_MS;
      });
  }, []);

  useEffect(() => {
    if (!options.active) return;
    const eng = engine.current;
    const id = window.setInterval(() => {
      const snap = opts.current.getSnapshot();
      if (!snap) return;
      const nowMs = snap.tick.nowMs;
      if (conditionsDue(lastConditionsAt.current, nowMs)) {
        fetchConditions(nowMs, snap.tick.position.lat, snap.tick.position.lng);
      }
      const habit = snap.tick.habit
        ? {
            ...snap.tick.habit,
            lang: opts.current.lang,
            weeklyAsks: countWeeklyAsks(loadHabitAsks(), nowMs),
            askedThisWalk: askedHabitQuestion(engine.current.records),
          }
        : null;
      const cands = buildCandidates({ ...snap.tick, habit, conditions: conditions.current });
      const had = engine.current.question;
      if (engine.current.tick(cands, snap.ctx, nowMs)) {
        publish();
        const now = engine.current.question;
        if (now && now !== had) {
          if (now.cand.kind === "habit-eat" || now.cand.kind === "habit-coffee") {
            recordHabitAsk(nowMs);
          }
          opts.current.onShown?.(now.cand);
          speak(
            questionCard(now.cand, opts.current.lang, now.askedAt).title,
            opts.current.lang,
            opts.current.voice,
          );
        }
      }
    }, COMPANION_TICK_MS);
    // A walk that stops (or a screen that unmounts) takes any question with it.
    return () => {
      window.clearInterval(id);
      eng.cancel();
      stopSpeaking();
      setCard(null);
    };
  }, [options.active, fetchConditions, publish]);

  const answer = useCallback(
    (answerId: string) => {
      const result = engine.current.answer(answerId);
      stopSpeaking();
      publish();
      if (result) opts.current.onAnswered(result, opts.current.getSnapshot());
    },
    [publish],
  );

  return {
    /** The question to show, or null. */
    card,
    answer,
    /** Open-Meteo credit, once weather has been read. */
    attribution,
    /** This walk's asks so far (for the walk-end write). */
    records: (): AskRecord[] => engine.current.records,
    /** Seed cross-walk answer stats (the arbiter's p(act) prior). */
    setPriors: (priors: AskPriors) => engine.current.setPriors(priors),
    /** Clears the walk's history, any question and the cached weather. */
    reset: () => {
      engine.current.cancel();
      engine.current.reset();
      conditions.current = null;
      lastConditionsAt.current = null;
      setAttribution(null);
      stopSpeaking();
      setCard(null);
    },
  };
}
