"use client";

import { Fragment, useCallback, useEffect, useState } from "react";

import { Accessory } from "@/components/ui/Accessory";
import { EmptyState } from "@/components/ui/EmptyState";
import { BTN_SOFT, LINK, PANEL, PANEL_TITLE, ROW } from "@/components/ui/panel-style";
import { listMyWalksOrThrow, type SavedWalk } from "@/lib/walks/saved-walks";
import { deleteWalk, updateWalk, withWalkClient } from "@/lib/walks/walk-history";
import { RouteSketch } from "@/components/walks/RouteSketch";
import { routeOf } from "@/lib/walks/walk-again";
import { locateOnce } from "@/lib/geo/here";
import { requestVariant } from "@/lib/walks/variant-client";
import { fetchWalksWithRuns, type WalkWithRuns } from "@/lib/walks/walk-runs";

interface MyWalksPanelProps {
  isSignedIn: boolean;
  /** Bumped by the planner when a walk was saved or changed, to reload the list. */
  refreshKey: number;
  onWalkAgain: (walk: SavedWalk) => void;
  /** Open the walk's stops as a new draft in the planner (saving it makes a new walk). */
  onEditAsNew?: (walk: SavedWalk) => void;
  /** The walk currently drawn on the map from this list, and the toggle that draws or clears it (null clears). */
  previewId?: string | null;
  onShowOnMap?: (walk: SavedWalk | null) => void;
  /** Walks screen: show only the walked ones (history) or the saved and draft ones. Without it, the old All / Drafts filter. */
  segment?: WalksSegment;
  lang?: "he" | "en";
  /** The empty state's button (Walks screen). */
  onNewRoute?: () => void;
}

export type WalksSegment = "history" | "saved";

/** History: walked at least once or completed. Saved: bookmarked, plus drafts (planned, never walked). */
export function filterBySegment(items: WalkWithRuns[], segment: WalksSegment): WalkWithRuns[] {
  return items.filter((i) => (segment === "history" ? i.walk.status === "completed" || i.runCount > 0 : !(i.walk.status === "completed" || i.runCount > 0) && (i.walk.status === "saved" || i.isDraft)));
}

const CHIP: Record<SavedWalk["status"], string> = {
  planned: "bg-tk-well text-tk-sage ring-1 ring-tk-line",
  saved: "bg-tk-send/15 text-tk-check",
  completed: "bg-tk-ink/10 text-tk-ink",
};

export function MyWalksPanel({ isSignedIn, refreshKey, onWalkAgain, onEditAsNew, previewId = null, onShowOnMap, segment, lang = "en", onNewRoute }: MyWalksPanelProps) {
  const [items, setItems] = useState<WalkWithRuns[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<"all" | "drafts">("all");
  const [open, setOpen] = useState<string | null>(null);
  // Variants: which walk's menu is open, whether one is being made, what to tell the walker, and which parents are expanded.
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [shorterFor, setShorterFor] = useState<string | null>(null);
  const [making, setMaking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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
    if (await deleteWalk(w.id)) {
      if (previewId === w.id) onShowOnMap?.(null);
      setItems((cur) => cur.filter((x) => x.walk.id !== w.id));
    }
  };

  const makeVariant = async (w: SavedWalk, request: Parameters<typeof requestVariant>[1]) => {
    setMenuFor(null);
    setShorterFor(null);
    setMaking(true);
    setNotice(null);
    const answer = await requestVariant(w.id, request);
    setMaking(false);
    if (!answer.ok) {
      setNotice(answer.needsAi ? "That is too short to get by dropping stops: ask the assistant for a new shorter walk." : answer.error);
      return;
    }
    setNotice(`Saved "${answer.walk.title}".`);
    await load();
    setExpanded((cur) => new Set(cur).add(w.id));
  };

  const fromHere = async (w: SavedWalk) => {
    setMenuFor(null);
    const here = await locateOnce(6000);
    if (!here) {
      setNotice("Allow your location to start the walk from here.");
      return;
    }
    await makeVariant(w, { kind: "start_here", at: here });
  };

  // A variant sits under the walk it came from; one whose parent is not in the list stands alone.
  const ids = new Set(items.map((i) => i.walk.id));
  const variantsOf = (id: string) => items.filter((i) => i.walk.parentWalkId === id);
  const isNested = (i: WalkWithRuns) => Boolean(i.walk.parentWalkId && ids.has(i.walk.parentWalkId));
  const base = segment ? filterBySegment(items, segment) : filter === "drafts" ? items.filter((i) => i.isDraft) : items;
  const shown = base.filter((i) => !isNested(i) || segment !== undefined || filter === "drafts");
  const fmt = (iso: string) => new Date(iso).toLocaleDateString("en", { month: "short", day: "numeric" });

  const card = ({ walk: w, runs, runCount, isDraft }: WalkWithRuns) => (
              <li key={w.id} className={ROW}>
    <div className="flex items-start gap-3">
      <RouteSketch route={routeOf(w)} label={`Route of ${w.title}`} className="h-16 w-16 shrink-0" />
      <div className="min-w-0 flex-1 space-y-1">
    <div className="flex items-center justify-between gap-2">
      <span className="font-display text-[15px] leading-snug text-tk-ink">{w.title}</span>
      <span className={`shrink-0 rounded-full px-2 py-0.5 ${CHIP[w.status]}`}>{isDraft ? "draft" : w.status}</span>
    </div>
    <p className="text-[13px] text-tk-sage">
      {runCount > 0 ? `Last walked ${fmt(runs[0].startedAt)} · ${runCount}×` : fmt(w.createdAt)}
      {w.totalMin !== null && ` · ${w.totalMin} min`}
      {w.distanceM !== null && ` · ${(w.distanceM / 1000).toFixed(1)} km`}
    </p>
    {w.stops.length > 0 && <p className="flex items-start gap-1.5 text-tk-body"><Accessory name="footprints" className="mt-0.5 w-4 shrink-0" /><span>{w.stops.map((s) => s.name).join(" → ")}</span></p>}
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <button type="button" onClick={() => onWalkAgain(w)} className="min-h-11 cursor-pointer rounded-full bg-terra px-5 text-[15px] font-semibold text-on-accent hover:bg-terra/90">
        Walk again
      </button>
      <button type="button" aria-expanded={menuFor === w.id} disabled={making} onClick={() => setMenuFor(menuFor === w.id ? null : w.id)} className={BTN_SOFT}>
        Version ▾
      </button>
      {variantsOf(w.id).length > 0 && (
        <button
          type="button"
          aria-expanded={expanded.has(w.id)}
          onClick={() => setExpanded((cur) => { const next = new Set(cur); if (!next.delete(w.id)) next.add(w.id); return next; })}
          className={BTN_SOFT}
        >
          {variantsOf(w.id).length} {variantsOf(w.id).length === 1 ? "version" : "versions"}
        </button>
      )}
      {onShowOnMap && w.stops.length > 0 && (
        <button type="button" aria-pressed={previewId === w.id} onClick={() => onShowOnMap(previewId === w.id ? null : w)} className={BTN_SOFT}>
          {previewId === w.id ? "Hide from map" : "Show on map"}
        </button>
      )}
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
    {menuFor === w.id && (
      <div role="menu" aria-label="Make a version" className="space-y-1 border-t border-tk-line pt-1.5">
        <button role="menuitem" type="button" onClick={() => void makeVariant(w, { kind: "reverse" })} className={BTN_SOFT}>
          Reverse direction
        </button>
        <button role="menuitem" type="button" aria-expanded={shorterFor === w.id} onClick={() => setShorterFor(shorterFor === w.id ? null : w.id)} className={BTN_SOFT}>
          Shorter ›
        </button>
        {shorterFor === w.id && (
          <div role="group" aria-label="Target minutes" className="flex gap-2 pl-2">
            {[30, 45, 60].map((m) => (
              <button key={m} type="button" onClick={() => void makeVariant(w, { kind: "shorter", minutes: m })} className={BTN_SOFT}>
                {m} min
              </button>
            ))}
          </div>
        )}
        <button role="menuitem" type="button" onClick={() => void fromHere(w)} className={BTN_SOFT}>
          From here
        </button>
        {onEditAsNew && (
          <button role="menuitem" type="button" onClick={() => { setMenuFor(null); onEditAsNew(w); }} className={BTN_SOFT}>
            Edit as new
          </button>
        )}
      </div>
    )}
    {open === w.id && (
      <ul aria-label="Earlier runs" className="space-y-0.5 border-t border-tk-line pt-1.5 text-[13px] text-tk-sage">
        {runs.map((r) => (
          <li key={r.id}>
            {fmt(r.startedAt)}
            {r.minutes !== null && ` · ${r.minutes} min`}
            {r.distanceM !== null && ` · ${(r.distanceM / 1000).toFixed(1)} km`}
          </li>
        ))}
      </ul>
    )}
      </div>
    </div>
  </li>
  );

  return (
    <section className={`${PANEL} space-y-3`}>
      <Accessory name="boot" className="absolute -right-1 top-1 w-[68px] -rotate-6" />
      {segment ? null : (
      <div className="pr-16">
        <h2 className={PANEL_TITLE}>My walks{loading ? "" : ` (${items.length})`}</h2>
      </div>
      )}
      <div role="group" aria-label="Filter walks" className={segment !== undefined ? "hidden" : "flex gap-2 text-[13px]"}>
        {(["all", "drafts"] as const).map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={`min-h-11 cursor-pointer rounded-full px-4 font-medium shadow-tk-soft ${filter === f ? "bg-terra/10 text-terra" : "bg-tk-well text-tk-sage"}`}>
            {f === "all" ? "All" : "Drafts"}
          </button>
        ))}
      </div>
      {(
        <>
          {loading && <p className="text-[13px] text-tk-sage">Loading…</p>}
          {making && <p role="status" className="text-[13px] text-tk-sage">Making that version…</p>}
          {notice && <p role="status" className="text-[13px] text-tk-body">{notice}</p>}
          {!loading && failed && <EmptyState image="load-error.png" title="Couldn't load your walks" hint="Check your connection and reopen this tab." />}
          {!loading && !failed && shown.length === 0 && (
            <>
              <EmptyState
                image="empty-walks.png"
                title={lang === "he" ? (segment === "saved" ? "עוד אין הליכות שמורות" : "עוד אין הליכות") : filter === "drafts" ? "No drafts" : segment === "saved" ? "No saved walks yet" : "No walks yet"}
                hint={segment ? undefined : "Build one and it shows up here."}
              />
              {segment && onNewRoute ? (
                <div className="flex justify-center pb-2">
                  <button type="button" onClick={onNewRoute} className="min-h-12 rounded-full bg-terra px-6 text-[15px] font-semibold text-on-accent shadow-tk-soft">
                    {lang === "he" ? "מסלול חדש" : "New route"}
                  </button>
                </div>
              ) : null}
            </>
          )}
          <ul aria-label="My walks" className="space-y-2.5">
            {shown.map((item) => (
              <Fragment key={item.walk.id}>
                {card(item)}
                {variantsOf(item.walk.id).length > 0 && expanded.has(item.walk.id) ? (
                  <li className="ml-4 list-none">
                    <ul aria-label={`Versions of ${item.walk.title}`} className="space-y-2.5">
                      {variantsOf(item.walk.id).map((v) => card(v))}
                    </ul>
                  </li>
                ) : null}
              </Fragment>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
