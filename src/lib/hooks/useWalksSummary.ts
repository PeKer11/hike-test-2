"use client";

import { useEffect, useState } from "react";

import { listFriends } from "@/lib/walks/friends";
import { listMyWalksOrThrow } from "@/lib/walks/saved-walks";
import { fetchWalksWithRuns } from "@/lib/walks/walk-runs";
import { withWalkClient } from "@/lib/walks/walk-history";

export interface WalksSummary {
  saved: number;
  walked: number;
  /** Kilometres over the walked ones that carry a distance. */
  km: number;
  friends: number;
}

/** The numbers on the Walks band and its Saved / Walked / Friends tabs. Null until loaded (or signed out). */
export function useWalksSummary(signedIn: boolean, refreshKey = 0): WalksSummary | null {
  const [summary, setSummary] = useState<WalksSummary | null>(null);
  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    void withWalkClient(async (client, userId) => {
      const list = await listMyWalksOrThrow(client, userId, 200).catch(() => null);
      const grouped = list ? await fetchWalksWithRuns(list) : null;
      const friends = await listFriends(client).catch(() => []);
      return { grouped, friends };
    }).then((r) => {
      if (!live || !r?.grouped) return;
      const walked = r.grouped.filter((i) => i.walk.status === "completed" || i.runCount > 0);
      const saved = r.grouped.filter((i) => !(i.walk.status === "completed" || i.runCount > 0) && (i.walk.status === "saved" || i.isDraft));
      const km = walked.reduce((sum, i) => sum + (i.walk.distanceM ?? 0), 0) / 1000;
      setSummary({ saved: saved.length, walked: walked.length, km, friends: r.friends.filter((f) => f.status === "accepted").length });
    });
    return () => {
      live = false;
    };
  }, [signedIn, refreshKey]);
  return summary;
}
