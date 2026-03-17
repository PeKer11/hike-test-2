"use client";

import { useEffect, useState } from "react";

import { Card, LoadingSpinner } from "@/components/ui";
import type { Coordinates, NominatimPlace } from "@/lib/types";

interface PlaceOption {
  id: number;
  name: string;
  coordinates: Coordinates;
}

interface PlaceSearchProps {
  onSelectPlace: (place: PlaceOption) => void;
}

export function PlaceSearch({ onSelectPlace }: PlaceSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(
          `/api/geocode?q=${encodeURIComponent(query)}&limit=5`,
          {
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(payload.error ?? "Failed to search places.");
        }

        const places = (await response.json()) as NominatimPlace[];
        setResults(
          places.map((place) => ({
            id: place.place_id,
            name: place.display_name,
            coordinates: {
              lat: Number(place.lat),
              lng: Number(place.lon),
            },
          })),
        );
      } catch (searchError) {
        if (searchError instanceof DOMException && searchError.name === "AbortError") {
          return;
        }
        setError(
          searchError instanceof Error
            ? searchError.message
            : "Failed to search places.",
        );
      } finally {
        setIsLoading(false);
      }
    }, 600);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query]);

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Search places</h2>
        <p className="text-xs text-slate-500">Nominatim lookup (debounced)</p>
      </div>

      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by address, mountain, or trailhead"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
      />

      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <LoadingSpinner size="sm" />
          Searching...
        </div>
      )}

      {error && <div className="text-xs text-rose-600">{error}</div>}

      {results.length > 0 && (
        <ul className="max-h-48 space-y-2 overflow-auto">
          {results.map((result) => (
            <li key={result.id}>
              <button
                type="button"
                onClick={() => {
                  onSelectPlace(result);
                  setQuery("");
                  setResults([]);
                }}
                className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-100"
              >
                {result.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
