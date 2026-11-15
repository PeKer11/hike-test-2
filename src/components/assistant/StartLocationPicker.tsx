"use client";

import { useEffect, useRef, useState } from "react";

import { LocationDeniedCard } from "@/components/assistant/LocationDeniedCard";
import { GOOD_ACCURACY_M, geolocationSupported, locate, queryLocationPermission } from "@/lib/geo/locate";
import { currentLocateLang, locateCopy } from "@/lib/geo/locate-copy";
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
}

/** Lets the walker set where the walk starts: GPS, or a searched city/address. */
export function StartLocationPicker({ onPick, origin, onApproximate }: StartLocationPickerProps) {
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
        setStatus("Search is unavailable right now.");
      }
    }, 500);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query]);

  function startLocating(silent: boolean) {
    locatorRef.current?.stop();
    const t = locateCopy[currentLocateLang()];
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
          placeholder="Start from: city or address"
          className="block min-w-0 flex-1 rounded-[6px] border border-tk-field bg-paper px-[10px] py-[4px] text-[12.5px] text-tk-body placeholder:text-[#8a8580] focus:border-tk-send focus:outline-none"
        />
        <button
          type="button"
          onClick={() => startLocating(false)}
          className="shrink-0 whitespace-nowrap rounded-full border border-tk-send/60 bg-transparent px-[10px] py-[4px] font-brand text-[12px] font-semibold text-tk-wordmark transition-colors hover:bg-paper"
        >
          📍 My location
        </button>
      </div>
      {denied ? <LocationDeniedCard onSearch={() => inputRef.current?.focus()} /> : null}
      {results.length > 0 && (
        <ul className="absolute inset-x-[17px] top-full z-20 mt-[2px] max-h-44 overflow-auto rounded-[6px] border border-tk-field bg-paper shadow-tk-soft">
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
                className="block w-full px-[10px] py-[6px] text-start text-[12px] text-tk-body hover:bg-tk-well"
              >
                {r.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {status ? (
        <p dir="auto" className="mt-[4px] text-start text-[11.5px] text-charcoal/60">{status}</p>
      ) : label ? (
        <p dir="auto" className="mt-[4px] truncate text-[11.5px] text-tk-sage">
          Starting from: {label}
        </p>
      ) : null}
    </div>
  );
}
