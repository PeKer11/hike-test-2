"use client";

import { useCallback, useEffect, useState } from "react";

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
  const [showVisited, setShowVisited] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setPlaces(await fetchPlaces());
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
    <section className="space-y-3 rounded-[10px] border border-charcoal/10 bg-cream/60 p-3">
      <h2 className="text-sm font-medium text-charcoal/80">Saved places ({loading ? "…" : places.length})</h2>

      <div className="space-y-1">
        <p className="text-xs text-charcoal/60">Add a place by search</p>
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

      <button type="button" onClick={() => void addFromWalks()} className="cursor-pointer text-xs font-medium text-forest hover:underline">
        + Add places from my walks
      </button>
      {note && (
        <p role="status" className="text-xs text-charcoal/70">
          {note}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 text-xs">
        <label className="flex cursor-pointer items-center gap-1 text-charcoal/70">
          <input type="checkbox" checked={showVisited} onChange={(e) => setShowVisited(e.target.checked)} />
          Show visited
        </label>
        {visitedCount > 0 &&
          (confirmClear ? (
            <span className="flex gap-2">
              <button type="button" onClick={() => void clearVisited()} className="cursor-pointer font-medium text-terra">
                Remove {visitedCount} visited?
              </button>
              <button type="button" onClick={() => setConfirmClear(false)} className="cursor-pointer text-charcoal/60">
                Cancel
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmClear(true)} className="cursor-pointer text-charcoal/70 hover:text-terra">
              Clear visited ({visitedCount})
            </button>
          ))}
      </div>

      {loading && <p className="text-xs text-charcoal/60">Loading…</p>}
      {!loading && shown.length === 0 && (
        <p className="text-xs text-charcoal/60">No saved places yet. Search for one, or add the places from your walks.</p>
      )}
      <ul aria-label="Saved places" className="space-y-1">
        {shown.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-2 rounded-md bg-white/70 p-2 text-xs">
            <span className={p.visitedAt ? "text-charcoal/50" : "font-medium text-charcoal"}>
              {p.label}
              {p.visitedAt && <span className="ml-2 rounded-full bg-forest/15 px-2 py-0.5 text-forest">visited</span>}
            </span>
            <button type="button" onClick={() => void remove(p)} className="cursor-pointer text-charcoal/40 hover:text-terra">
              Remove
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
