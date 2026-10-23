"use client";

import { useEffect, useState } from "react";

import { loadSavedStart, saveStart } from "@/lib/start-location";
import type { Coordinates } from "@/lib/types";

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
}

/** Lets the walker set where the walk starts: GPS, or a searched city/address. */
export function StartLocationPicker({ onPick, origin }: StartLocationPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StartOption[]>([]);
  const [label, setLabel] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

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

  function locate(silent: boolean) {
    if (!navigator.geolocation) {
      if (!silent) setStatus("Your browser can't share a location.");
      return;
    }
    if (!silent) setStatus("Finding you…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStatus(null);
        setLabel("My location");
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        saveStart(here, "My last location");
        onPick(here);
      },
      (err) => {
        if (silent) return;
        setStatus(
          err.code === err.PERMISSION_DENIED
            ? "Location is blocked for this site. Click the icon left of the address bar to allow it, or search for a place."
            : err.code === err.TIMEOUT
              ? "Finding you took too long. Try again, or search for a place."
              : "Your device couldn't find its location (check Location Services in System Settings), or search for a place.",
        );
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: silent ? 5 * 60 * 1000 : 0 },
    );
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
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((p) => {
        if (!cancelled && p.state === "granted") locate(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on mount
  }, []);

  return (
    <div className="relative mt-[8px] px-[17px]">
      <div className="flex items-center gap-[7px]">
        <input
          type="text"
          dir="auto"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Start from: city or address"
          className="block min-w-0 flex-1 rounded-[6px] border border-tk-field bg-white px-[10px] py-[4px] text-[12.5px] text-tk-body placeholder:text-[#8a8580] focus:border-tk-send focus:outline-none"
        />
        <button
          type="button"
          onClick={() => locate(false)}
          className="shrink-0 whitespace-nowrap rounded-full border border-tk-send/60 bg-transparent px-[10px] py-[4px] font-brand text-[12px] font-semibold text-tk-wordmark transition-colors hover:bg-white"
        >
          📍 My location
        </button>
      </div>
      {results.length > 0 && (
        <ul className="absolute inset-x-[17px] top-full z-20 mt-[2px] max-h-44 overflow-auto rounded-[6px] border border-tk-field bg-white shadow-tk-soft">
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
        <p className="mt-[4px] text-[11.5px] text-charcoal/60">{status}</p>
      ) : label ? (
        <p dir="auto" className="mt-[4px] truncate text-[11.5px] text-tk-sage">
          Starting from: {label}
        </p>
      ) : null}
    </div>
  );
}
