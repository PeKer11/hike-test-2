"use client";

import { useEffect, useState } from "react";

import { resolvePlaces } from "@/lib/walks/friend-plan";
import type { WalkRequest } from "@/lib/social/walk-requests";

/**
 * Names for Google meeting places, looked up live (the database keeps only the place id; Maps Platform terms).
 * OSM meeting places carry their own name. In memory only, never stored.
 */
export function useMeetNames(requests: readonly WalkRequest[]): Map<string, string> {
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const wanted = requests.flatMap((r) => (r.meet.kind === "google" && r.status !== "declined" && r.status !== "cancelled" && r.status !== "expired" ? [r.meet.ref] : []));
  const key = [...new Set(wanted)].sort().join(",");
  useEffect(() => {
    if (!key) return;
    let live = true;
    void resolvePlaces(key.split(",")).then((found) => {
      if (!live || found.size === 0) return;
      setNames((cur) => {
        const next = new Map(cur);
        for (const [id, p] of found) next.set(id, p.name);
        return next;
      });
    });
    return () => {
      live = false;
    };
  }, [key]);
  return names;
}

export function meetLabel(r: WalkRequest, names: Map<string, string>, fallback: string): string {
  return r.meet.kind === "osm" ? r.meet.name : (names.get(r.meet.ref) ?? fallback);
}
