"use client";

import { useEffect, useState } from "react";

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
}

/** Lets the walker set where the walk starts: GPS, or a searched city/address. */
export function StartLocationPicker({ onPick }: StartLocationPickerProps) {
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
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}&limit=5`, { signal: controller.signal });
        if (!res.ok) throw new Error("search failed");
        const hits = (await res.json()) as NominatimHit[];
        setStatus(null);
        setResults(
          hits
            .map((h) => ({ id: h.place_id, name: h.display_name, coordinates: { lat: Number(h.lat), lng: Number(h.lon) } }))
            .filter((h) => Number.isFinite(h.coordinates.lat) && Number.isFinite(h.coordinates.lng)),
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("Search is unavailable right now.");
      }
    }, 500);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query]);

  function locateMe() {
    if (!navigator.geolocation) {
      setStatus("Your browser can't share a location.");
      return;
    }
    setStatus("Finding you…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStatus(null);
        setLabel("My location");
        onPick({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => setStatus("Couldn't get your location. Allow it in the browser, or search for a place."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="relative mt-[10px] px-[17px]">
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
          onClick={locateMe}
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
