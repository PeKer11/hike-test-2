"use client";

import { useCallback, useEffect, useState } from "react";

import { Accessory } from "@/components/ui/Accessory";
import { EmptyState } from "@/components/ui/EmptyState";
import { BTN_SOFT, LINK, PANEL, PANEL_SUB, PANEL_TITLE, ROW } from "@/components/ui/panel-style";
import { listMyWalksOrThrow, type SavedWalk } from "@/lib/walks/saved-walks";
import { deleteWalk, updateWalk, withWalkClient } from "@/lib/walks/walk-history";
import { fetchWalksWithRuns, type WalkWithRuns } from "@/lib/walks/walk-runs";

interface MyWalksPanelProps {
  isSignedIn: boolean;
  /** Bumped by the planner when a walk was saved or changed, to reload the list. */
  refreshKey: number;
  onWalkAgain: (walk: SavedWalk) => void;
}

const CHIP: Record<SavedWalk["status"], string> = {
  planned: "bg-tk-well text-tk-sage ring-1 ring-tk-line",
  saved: "bg-tk-send/15 text-tk-check",
  completed: "bg-tk-ink/10 text-tk-ink",
};

export function MyWalksPanel({ isSignedIn, refreshKey, onWalkAgain }: MyWalksPanelProps) {
  const [items, setItems] = useState<WalkWithRuns[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<"all" | "drafts">("all");
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    const list = await withWalkClient((c, uid) => listMyWalksOrThrow(c, uid));
    const grouped = list ? await fetchWalksWithRuns(list) : null;
    setFailed(!grouped);
    setItems(grouped ?? []);
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
    <section className={`${PANEL} space-y-3`}>
      <Accessory name="boot" className="absolute -right-1 top-1 w-[68px] -rotate-6" />
      <div className="pr-16">
        <h2 className={PANEL_TITLE}>My walks{loading ? "" : ` (${items.length})`}</h2>
        <p className={PANEL_SUB}>Every walk you built, and each time you walked it.</p>
      </div>
      <div role="group" aria-label="Filter walks" className="flex gap-2 text-xs">
        {(["all", "drafts"] as const).map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={`cursor-pointer rounded-full px-3 py-1 font-medium ${filter === f ? "bg-tk-ink text-tk-card" : "bg-tk-well text-tk-sage ring-1 ring-tk-line"}`}>
            {f === "all" ? "All" : "Drafts"}
          </button>
        ))}
      </div>
      {(
        <>
          {loading && <p className="text-xs text-tk-sage">Loading…</p>}
          {!loading && failed && <EmptyState image="load-error.png" title="Couldn't load your walks" hint="Check your connection and reopen this tab." />}
          {!loading && !failed && shown.length === 0 && (
            <EmptyState image="empty-walks.png" title={filter === "drafts" ? "No drafts" : "No walks yet"} hint="Build one and it shows up here." />
          )}
          <ul aria-label="My walks" className="space-y-2.5">
            {shown.map(({ walk: w, runs, runCount, isDraft }) => (
              <li key={w.id} className={`${ROW} space-y-1`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-[15px] leading-snug text-tk-ink">{w.title}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 ${CHIP[w.status]}`}>{isDraft ? "draft" : w.status}</span>
                </div>
                <p className="text-xs text-tk-sage">
                  {runCount > 0 ? `Last walked ${fmt(runs[0].startedAt)} · ${runCount}×` : fmt(w.createdAt)}
                  {w.totalMin !== null && ` · ${w.totalMin} min`}
                  {w.distanceM !== null && ` · ${(w.distanceM / 1000).toFixed(1)} km`}
                </p>
                {w.stops.length > 0 && <p className="flex items-start gap-1.5 text-tk-body"><Accessory name="footprints" className="mt-0.5 w-4 shrink-0" /><span>{w.stops.map((s) => s.name).join(" → ")}</span></p>}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button type="button" onClick={() => onWalkAgain(w)} className="cursor-pointer rounded-full bg-tk-ink px-3 py-1 text-xs font-medium text-tk-card hover:opacity-90">
                    Walk again
                  </button>
                  {runCount > 1 && (
                    <button type="button" onClick={() => setOpen(open === w.id ? null : w.id)} className={BTN_SOFT}>
                      {open === w.id ? "Hide runs" : "Earlier runs"}
                    </button>
                  )}
                  <button type="button" onClick={() => void toggleVisibility(w)} className={BTN_SOFT}>
                    {w.visibility === "friends" ? "Shared with friends" : "Private"}
                  </button>
                  <button type="button" onClick={() => void remove(w)} className={`${LINK} ml-auto text-tk-sage hover:text-tk-check`}>
                    Delete
                  </button>
                </div>
                {open === w.id && (
                  <ul aria-label="Earlier runs" className="space-y-0.5 border-t border-tk-line pt-1.5 text-xs text-tk-sage">
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
