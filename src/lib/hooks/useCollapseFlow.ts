"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  collapseAllowed,
  initialCollapseState,
  optionsReady,
  rejoinResult,
  resolveCollapse,
  stepCollapse,
  type CollapseFix,
  type CollapseState,
} from "@/lib/walk/collapse-machine";
import {
  planDirectionOptions,
  routeDirectionOptions,
  type OfferedOption,
  type OptionsContext,
} from "@/lib/walk/options-request";

export type OfferMode = "collapse" | "manual";

export interface CollapseFlowDeps {
  /** The live walk as the option generator needs it; null when there is no fix yet. */
  getContext: () => OptionsContext | null;
  /** The options shown (so the collection can count them as offered). */
  onShown: (options: OfferedOption[]) => void;
  /** A collapse found nothing to offer: the caller falls back to a full re-plan. */
  onNoOptions: () => void;
}

export interface CollapseFlow {
  /** The options on offer, or null. */
  offer: { options: OfferedOption[]; mode: OfferMode } | null;
  loading: boolean;
  highlight: number;
  setHighlight: (index: number) => void;
  /** Feed every accepted fix (fix timestamps only). */
  feed: (fix: CollapseFix) => void;
  /** A local rejoin failed; true when that was the second one and the walk collapsed. */
  rejoinFailed: (atMs: number) => boolean;
  /** A collapse is pending or its options are on screen: nothing may re-plan on its own. */
  isCollapsed: () => boolean;
  /** The options are on screen: nothing may replace them on its own. */
  isOffering: () => boolean;
  /** Whether a far-away walker should wait for the collapse instead of an instant re-plan. */
  canCollapse: (atMs: number) => boolean;
  /** "Show me something different": the same generator without a collapse. */
  offerDifferent: () => void;
  /** The walker chose an option or went back: the collapse is over. */
  resolve: () => void;
  /** Drop the sheet and ignore any request still in flight (a re-plan, End walk). */
  clear: () => void;
  /** New walk: forget the collapse counters too. */
  endWalk: () => void;
}

/**
 * Wires the pure `collapse-machine` to the option generator and the sheet. The
 * machine runs on fix timestamps; everything stateful lives in refs so the
 * per-fix path never waits on a render. Options are never picked for the walker.
 *
 * A request carries an id: `clear()` (End walk, a re-plan, a new walk) bumps it,
 * so a slow `/api/walk-options` answer that arrives afterwards is dropped
 * instead of restarting a walk that is over.
 */
export function useCollapseFlow(deps: CollapseFlowDeps): CollapseFlow {
  const machineRef = useRef<CollapseState>(initialCollapseState());
  const requestIdRef = useRef(0);
  const depsRef = useRef(deps);
  useEffect(() => {
    depsRef.current = deps;
  });
  const [offer, setOffer] = useState<CollapseFlow["offer"]>(null);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const clear = useCallback(() => {
    requestIdRef.current += 1;
    // A re-plan that fails and reverts must not strand the walker in a collapse
    // whose request/sheet is gone. Count and cooldown stay (resolveCollapse).
    const { phase } = machineRef.current;
    if (phase === "COLLAPSED" || phase === "OFFERING") {
      machineRef.current = resolveCollapse(machineRef.current);
    }
    setOffer(null);
    setLoading(false);
    setHighlight(0);
  }, []);

  const request = useCallback(
    async (mode: OfferMode) => {
      const ctx = depsRef.current.getContext();
      const id = ++requestIdRef.current;
      setOffer(null);
      const nothing = () => {
        setLoading(false);
        // A manual request can supersede a loading collapse request and then come
        // back empty: the machine must not stay COLLAPSED with nothing on screen.
        const { phase } = machineRef.current;
        if (phase === "COLLAPSED" || phase === "OFFERING") {
          machineRef.current = resolveCollapse(machineRef.current);
        }
        if (mode === "collapse") depsRef.current.onNoOptions();
      };
      // Planning is local and instant: with nothing to offer there is no request
      // to wait for, so the fallback runs in the same tick as the collapse.
      const built = ctx ? planDirectionOptions(ctx) : [];
      if (!ctx || built.length === 0) {
        nothing();
        return;
      }
      setLoading(true);
      let options: OfferedOption[] = [];
      try {
        options = await routeDirectionOptions(ctx, built);
      } catch {
        options = [];
      }
      // Superseded: the walk ended, was re-planned, or asked again.
      if (id !== requestIdRef.current) return;
      if (options.length === 0) {
        nothing();
        return;
      }
      setLoading(false);
      if (mode === "collapse") machineRef.current = optionsReady(machineRef.current);
      depsRef.current.onShown(options);
      setHighlight(0);
      setOffer({ options, mode });
    },
    [],
  );

  const feed = useCallback(
    (fix: CollapseFix) => {
      const prev = machineRef.current;
      const step = stepCollapse(prev, fix);
      machineRef.current = step.state;
      if (step.effect === "collapse") {
        void request("collapse");
        return;
      }
      const wasCollapsed = prev.phase === "COLLAPSED" || prev.phase === "OFFERING";
      if (wasCollapsed && step.state.phase === "ON_ROUTE") clear();
    },
    [request, clear],
  );

  const rejoinFailed = useCallback(
    (atMs: number) => {
      const state = machineRef.current;
      const base: CollapseState =
        state.phase === "OFF_ROUTE" ? { ...state, phase: "REJOINING" } : state;
      const step = rejoinResult(base, { ok: false, atMs });
      machineRef.current = step.state;
      if (step.effect === "collapse") {
        void request("collapse");
        return true;
      }
      return false;
    },
    [request],
  );

  const isCollapsed = useCallback(() => {
    const { phase } = machineRef.current;
    return phase === "COLLAPSED" || phase === "OFFERING";
  }, []);

  const isOffering = useCallback(() => machineRef.current.phase === "OFFERING", []);

  const canCollapse = useCallback(
    (atMs: number) =>
      !isCollapsed() && collapseAllowed(machineRef.current, atMs),
    [isCollapsed],
  );

  const offerDifferent = useCallback(() => {
    void request("manual");
  }, [request]);

  const resolve = useCallback(() => {
    machineRef.current = resolveCollapse(machineRef.current);
    clear();
  }, [clear]);

  const endWalk = useCallback(() => {
    machineRef.current = initialCollapseState();
    clear();
  }, [clear]);

  return {
    offer,
    loading,
    highlight,
    setHighlight,
    feed,
    rejoinFailed,
    isCollapsed,
    isOffering,
    canCollapse,
    offerDifferent,
    resolve,
    clear,
    endWalk,
  };
}
