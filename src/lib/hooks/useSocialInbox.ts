"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { presenceEnabled } from "@/lib/social/flag";
import { listMyRequests, type WalkRequest } from "@/lib/social/walk-requests";
import { withWalkClient } from "@/lib/walks/walk-history";

const POLL_MS = 30_000;
const NONE: WalkRequest[] = [];

/**
 * Walk-together requests, polled every 30 s while the page is visible, the walker is signed in and the feature is on.
 * Stops while the page is hidden. Returns a stable empty array when there is nothing (no re-render churn), and
 * `available:false` when migration C is missing so callers hide the feature.
 */
export function useSocialInbox(enabled: boolean): { requests: WalkRequest[]; available: boolean; refresh: () => void } {
  const [state, setState] = useState<{ requests: WalkRequest[]; available: boolean }>({ requests: NONE, available: false });
  const live = useRef(true);
  const on = enabled && presenceEnabled();

  const load = useCallback(() => {
    if (!on || document.visibilityState === "hidden") return;
    void withWalkClient((c) => listMyRequests(c)).then((rows) => {
      if (!live.current) return;
      setState((cur) => {
        const next = rows ?? NONE;
        const same = cur.available === (rows !== null) && cur.requests.length === next.length && cur.requests.every((r, i) => JSON.stringify(r) === JSON.stringify(next[i]));
        return same ? cur : { requests: next.length === 0 ? NONE : next, available: rows !== null };
      });
    });
  }, [on]);

  useEffect(() => {
    live.current = true;
    if (!on) return;
    load();
    const id = window.setInterval(load, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      live.current = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [on, load]);

  return on ? { ...state, refresh: load } : { requests: NONE, available: false, refresh: load };
}
