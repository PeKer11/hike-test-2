"use client";

import { accessBody } from "@/lib/walk/active-access";
import { useCallback, useEffect, useRef, useState } from "react";

import type { Coordinates } from "@/lib/types";
import { haversineDistance } from "@/lib/utils/geo";
import { spliceRoute } from "@/lib/walk/rejoin";
import {
  acceptConnector,
  SHORTCUT_OFFER_MAX_DRIFT_M,
  SHORTCUT_OFFER_TTL_MS,
  shortcutTarget,
  ShortcutGate,
  worthChecking,
  type ShortcutStop,
  type ShortcutTarget,
} from "@/lib/walk/shortcut";

export interface ShortcutContext {
  geometry: Coordinates[];
  segmentIndex: number;
  matchedPoint: Coordinates;
  position: Coordinates;
  /** Fix timestamp, ms. */
  atMs: number;
  /** Metres walked so far along the plan. */
  walkedM: number;
  /** Unvisited plan stops, pins included. */
  stops: ShortcutStop[];
  speedMps: number;
  /** Something else owns the walker right now (off route, rejoin, collapse, a card...). */
  blocked: boolean;
}

export interface ShortcutOffer {
  id: string;
  stopName: string | null;
  savingM: number;
  savingMin: number;
}

export interface ShortcutOfferDeps {
  getContext: () => ShortcutContext | null;
  onApply: (spliced: Coordinates[], atMs: number) => void;
  doFetch?: typeof fetch;
}

interface Pending {
  geometry: Coordinates[];
  target: ShortcutTarget;
  connector: Coordinates[];
  from: Coordinates;
  atMs: number;
  /** Wall clock when the offer was made: the TTL must hold without fresh fixes. */
  wallAt: number;
  /** The walker actually saw the chip (a higher-priority card may have hidden it). */
  shown: boolean;
}

export interface ShortcutOfferApi {
  offer: ShortcutOffer | null;
  /** Call on every accepted fix. Resolves once any check it started is done. */
  feed: () => Promise<void>;
  /** Apply the offered shortcut; false when it is no longer valid. */
  accept: () => boolean;
  dismiss: () => void;
  /** Withdraw an offer older than the TTL on the wall clock (no fix needed). */
  expire: () => void;
  /** The chip is on screen now; only a shown offer counts as a decline when it lapses. */
  markShown: () => void;
  /** Drop the offer and ignore any check in flight (re-plan, stop tracking). */
  clear: () => void;
  /** New walk: also forget the budget. */
  endWalk: () => void;
}

/**
 * One-tap "shorter way" offer. Never applies anything by itself. The ORS call is
 * opportunistic: any failure is silent. Everything stateful is in refs so the
 * per-fix closure is never stale (same pattern as useCollapseFlow).
 */
export function useShortcutOffer(deps: ShortcutOfferDeps): ShortcutOfferApi {
  const depsRef = useRef(deps);
  useEffect(() => {
    depsRef.current = deps;
  });
  const gateRef = useRef(new ShortcutGate());
  const pendingRef = useRef<Pending | null>(null);
  const requestIdRef = useRef(0);
  const inFlightRef = useRef(false);
  const [offer, setOffer] = useState<ShortcutOffer | null>(null);

  const clear = useCallback(() => {
    requestIdRef.current += 1;
    inFlightRef.current = false;
    pendingRef.current = null;
    setOffer(null);
  }, []);

  const dismiss = useCallback(() => {
    const pending = pendingRef.current;
    if (pending) gateRef.current.decline(pending.geometry, pending.target.stopId);
    clear();
  }, [clear]);

  const markShown = useCallback(() => {
    if (pendingRef.current) pendingRef.current.shown = true;
  }, []);

  // A lapsed offer is a decline only if the walker was actually shown it.
  const withdraw = useCallback((pending: Pending) => {
    if (pending.shown) gateRef.current.decline(pending.geometry, pending.target.stopId);
    pendingRef.current = null;
    setOffer(null);
  }, []);

  const expire = useCallback(() => {
    const pending = pendingRef.current;
    if (pending && Date.now() - pending.wallAt > SHORTCUT_OFFER_TTL_MS) withdraw(pending);
  }, [withdraw]);

  const endWalk = useCallback(() => {
    clear();
    gateRef.current.reset();
  }, [clear]);

  const feed = useCallback(async () => {
    const d = depsRef.current;
    const ctx = d.getContext();
    if (!ctx) return;
    const gate = gateRef.current;

    const pending = pendingRef.current;
    if (pending) {
      if (
        ctx.geometry !== pending.geometry ||
        haversineDistance(ctx.position, pending.from) > SHORTCUT_OFFER_MAX_DRIFT_M ||
        ctx.atMs - pending.atMs > SHORTCUT_OFFER_TTL_MS
      ) {
        withdraw(pending);
      }
      return;
    }
    if (ctx.blocked || inFlightRef.current) return;

    if (!gate.canCheckGlobal(ctx.atMs, ctx.geometry, ctx.walkedM)) return;
    const target = shortcutTarget(ctx.geometry, ctx.segmentIndex, ctx.matchedPoint, ctx.stops);
    if (!target) return;
    if (!worthChecking(target.alongM, haversineDistance(ctx.position, target.point), ctx.speedMps)) {
      return;
    }
    if (!gate.canCheck(ctx.atMs, ctx.geometry, ctx.walkedM, target.stopId)) return;
    gate.recordCheck(ctx.atMs, ctx.geometry, ctx.walkedM);

    const id = ++requestIdRef.current;
    inFlightRef.current = true;
    let data: { geometry?: Coordinates[]; distanceMeters?: number } | null = null;
    try {
      const res = await (d.doFetch ?? fetch)("/api/reroute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: ctx.position, candidates: [target.point], ...accessBody() }),
      });
      if (res.ok) data = await res.json();
    } catch {
      data = null;
    }
    if (id !== requestIdRef.current) return;
    inFlightRef.current = false;
    if (
      !data ||
      !Array.isArray(data.geometry) ||
      data.geometry.length < 2 ||
      typeof data.distanceMeters !== "number"
    ) {
      return;
    }
    const verdict = acceptConnector(target.alongM, data.distanceMeters, ctx.speedMps);
    if (!verdict) return;
    if (depsRef.current.getContext()?.geometry !== ctx.geometry) return;

    pendingRef.current = {
      geometry: ctx.geometry,
      target,
      connector: data.geometry,
      from: ctx.position,
      atMs: ctx.atMs,
      wallAt: Date.now(),
      shown: false,
    };
    setOffer({ id: `shortcut-${id}`, stopName: target.label, ...verdict });
  }, [withdraw]);

  const accept = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return false;
    const ctx = depsRef.current.getContext();
    if (
      Date.now() - pending.wallAt > SHORTCUT_OFFER_TTL_MS ||
      !ctx ||
      ctx.geometry !== pending.geometry ||
      haversineDistance(ctx.position, pending.from) > SHORTCUT_OFFER_MAX_DRIFT_M
    ) {
      clear();
      return false;
    }
    const spliced = spliceRoute(pending.geometry, pending.target, pending.connector);
    clear();
    depsRef.current.onApply(spliced, ctx.atMs);
    return true;
  }, [clear]);

  return { offer, feed, accept, dismiss, expire, markShown, clear, endWalk };
}
