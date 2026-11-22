"use client";

import { useEffect, useRef, useState } from "react";

import { LocationDeniedCard } from "@/components/assistant/LocationDeniedCard";
import { GOOD_ACCURACY_M, geolocationSupported, locate, queryLocationPermission } from "@/lib/geo/locate";
import { currentLocateLang, locateCopy, type LocateLang } from "@/lib/geo/locate-copy";
import { loadSavedStart, saveStart } from "@/lib/start-location";
import type { Coordinates } from "@/lib/types";
import { haversineDistance } from "@/lib/utils/geo";

interface StartOption {
  id: number;
  name: string;
  coordinates: Coordinates;
}

interface NominatimHit {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface StartLocationPickerProps {
  /** The walk's start point has been chosen (GPS or searched). */
  onPick: (coordinates: Coordinates) => void;
  /** The start already in use; when set, nothing is looked up on mount. */
  origin?: Coordinates | null;
  /** Only a rough (IP-city) position is known: centre the map there, but it is not a start. */
  onApproximate?: (coordinates: Coordinates) => void;
  /** The planner's language; without it, the page language. */
  lang?: LocateLang;
}

const COPY = {
  en: { placeholder: "Start from: city or address", unavailable: "Search is unavailable right now.", startingFrom: "Starting from:" },
  he: { placeholder: "להתחיל מ: עיר או כתובת", unavailable: "החיפוש לא זמין כרגע.", startingFrom: "מתחילים מ:" },
} as const;

/** Lets the walker set where the walk starts: GPS, or a searched city/address. */
export function StartLocationPicker({ onPick, origin, onApproximate, lang }: StartLocationPickerProps) {
  const words = COPY[lang ?? "en"];
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StartOption[]>([]);
  const [label, setLabel] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const locatorRef = useRef<{ stop(): void } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/geocode?q=${encodeURIComponent(query)}&limit=5`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error("search failed");
        const hits = (await res.json()) as NominatimHit[];
        setStatus(null);
        setResults(
          hits
            .map((h) => ({
              id: h.place_id,
              name: h.display_name,
              coordinates: { lat: Number(h.lat), lng: Number(h.lon) },
            }))
            .filter(
              (h) =>
                Number.isFinite(h.coordinates.lat) &&
                Number.isFinite(h.coordinates.lng),
            ),
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setStatus(words.unavailable);
      }
    }, 500);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query]);

  function startLocating(silent: boolean) {
    locatorRef.current?.stop();
    const t = locateCopy[lang ?? currentLocateLang()];
    if (!geolocationSupported()) {
      if (!silent) setStatus(t.notSupported);
      return;
    }
    setDenied(false);
    if (!silent) setStatus(t.searching);
    let picked: { coordinates: Coordinates; accuracyMeters: number } | null = null;
    locatorRef.current = locate({
      purpose: "start",
      onUpdate: (fix) => {
        if (fix.source === "ip") {
          // Only a rough idea: centre the map on the city, never make it the walk's start.
          setStatus(fix.city ? t.roughly(fix.city) : t.roughlyNoCity);
          onApproximate?.(fix.coordinates);
          return;
        }
        const prev = picked;
        const settled = fix.accuracyMeters <= GOOD_ACCURACY_M;
        const worthPicking =
          !prev ||
          (settled && (prev.accuracyMeters > GOOD_ACCURACY_M || haversineDistance(prev.coordinates, fix.coordinates) > 30));
        if (!worthPicking) return;
        picked = { coordinates: fix.coordinates, accuracyMeters: fix.accuracyMeters };
        setStatus(settled ? null : t.approx);
        setLabel(settled ? t.myLocation : `${t.myLocation} · ${t.approx}`);
        saveStart(fix.coordinates, "My last location");
        onPick(fix.coordinates);
      },
      onState: (state) => {
        if (state === "denied") {
          setStatus(null);
          setDenied(true);
        } else if (state === "timeout") {
          if (!silent) setStatus(t.timeout);
        } else if (state === "unavailable") {
          if (!silent) setStatus(t.unavailable);
        } else {
          setDenied(false);
        }
      },
    });
  }

  // The browser remembers the choice per site, so once allowed we find the walker without asking again.
  useEffect(() => {
    if (origin) return;
    const saved = loadSavedStart();
    if (saved) {
      setLabel(saved.label);
      onPick(saved.coordinates);
      return;
    }
    let cancelled = false;
    void queryLocationPermission().then((state) => {
      if (!cancelled && state === "granted") startLocating(true);
    });
    return () => {
      cancelled = true;
      locatorRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on mount
  }, []);

  return (
    <div className="relative z-30 mt-[8px] px-[17px]">
      <div className="flex items-center gap-[7px]">
        <input
          ref={inputRef}
          type="text"
          dir="auto"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={words.placeholder}
          className="block min-h-11 min-w-0 flex-1 rounded-[10px] border-[1.5px] border-[var(--tk-ctl)] bg-cream px-3 py-2 text-[16px] text-tk-ink placeholder:text-charcoal/50 focus:outline-2 focus:outline-offset-1 focus:outline-forest"
        />
        <button
          type="button"
          onClick={() => startLocating(false)}
          className="tk-champagne inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap px-4 font-app-sans text-[15px]"
        >
          <span aria-hidden className="tk-champagne-ring" />
          {locateCopy[lang ?? "en"].myLocation}
        </button>
      </div>
      {denied ? <LocationDeniedCard onSearch={() => inputRef.current?.focus()} /> : null}
      {results.length > 0 && (
        <ul className="absolute inset-x-[17px] top-full z-20 mt-[2px] max-h-44 overflow-auto rounded-[10px] border-[1.5px] border-[var(--tk-ctl)] bg-cream shadow-tk-soft">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                dir="auto"
                onClick={() => {
                  setLabel(r.name);
                  setQuery("");
                  setResults([]);
                  saveStart(r.coordinates, r.name);
                  onPick(r.coordinates);
                }}
                className="block min-h-11 w-full px-3 py-2 text-start text-[15px] text-tk-ink hover:bg-tk-bar"
              >
                {r.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {status ? (
        <p dir="auto" className="mt-[4px] text-start text-[13px] text-charcoal/70">{status}</p>
      ) : label ? (
        <p dir="auto" className="mt-[4px] truncate text-[13px] text-tk-sage">
          {words.startingFrom} {label}
        </p>
      ) : null}
    </div>
  );
}
