"use client";

import { useCallback, useEffect, useState } from "react";

import { listMyWalks, type SavedWalk } from "@/lib/walks/saved-walks";
import { deleteWalk, updateWalk, withWalkClient } from "@/lib/walks/walk-history";

interface MyWalksPanelProps {
  isSignedIn: boolean;
  /** Bumped by the planner when a walk was saved or changed, to reload the list. */
  refreshKey: number;
  onWalkAgain: (walk: SavedWalk) => void;
}

const CHIP: Record<SavedWalk["status"], string> = {
  planned: "bg-charcoal/10 text-charcoal/70",
  saved: "bg-terra/15 text-terra",
  completed: "bg-forest/15 text-forest",
};

export function MyWalksPanel({ isSignedIn, refreshKey, onWalkAgain }: MyWalksPanelProps) {
  const [walks, setWalks] = useState<SavedWalk[]>([]);

  const load = useCallback(async () => {
    const list = await withWalkClient((c, uid) => listMyWalks(c, uid));
    setWalks(list ?? []);
  }, []);

  useEffect(() => {
    if (isSignedIn) void load();
  }, [isSignedIn, refreshKey, load]);

  if (!isSignedIn) return null;

  const toggleVisibility = async (w: SavedWalk) => {
    const next = w.visibility === "private" ? "friends" : "private";
    if (await updateWalk(w.id, { visibility: next })) {
      setWalks((cur) => cur.map((x) => (x.id === w.id ? { ...x, visibility: next } : x)));
    }
  };

  const remove = async (w: SavedWalk) => {
    if (await deleteWalk(w.id)) setWalks((cur) => cur.filter((x) => x.id !== w.id));
  };

  return (
    <section className="space-y-2 rounded-[10px] border border-charcoal/10 bg-cream/60 p-3">
      <h2 className="text-sm font-medium text-charcoal/80">My walks ({walks.length})</h2>
      {(
        <>
          {walks.length === 0 && <p className="text-xs text-charcoal/60">No walks yet. Build one and it shows up here.</p>}
          <ul aria-label="My walks" className="space-y-2">
            {walks.map((w) => (
              <li key={w.id} className="space-y-1 rounded-md bg-white/70 p-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-charcoal">{w.title}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 ${CHIP[w.status]}`}>{w.status}</span>
                </div>
                <p className="text-charcoal/60">
                  {new Date(w.createdAt).toLocaleDateString("en", { month: "short", day: "numeric" })}
                  {w.totalMin !== null && ` · ${w.totalMin} min`}
                  {w.distanceM !== null && ` · ${(w.distanceM / 1000).toFixed(1)} km`}
                </p>
                {w.stops.length > 0 && <p className="text-charcoal/80">{w.stops.map((s) => s.name).join(" → ")}</p>}
                <div className="flex flex-wrap gap-3 pt-1">
                  <button type="button" onClick={() => onWalkAgain(w)} className="cursor-pointer font-medium text-forest hover:underline">
                    Walk again
                  </button>
                  <button type="button" onClick={() => void toggleVisibility(w)} className="cursor-pointer text-charcoal/70 hover:text-forest">
                    {w.visibility === "friends" ? "Shared with friends" : "Private"}
                  </button>
                  <button type="button" onClick={() => void remove(w)} className="cursor-pointer text-charcoal/40 hover:text-terra">
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
