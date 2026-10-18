"use client";

import { useEffect, useRef, useState } from "react";

import { EMPTY_AGGREGATES, type CommunityAggregates } from "@/lib/social/aggregates";
import { fetchAggregates, fetchOptIn } from "@/lib/social/client";
import { socialEnabled } from "@/lib/social/flag";

/**
 * Community aggregates for the places on screen. With NEXT_PUBLIC_SOCIAL off,
 * or without the walker's opt-in, this makes no request and returns the shared
 * empty value.
 */
export function useCommunityBadges(
  poiKeys: readonly string[],
  optedIn: boolean,
  signedIn: boolean,
): CommunityAggregates {
  const [data, setData] = useState<CommunityAggregates>(EMPTY_AGGREGATES);
  const joined = poiKeys.join("|");
  useEffect(() => {
    if (!socialEnabled() || !optedIn || !signedIn || joined === "") {
      setData(EMPTY_AGGREGATES);
      return;
    }
    let cancelled = false;
    void fetchAggregates(joined.split("|"), optedIn).then((r) => {
      if (!cancelled) setData(r);
    });
    return () => {
      cancelled = true;
    };
  }, [joined, optedIn, signedIn]);
  return data;
}

/**
 * The server decides: once per sign-in this reads the stored opt-in and makes the
 * local setting match it (never the other way round), so an opt-out or "forget
 * everything" on one device sticks on the others. Writes happen only from the
 * settings toggle. No-op when the flag is off.
 */
export function useSocialOptInSync(
  signedIn: boolean,
  loaded: boolean,
  setLocal: (optedIn: boolean) => void,
): void {
  const done = useRef(false);
  const setRef = useRef(setLocal);
  setRef.current = setLocal;
  useEffect(() => {
    if (!signedIn) done.current = false;
    if (!socialEnabled() || !signedIn || !loaded || done.current) return;
    done.current = true;
    let cancelled = false;
    void fetchOptIn().then((server) => {
      if (!cancelled && server !== null) setRef.current(server);
    });
    return () => {
      cancelled = true;
      done.current = false;
    };
  }, [signedIn, loaded]);
}
