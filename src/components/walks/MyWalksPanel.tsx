"use client";

import { useCallback, useEffect, useState } from "react";

import { listMyWalks, type SavedWalk } from "@/lib/walks/saved-walks";
import { deleteWalk, updateWalk, withWalkClient } from "@/lib/walks/walk-history";
import { fetchWalksWithRuns, type WalkWithRuns } from "@/lib/walks/walk-runs";

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
  const [items, setItems] = useState<WalkWithRuns[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "drafts">("all");
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    const list = await withWalkClient((c, uid) => listMyWalks(c, uid));
    setItems(await fetchWalksWithRuns(list ?? []));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isSignedIn) void load();
  }, [isSignedIn, refreshKey, load]);

  if (!isSignedIn) return null;

  const toggleVisibility = async (w: SavedWalk) => {
    const next = w.visibility === "private" ? "friends" : "private";
    if (await updateWalk(w.id, { visibility: next })) {
      setItems((cur) => cur.map((x) => (x.walk.id === w.id ? { ...x, walk: { ...x.walk, visibility: next } } : x)));
    }
  };

  const remove = async (w: SavedWalk) => {
    if (await deleteWalk(w.id)) setItems((cur) => cur.filter((x) => x.walk.id !== w.id));
  };

  const shown = filter === "drafts" ? items.filter((i) => i.isDraft) : items;
  const fmt = (iso: string) => new Date(iso).toLocaleDateString("en", { month: "short", day: "numeric" });

  return (
    <section className="space-y-2 rounded-[10px] border border-charcoal/10 bg-cream/60 p-3">
      <h2 className="text-sm font-medium text-charcoal/80">My walks ({loading ? "…" : items.length})</h2>
      <div role="group" aria-label="Filter walks" className="flex gap-2 text-xs">
        {(["all", "drafts"] as const).map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={`cursor-pointer rounded-full px-2 py-0.5 ${filter === f ? "bg-forest text-cream" : "bg-charcoal/10 text-charcoal/70"}`}>
            {f === "all" ? "All" : "Drafts"}
          </button>
        ))}
      </div>
      {(
        <>
          {loading && <p className="text-xs text-charcoal/60">Loading…</p>}
          {!loading && shown.length === 0 && <p className="text-xs text-charcoal/60">No walks yet. Build one and it shows up here.</p>}
          <ul aria-label="My walks" className="space-y-2">
            {shown.map(({ walk: w, runs, runCount, isDraft }) => (
              <li key={w.id} className="space-y-1 rounded-md bg-white/70 p-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-charcoal">{w.title}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 ${CHIP[w.status]}`}>{isDraft ? "draft" : w.status}</span>
                </div>
                <p className="text-charcoal/60">
                  {runCount > 0 ? `Last walked ${fmt(runs[0].startedAt)} · ${runCount}×` : fmt(w.createdAt)}
                  {w.totalMin !== null && ` · ${w.totalMin} min`}
                  {w.distanceM !== null && ` · ${(w.distanceM / 1000).toFixed(1)} km`}
                </p>
                {w.stops.length > 0 && <p className="text-charcoal/80">{w.stops.map((s) => s.name).join(" → ")}</p>}
                <div className="flex flex-wrap gap-3 pt-1">
                  <button type="button" onClick={() => onWalkAgain(w)} className="cursor-pointer font-medium text-forest hover:underline">
                    Walk again
                  </button>
                  {runCount > 1 && (
                    <button type="button" onClick={() => setOpen(open === w.id ? null : w.id)} className="cursor-pointer text-charcoal/70 hover:text-forest">
                      {open === w.id ? "Hide runs" : "Earlier runs"}
                    </button>
                  )}
                  <button type="button" onClick={() => void toggleVisibility(w)} className="cursor-pointer text-charcoal/70 hover:text-forest">
                    {w.visibility === "friends" ? "Shared with friends" : "Private"}
                  </button>
                  <button type="button" onClick={() => void remove(w)} className="cursor-pointer text-charcoal/40 hover:text-terra">
                    Delete
                  </button>
                </div>
                {open === w.id && (
                  <ul aria-label="Earlier runs" className="space-y-0.5 border-t border-charcoal/10 pt-1 text-charcoal/70">
                    {runs.map((r) => (
                      <li key={r.id}>
                        {fmt(r.startedAt)}
                        {r.minutes !== null && ` · ${r.minutes} min`}
                        {r.distanceM !== null && ` · ${(r.distanceM / 1000).toFixed(1)} km`}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
