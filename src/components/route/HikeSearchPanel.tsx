"use client";

import { useState } from "react";

import { Button, Card, LoadingSpinner } from "@/components/ui";
import type { Coordinates } from "@/lib/types";

interface HikeSearchPanelProps {
  isSearching: boolean;
  onFindHike: (input: {
    origin: Coordinates;
    endpoint?: Coordinates;
    maxDistanceKm?: number;
  }) => void;
}

function parseCoordinate(value: string): number | null {
  const normalized = value.trim();
  if (normalized === "") {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function isValidLatitude(value: number): boolean {
  return value >= -90 && value <= 90;
}

function isValidLongitude(value: number): boolean {
  return value >= -180 && value <= 180;
}

export function HikeSearchPanel({ isSearching, onFindHike }: HikeSearchPanelProps) {
  const [originLat, setOriginLat] = useState("31.7683");
  const [originLng, setOriginLng] = useState("35.2137");
  const [endpointLat, setEndpointLat] = useState("");
  const [endpointLng, setEndpointLng] = useState("");
  const [maxDistanceKm, setMaxDistanceKm] = useState("");
  const [originLatError, setOriginLatError] = useState<string | null>(null);
  const [originLngError, setOriginLngError] = useState<string | null>(null);
  const [endpointLatError, setEndpointLatError] = useState<string | null>(null);
  const [endpointLngError, setEndpointLngError] = useState<string | null>(null);
  const [maxDistanceError, setMaxDistanceError] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const submit = () => {
    setOriginLatError(null);
    setOriginLngError(null);
    setEndpointLatError(null);
    setEndpointLngError(null);
    setMaxDistanceError(null);
    setSummaryError(null);

    const parsedOriginLat = parseCoordinate(originLat);
    const parsedOriginLng = parseCoordinate(originLng);

    let hasError = false;

    if (parsedOriginLat === null) {
      setOriginLatError("Origin latitude is required.");
      hasError = true;
    } else if (!isValidLatitude(parsedOriginLat)) {
      setOriginLatError("Latitude must be between -90 and 90.");
      hasError = true;
    }

    if (parsedOriginLng === null) {
      setOriginLngError("Origin longitude is required.");
      hasError = true;
    } else if (!isValidLongitude(parsedOriginLng)) {
      setOriginLngError("Longitude must be between -180 and 180.");
      hasError = true;
    }

    const hasEndpoint = endpointLat.trim() !== "" || endpointLng.trim() !== "";
    const parsedEndpointLat = parseCoordinate(endpointLat);
    const parsedEndpointLng = parseCoordinate(endpointLng);

    if (hasEndpoint && parsedEndpointLat === null) {
      setEndpointLatError("Endpoint latitude is required.");
      hasError = true;
    } else if (hasEndpoint && parsedEndpointLat !== null && !isValidLatitude(parsedEndpointLat)) {
      setEndpointLatError("Latitude must be between -90 and 90.");
      hasError = true;
    }

    if (hasEndpoint && parsedEndpointLng === null) {
      setEndpointLngError("Endpoint longitude is required.");
      hasError = true;
    } else if (hasEndpoint && parsedEndpointLng !== null && !isValidLongitude(parsedEndpointLng)) {
      setEndpointLngError("Longitude must be between -180 and 180.");
      hasError = true;
    }

    const parsedMaxDistance = parseCoordinate(maxDistanceKm);
    if (maxDistanceKm.trim() !== "" && parsedMaxDistance === null) {
      setMaxDistanceError("Max distance must be a valid number.");
      hasError = true;
    } else if (parsedMaxDistance !== null && parsedMaxDistance <= 0) {
      setMaxDistanceError("Max distance must be greater than 0.");
      hasError = true;
    }

    if (hasError) {
      setSummaryError("Please fix highlighted fields.");
      return;
    }

    onFindHike({
      origin: { lat: parsedOriginLat as number, lng: parsedOriginLng as number },
      endpoint:
        hasEndpoint && parsedEndpointLat !== null && parsedEndpointLng !== null
          ? { lat: parsedEndpointLat, lng: parsedEndpointLng }
          : undefined,
      maxDistanceKm: parsedMaxDistance ?? undefined,
    });
  };

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Find me a hike</h2>
        <p className="text-xs text-slate-500">
          RTG-first trail search with automatic fallback routing.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          value={originLat}
          onChange={(event) => setOriginLat(event.target.value)}
          placeholder="Origin lat"
          className="rounded-md border border-slate-300 px-2 py-2 text-sm focus:border-emerald-500 focus:outline-none"
        />
        {originLatError && <p className="text-xs text-rose-700">{originLatError}</p>}
        <input
          type="text"
          value={originLng}
          onChange={(event) => setOriginLng(event.target.value)}
          placeholder="Origin lng"
          className="rounded-md border border-slate-300 px-2 py-2 text-sm focus:border-emerald-500 focus:outline-none"
        />
        {originLngError && <p className="text-xs text-rose-700">{originLngError}</p>}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          value={endpointLat}
          onChange={(event) => setEndpointLat(event.target.value)}
          placeholder="Endpoint lat (optional)"
          className="rounded-md border border-slate-300 px-2 py-2 text-sm focus:border-emerald-500 focus:outline-none"
        />
        {endpointLatError && <p className="text-xs text-rose-700">{endpointLatError}</p>}
        <input
          type="text"
          value={endpointLng}
          onChange={(event) => setEndpointLng(event.target.value)}
          placeholder="Endpoint lng (optional)"
          className="rounded-md border border-slate-300 px-2 py-2 text-sm focus:border-emerald-500 focus:outline-none"
        />
        {endpointLngError && <p className="text-xs text-rose-700">{endpointLngError}</p>}
      </div>

      <input
        type="text"
        value={maxDistanceKm}
        onChange={(event) => setMaxDistanceKm(event.target.value)}
        placeholder="Max distance km (optional)"
        className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm focus:border-emerald-500 focus:outline-none"
      />
      {maxDistanceError && <p className="text-xs text-rose-700">{maxDistanceError}</p>}

      {summaryError && (
        <p className="rounded-md bg-rose-50 p-2 text-xs text-rose-700">{summaryError}</p>
      )}

      <Button onClick={submit} disabled={isSearching} fullWidth>
        {isSearching ? (
          <span className="inline-flex items-center gap-2">
            <LoadingSpinner size="sm" />
            Searching...
          </span>
        ) : (
          "Find Best Hike"
        )}
      </Button>
    </Card>
  );
}
