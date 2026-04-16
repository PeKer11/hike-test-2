"use client";

import { useState } from "react";

import { Button, Card, LoadingSpinner, Toggle } from "@/components/ui";
import type { Coordinates } from "@/lib/types";

interface HikeSearchPanelProps {
  isSearching: boolean;
  originLatValue: string;
  originLngValue: string;
  onOriginInputChange: (next: { lat: string; lng: string }) => void;
  useMapClickForOrigin: boolean;
  onUseMapClickForOriginChange: (next: boolean) => void;
  onFindHike: (input: {
    origin: Coordinates;
    endpoint?: Coordinates;
    maxDistanceKm?: number;
    maxStartDistanceKm?: number;
    maxFinishDistanceFromOriginKm?: number;
    desiredRouteCount?: number;
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

export function HikeSearchPanel({
  isSearching,
  originLatValue,
  originLngValue,
  onOriginInputChange,
  useMapClickForOrigin,
  onUseMapClickForOriginChange,
  onFindHike,
}: HikeSearchPanelProps) {
  const [endpointLat, setEndpointLat] = useState("");
  const [endpointLng, setEndpointLng] = useState("");
  const [maxDistanceKm, setMaxDistanceKm] = useState("");
  const [maxStartDistanceKm, setMaxStartDistanceKm] = useState("");
  const [maxFinishDistanceFromOriginKm, setMaxFinishDistanceFromOriginKm] =
    useState("");
  const [desiredRouteCount, setDesiredRouteCount] = useState("1");
  const [originLatError, setOriginLatError] = useState<string | null>(null);
  const [originLngError, setOriginLngError] = useState<string | null>(null);
  const [endpointLatError, setEndpointLatError] = useState<string | null>(null);
  const [endpointLngError, setEndpointLngError] = useState<string | null>(null);
  const [maxDistanceError, setMaxDistanceError] = useState<string | null>(null);
  const [maxStartDistanceError, setMaxStartDistanceError] = useState<string | null>(
    null,
  );
  const [maxFinishDistanceFromOriginError, setMaxFinishDistanceFromOriginError] =
    useState<string | null>(null);
  const [desiredRouteCountError, setDesiredRouteCountError] = useState<string | null>(
    null,
  );
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  const detectMyLocation = () => {
    setLocationError(null);

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationError("Location is not supported on this device/browser.");
      return;
    }

    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onOriginInputChange({
          lat: position.coords.latitude.toFixed(6),
          lng: position.coords.longitude.toFixed(6),
        });
        setIsDetectingLocation(false);
      },
      (error) => {
        const message =
          error.code === error.PERMISSION_DENIED
            ? "Location permission was denied. Enable location access and try again."
            : "Could not detect your location. Please try again or enter coordinates manually.";
        setLocationError(message);
        setIsDetectingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    );
  };

  const submit = () => {
    setOriginLatError(null);
    setOriginLngError(null);
    setEndpointLatError(null);
    setEndpointLngError(null);
    setMaxDistanceError(null);
    setMaxStartDistanceError(null);
    setMaxFinishDistanceFromOriginError(null);
    setDesiredRouteCountError(null);
    setSummaryError(null);

    const parsedOriginLat = parseCoordinate(originLatValue);
    const parsedOriginLng = parseCoordinate(originLngValue);

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

    const parsedMaxStartDistance = parseCoordinate(maxStartDistanceKm);
    if (maxStartDistanceKm.trim() !== "" && parsedMaxStartDistance === null) {
      setMaxStartDistanceError("Max start distance must be a valid number.");
      hasError = true;
    } else if (parsedMaxStartDistance !== null && parsedMaxStartDistance <= 0) {
      setMaxStartDistanceError("Max start distance must be greater than 0.");
      hasError = true;
    }

    const parsedMaxFinishDistanceFromOrigin = parseCoordinate(
      maxFinishDistanceFromOriginKm,
    );
    if (
      maxFinishDistanceFromOriginKm.trim() !== "" &&
      parsedMaxFinishDistanceFromOrigin === null
    ) {
      setMaxFinishDistanceFromOriginError(
        "Max finish distance must be a valid number.",
      );
      hasError = true;
    } else if (
      parsedMaxFinishDistanceFromOrigin !== null &&
      parsedMaxFinishDistanceFromOrigin <= 0
    ) {
      setMaxFinishDistanceFromOriginError(
        "Max finish distance must be greater than 0.",
      );
      hasError = true;
    }

    const normalizedRouteCount = desiredRouteCount.trim();
    const parsedDesiredRouteCount = Number(normalizedRouteCount);
    if (normalizedRouteCount === "" || !Number.isInteger(parsedDesiredRouteCount)) {
      setDesiredRouteCountError("Nearby route count must be a whole number.");
      hasError = true;
    } else if (parsedDesiredRouteCount <= 0) {
      setDesiredRouteCountError("Nearby route count must be at least 1.");
      hasError = true;
    } else if (parsedDesiredRouteCount > 5) {
      setDesiredRouteCountError("Nearby route count must be 5 or less.");
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
      maxStartDistanceKm: parsedMaxStartDistance ?? undefined,
      maxFinishDistanceFromOriginKm:
        parsedMaxFinishDistanceFromOrigin ?? undefined,
      desiredRouteCount: Number(desiredRouteCount),
    });
  };

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Find me a hike</h2>
        <p className="text-xs text-slate-500">
          RTG-first trail search with automatic fallback routing.
        </p>
        <div className="mt-2">
          <Toggle
            checked={useMapClickForOrigin}
            onChange={onUseMapClickForOriginChange}
            label="Map click sets origin"
          />
          <p className="mt-1 text-[11px] text-slate-500">
            {useMapClickForOrigin
              ? "Click on the map to update origin coordinates."
              : "Enable this to pick origin by clicking on the map."}
          </p>
        </div>
        <div className="mt-2">
          <Button
            variant="secondary"
            onClick={detectMyLocation}
            disabled={isSearching || isDetectingLocation}
            fullWidth
          >
            {isDetectingLocation ? "Detecting location..." : "Use my current location"}
          </Button>
          {locationError && <p className="mt-1 text-xs text-rose-700">{locationError}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          value={originLatValue}
          onChange={(event) => {
            onOriginInputChange({
              lat: event.target.value,
              lng: originLngValue,
            });
          }}
          placeholder="Origin lat"
          className="rounded-md border border-slate-300 px-2 py-2 text-sm focus:border-emerald-500 focus:outline-none"
        />
        {originLatError && <p className="text-xs text-rose-700">{originLatError}</p>}
        <input
          type="text"
          value={originLngValue}
          onChange={(event) => {
            onOriginInputChange({
              lat: originLatValue,
              lng: event.target.value,
            });
          }}
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

      <input
        type="text"
        value={maxStartDistanceKm}
        onChange={(event) => setMaxStartDistanceKm(event.target.value)}
        placeholder="Max start distance km (optional)"
        className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm focus:border-emerald-500 focus:outline-none"
      />
      {maxStartDistanceError && (
        <p className="text-xs text-rose-700">{maxStartDistanceError}</p>
      )}

      <input
        type="text"
        value={maxFinishDistanceFromOriginKm}
        onChange={(event) => setMaxFinishDistanceFromOriginKm(event.target.value)}
        placeholder="Max finish distance from origin km (optional)"
        className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm focus:border-emerald-500 focus:outline-none"
      />
      {maxFinishDistanceFromOriginError && (
        <p className="text-xs text-rose-700">{maxFinishDistanceFromOriginError}</p>
      )}

      <input
        type="text"
        value={desiredRouteCount}
        onChange={(event) => setDesiredRouteCount(event.target.value)}
        placeholder="Nearby route count (default 1)"
        className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm focus:border-emerald-500 focus:outline-none"
      />
      {desiredRouteCountError && (
        <p className="text-xs text-rose-700">{desiredRouteCountError}</p>
      )}

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
