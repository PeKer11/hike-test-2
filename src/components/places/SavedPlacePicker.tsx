"use client";

import { useState } from "react";

import { BTN_SM } from "@/components/ui/panel-style";
import { fetchPlaces, type SavedPlace } from "@/lib/places/saved-places";
import type { Attraction, AttractionCategory } from "@/lib/types/walk-plan";

interface SavedPlacePickerProps {
  /** Ids already waiting in the walk's wishlist. */
  addedIds: string[];
  /** Ids of the stops in the plan on the map right now; a queued place is only "in walk" once it is one of them. */
  inWalkIds?: string[];
  onAdd: (places: Attraction[]) => void;
  lang?: "en" | "he";
}

const COPY = {
  en: { from: "From saved places", loading: "Loading…", none: "No unvisited saved places. Add some in the Places tab.", list: "Saved places to add", inWalk: "in walk", queued: "queued for the next build", add: (n: number) => `Add ${n} to walk`, lookup: "Couldn't look up the Google places. Try again." },
  he: { from: "ממקומות שמורים", loading: "טוען…", none: "אין מקומות שמורים שטרם ביקרתם בהם. אפשר להוסיף בלשונית מקומות.", list: "מקומות שמורים להוספה", inWalk: "במסלול", queued: "ממתין לבנייה הבאה", add: (n: number) => `הוספת ${n} למסלול`, lookup: "לא הצלחתי לאתר את המקומות מגוגל. נסו שוב." },
} as const;

const asAttraction = (id: string, name: string, category: string, coordinates: { lat: number; lng: number }): Attraction => ({
  id,
  name,
  coordinates,
  category: category as AttractionCategory,
  avgVisitMinutes: 15,
  tags: {},
});

/** "+ From saved places": pick unvisited saved places to put into the walk. */
export function SavedPlacePicker({ addedIds, inWalkIds = [], onAdd, lang = "en" }: SavedPlacePickerProps) {
  const t = COPY[lang];
  const [open, setOpen] = useState(false);
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const toggleOpen = async () => {
    const next = !open;
    setOpen(next);
    if (!next) return;
    setLoading(true);
    setPlaces(((await fetchPlaces()) ?? []).filter((p) => !p.visitedAt));
    setLoading(false);
  };

  const toggle = (id: string) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const add = async () => {
    setError(null);
    const chosen = places.filter((p) => picked.has(p.id));
    const out: Attraction[] = chosen
      .filter((p) => p.source === "osm" && p.coordinates)
      .map((p) => asAttraction(`saved-${p.id}`, p.label, p.category, p.coordinates!));
    const googleIds = chosen.filter((p) => p.source === "google").map((p) => p.placeRef);
    if (googleIds.length > 0) {
      const res = await fetch("/api/places/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: googleIds }),
      }).catch(() => null);
      if (!res?.ok) {
        setError(t.lookup);
        return;
      }
      const data = (await res.json()) as { places: { placeId: string; name: string; coordinates: { lat: number; lng: number }; category: string }[] };
      out.push(...data.places.map((p) => asAttraction(`google-${p.placeId}`, p.name, p.category, p.coordinates)));
    }
    if (out.length > 0) onAdd(out);
    setPicked(new Set());
    setOpen(false);
  };

  return (
    <section className="-mx-4 bg-cream font-app-sans">
      <button type="button" aria-expanded={open} onClick={() => void toggleOpen()} className="flex min-h-11 w-full cursor-pointer items-center border-y border-tk-hair bg-tk-bar px-4 text-start text-[15px] font-semibold text-tk-ink">
        {open ? "−" : "+"} {t.from}
      </button>
      {open && (
        <div className="space-y-2 px-4 py-3">
          {loading && <p className="text-[13px] text-charcoal/70">{t.loading}</p>}
          {!loading && places.length === 0 && <p className="text-[13px] text-charcoal/70">{t.none}</p>}
          <ul aria-label={t.list} className="space-y-1">
            {places.map((p) => (
              <li key={p.id} className="border-b border-tk-hair py-2 text-[15px] last:border-b-0">
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={picked.has(p.id)} onChange={() => toggle(p.id)} />
                  <span className="text-charcoal">{p.label}</span>
                  {(() => {
                    const id = p.source === "google" ? `google-${p.placeRef}` : `saved-${p.id}`;
                    if (inWalkIds.includes(id)) return <span className="text-forest">{t.inWalk}</span>;
                    return addedIds.includes(id) ? <span className="text-charcoal/60">{t.queued}</span> : null;
                  })()}
                </label>
              </li>
            ))}
          </ul>
          {error && <p role="alert" className="text-[13px] text-terra">{error}</p>}
          {picked.size > 0 && (
            <button type="button" onClick={() => void add()} className={BTN_SM}>
              {t.add(picked.size)}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
