"use client";

import { useEffect, useState } from "react";

import { Button, Card, LoadingSpinner } from "@/components/ui";
import { WalkSettingsPanel } from "@/components/WalkSettingsPanel";
import type { AttractionCategory, Coordinates } from "@/lib/types";
import type { WalkSettings } from "@/lib/types/walk-settings";

export interface WalkCompanionInput {
  origin: Coordinates;
  availableMinutes: number;
  walkingPaceMinPerKm: number;
  radiusMeters: number;
  preferredCategories?: AttractionCategory[];
}

interface WalkCompanionPanelProps {
  isLoading: boolean;
  onBuildWalk: (input: WalkCompanionInput) => void;
  walkSettings: WalkSettings;
  onWalkSettingsChange: (s: Partial<WalkSettings>) => void;
  mapClickedCoords?: Coordinates | null;
  /**
   * A walk length read out of the free-text box ("I have three hours"). Fills
   * the time field as a starting value each time a new one is detected — the
   * walker can still type over it, and it is never re-applied on its own.
   */
  suggestedMinutes?: number | null;
  onLocationDetected?: (coords: Coordinates) => void;
  onStartWalk?: () => void;
  onStopWalk?: () => void;
  onRevertPlan?: () => void;
  canRevertPlan?: boolean;
  walkPlanReady?: boolean;
  isWalking?: boolean;
}

const PACE_OPTIONS = [
  { label: "Slow (20 min/km)", value: 20 },
  { label: "Normal (15 min/km)", value: 15 },
  { label: "Brisk (12 min/km)", value: 12 },
];

const CATEGORY_OPTIONS: { label: string; value: AttractionCategory }[] = [
  { label: "Landmarks", value: "landmark" },
  { label: "Museums", value: "museum" },
  { label: "Parks", value: "park" },
  { label: "Food & Cafes", value: "food" },
  { label: "Viewpoints", value: "viewpoint" },
  { label: "Religious sites", value: "religious" },
  { label: "Nature", value: "nature" },
  { label: "Entertainment", value: "entertainment" },
];

export function WalkCompanionPanel({
  isLoading,
  onBuildWalk,
  walkSettings,
  onWalkSettingsChange,
  mapClickedCoords,
  suggestedMinutes,
  onLocationDetected,
  onStartWalk,
  onStopWalk,
  onRevertPlan,
  canRevertPlan = false,
  walkPlanReady = false,
  isWalking = false,
}: WalkCompanionPanelProps) {
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [availableMinutes, setAvailableMinutes] = useState("90");
  const [pace, setPace] = useState(15);
  const [radiusKm, setRadiusKm] = useState("2");
  const [selectedCategories, setSelectedCategories] = useState<AttractionCategory[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapClickedCoords) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLat(mapClickedCoords.lat.toFixed(6));
    setLng(mapClickedCoords.lng.toFixed(6));
  }, [mapClickedCoords]);

  useEffect(() => {
    if (typeof suggestedMinutes !== "number") {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAvailableMinutes(String(suggestedMinutes));
  }, [suggestedMinutes]);

  const detectLocation = () => {
    setLocationError(null);
    if (
      typeof window !== "undefined" &&
      !window.isSecureContext &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1"
    ) {
      setLocationError(
        "Current location on mobile usually requires HTTPS (or localhost in development). Open the app over HTTPS to use GPS.",
      );
      return;
    }

    if (!navigator.geolocation) {
      setLocationError("Geolocation not supported on this device.");
      return;
    }
    setIsDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setLat(coords.lat.toFixed(6));
        setLng(coords.lng.toFixed(6));
        onLocationDetected?.(coords);
        setIsDetecting(false);
      },
      () => {
        setLocationError("Could not detect location. Enter coordinates manually.");
        setIsDetecting(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const toggleCategory = (cat: AttractionCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  const submit = () => {
    setFormError(null);

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    const parsedMinutes = parseInt(availableMinutes, 10);
    const parsedRadiusKm = parseFloat(radiusKm);

    if (!Number.isFinite(parsedLat) || parsedLat < -90 || parsedLat > 90) {
      setFormError("Enter a valid latitude (-90 to 90).");
      return;
    }
    if (!Number.isFinite(parsedLng) || parsedLng < -180 || parsedLng > 180) {
      setFormError("Enter a valid longitude (-180 to 180).");
      return;
    }
    if (!Number.isFinite(parsedMinutes) || parsedMinutes <= 0) {
      setFormError("Enter a valid duration (minutes > 0).");
      return;
    }
    if (!Number.isFinite(parsedRadiusKm) || parsedRadiusKm <= 0) {
      setFormError("Enter a valid search radius (km > 0).");
      return;
    }

    onBuildWalk({
      origin: { lat: parsedLat, lng: parsedLng },
      availableMinutes: parsedMinutes,
      walkingPaceMinPerKm: pace,
      radiusMeters: parsedRadiusKm * 1000,
      preferredCategories:
        selectedCategories.length > 0 ? selectedCategories : undefined,
    });
  };

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="font-display text-base font-bold text-forest">City Walk Companion</h2>
        <p className="text-xs text-charcoal/60">
          Tell us where you are and how long you have — we&apos;ll build a smart walk.
        </p>
      </div>

      {/* Location */}
      <div className="space-y-2">
        <Button
          variant="secondary"
          fullWidth
          onClick={detectLocation}
          disabled={isDetecting || isLoading}
        >
          {isDetecting ? "Detecting…" : "Use my current location"}
        </Button>
        {locationError && (
          <p className="text-xs text-rose-700">{locationError}</p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder="Latitude"
            className="rounded-md border border-charcoal/15 px-2 py-2 text-base sm:text-sm focus:border-terra focus:outline-none"
          />
          <input
            type="text"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            placeholder="Longitude"
            className="rounded-md border border-charcoal/15 px-2 py-2 text-base sm:text-sm focus:border-terra focus:outline-none"
          />
        </div>
      </div>

      {/* Time */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-charcoal/80">
          Time available (minutes)
        </label>
        <input
          type="number"
          min={15}
          max={480}
          value={availableMinutes}
          onChange={(e) => setAvailableMinutes(e.target.value)}
          className="w-full rounded-md border border-charcoal/15 px-2 py-2 text-sm focus:border-terra focus:outline-none"
        />
      </div>

      {/* Search radius */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-charcoal/80">
          Search radius (km)
        </label>
        <input
          type="number"
          min={0.5}
          max={10}
          step={0.5}
          value={radiusKm}
          onChange={(e) => setRadiusKm(e.target.value)}
          className="w-full rounded-md border border-charcoal/15 px-2 py-2 text-sm focus:border-terra focus:outline-none"
        />
      </div>

      {/* Walking pace */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-charcoal/80">Walking pace</label>
        <div className="grid grid-cols-3 gap-1">
          {PACE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPace(opt.value)}
              className={`rounded-md border px-2 py-3 text-xs font-medium transition sm:py-1.5 ${
                pace === opt.value
                  ? "border-terra bg-terra/10 text-terra"
                  : "border-charcoal/15 bg-white text-charcoal/70 hover:bg-cream/70"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Categories */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-charcoal/80">
          Interests{" "}
          <span className="font-normal text-charcoal/40">(optional)</span>
        </label>
        <div className="flex flex-wrap gap-1">
          {CATEGORY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => toggleCategory(opt.value)}
              className={`rounded-full border px-3 py-2 text-xs transition sm:px-2 sm:py-1 ${
                selectedCategories.includes(opt.value)
                  ? "border-terra bg-terra/10 text-terra"
                  : "border-charcoal/15 bg-white text-charcoal/70 hover:bg-cream/70"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Walk settings */}
      <WalkSettingsPanel settings={walkSettings} onChange={onWalkSettingsChange} />

      {formError && (
        <p className="rounded-md bg-rose-50 p-2 text-xs text-rose-700">
          {formError}
        </p>
      )}

      <Button onClick={submit} disabled={isLoading} fullWidth>
        {isLoading ? (
          <span className="inline-flex items-center gap-2">
            <LoadingSpinner size="sm" />
            Building walk…
          </span>
        ) : (
          "Build My Walk"
        )}
      </Button>
      {canRevertPlan && (
        <Button
          onClick={() => onRevertPlan?.()}
          variant="secondary"
          fullWidth
        >
          ↩ Back to previous route
        </Button>
      )}
      {isWalking ? (
        <Button
          onClick={() => onStopWalk?.()}
          variant="danger"
          fullWidth
        >
          End Walk
        </Button>
      ) : walkPlanReady ? (
        <Button
          onClick={() => onStartWalk?.()}
          disabled={isLoading}
          fullWidth
        >
          Start Walk
        </Button>
      ) : null}
    </Card>
  );
}
