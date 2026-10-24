"use client";

import { useCallback, useEffect, useState } from "react";

import { Accessory } from "@/components/ui/Accessory";
import { EmptyState } from "@/components/ui/EmptyState";
import { BTN_SOFT, LINK, PANEL, PANEL_SUB, PANEL_TITLE, ROW } from "@/components/ui/panel-style";
import { PlaceSearch } from "@/components/waypoints";
import {
  clearVisitedPlaces,
  deletePlace,
  fetchPlaces,
  osmRef,
  savePlaces,
  saveStopsAsPlaces,
  type SavedPlace,
} from "@/lib/places/saved-places";
import { listMyWalks } from "@/lib/walks/saved-walks";
import { withWalkClient } from "@/lib/walks/walk-history";

interface SavedPlacesTabProps {
  isSignedIn: boolean;
}

export function SavedPlacesTab({ isSignedIn }: SavedPlacesTabProps) {
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [showVisited, setShowVisited] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const list = await fetchPlaces();
    setFailed(!list);
    setPlaces(list ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isSignedIn) void load();
  }, [isSignedIn, load]);

  if (!isSignedIn) return null;

  const visitedCount = places.filter((p) => p.visitedAt).length;
  const shown = showVisited ? places : places.filter((p) => !p.visitedAt);

  const addFromWalks = async () => {
    const walks = (await withWalkClient((c, uid) => listMyWalks(c, uid))) ?? [];
    const result = await saveStopsAsPlaces(walks.flatMap((w) => w.stops));
    setNote(result === null ? "Couldn't add places from your walks." : "Added places from your walks.");
    await load();
  };

  const remove = async (p: SavedPlace) => {
    if (await deletePlace(p.id)) setPlaces((cur) => cur.filter((x) => x.id !== p.id));
  };

  const clearVisited = async () => {
    setConfirmClear(false);
    if (await clearVisitedPlaces()) setPlaces((cur) => cur.filter((p) => !p.visitedAt));
    else setNote("Couldn't clear visited places.");
  };

  return (
    <section className={`${PANEL} space-y-3`}>
      <Accessory name="binoculars" className="absolute -right-1 top-1 w-[68px] rotate-6" />
      <div className="pr-16">
        <h2 className={PANEL_TITLE}>Saved places{loading ? "" : ` (${places.length})`}</h2>
        <p className={PANEL_SUB}>Spots you want to see, and the ones you already have.</p>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium text-tk-sage">Add a place by search</p>
        <PlaceSearch
          onSelectPlace={async (place) => {
            const n = await savePlaces([
              { source: "osm", placeRef: osmRef(place.coordinates), label: place.name, coordinates: place.coordinates },
            ]);
            setNote(n === null ? "Couldn't save that place." : `Saved ${place.name}.`);
            await load();
          }}
        />
      </div>

      <button type="button" onClick={() => void addFromWalks()} className={LINK}>
        + Add places from my walks
      </button>
      {note && (
        <p role="status" className="text-xs text-tk-check">
          {note}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 text-xs">
        <label className="flex cursor-pointer items-center gap-1.5 text-tk-sage">
          <input type="checkbox" className="accent-tk-ink" checked={showVisited} onChange={(e) => setShowVisited(e.target.checked)} />
          Show visited
        </label>
        {visitedCount > 0 &&
          (confirmClear ? (
            <span className="flex gap-2">
              <button type="button" onClick={() => void clearVisited()} className="cursor-pointer font-medium text-tk-check">
                Remove {visitedCount} visited?
              </button>
              <button type="button" onClick={() => setConfirmClear(false)} className="cursor-pointer text-tk-sage">
                Cancel
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmClear(true)} className={BTN_SOFT}>
              Clear visited ({visitedCount})
            </button>
          ))}
      </div>

      {loading && <p className="text-xs text-tk-sage">Loading…</p>}
      {!loading && failed && <EmptyState image="load-error.png" title="Couldn't load your places" hint="Check your connection and reopen this tab." />}
      {!loading && !failed && shown.length === 0 && (
        <EmptyState image="empty-places.png" title="No saved places yet" hint="Search for one, or add the places from your walks." />
      )}
      <ul aria-label="Saved places" className="space-y-2">
        {shown.map((p) => (
          <li key={p.id} className={`${ROW} flex items-center gap-2.5 !p-2.5`}>
            <Accessory name={p.visitedAt ? "bench" : "signpost"} className="w-7 shrink-0" />
            <span className={`min-w-0 flex-1 ${p.visitedAt ? "text-tk-sage" : "font-medium text-tk-ink"}`}>
              {p.label}
              {p.visitedAt && <span className="ml-2 rounded-full bg-tk-ink/10 px-2 py-0.5 text-[11px] text-tk-ink">visited</span>}
            </span>
            <button type="button" onClick={() => void remove(p)} className="shrink-0 cursor-pointer text-xs text-tk-sage hover:text-tk-check">
              Remove
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
