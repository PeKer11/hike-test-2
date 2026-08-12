"use client";

import { useEffect, useRef, useState } from "react";

import { Button, Card, LoadingSpinner } from "@/components/ui";
import { StandingFactsPanel } from "@/components/StandingFactsPanel";
import { WalkSettingsPanel } from "@/components/WalkSettingsPanel";
import type { AttractionCategory, Coordinates } from "@/lib/types";
import type { WalkSettings } from "@/lib/types/walk-settings";

export interface WalkCompanionInput {
  origin: Coordinates;
  availableMinutes: number;
  walkingPaceMinPerKm: number;
  radiusMeters: number;
  /** Undefined when the walker left the end-distance field blank. */
  maxEndDistanceFromOriginMeters?: number;
  /**
   * Where the end-distance constraint is measured from, when that is no longer
   * `origin`. The form never sets it — a walk planned here starts where it is
   * anchored. A mid-walk rebuild does, because it moves `origin` to wherever
   * the walker has got to and the place they want to finish near has not moved.
   */
  endAnchor?: Coordinates;
  preferredCategories?: AttractionCategory[];
}

interface WalkCompanionPanelProps {
  isLoading: boolean;
  onBuildWalk: (input: WalkCompanionInput) => void;
  walkSettings: WalkSettings;
  /** Whether there is an account holding standing facts to show. */
  isSignedIn?: boolean;
  onWalkSettingsChange: (s: Partial<WalkSettings>) => void;
  mapClickedCoords?: Coordinates | null;
  /**
   * A walk length read out of the free-text box ("I have three hours"). Fills
   * the time field as a starting value each time a new one is detected — the
   * walker can still type over it, and it is never re-applied on its own.
   */
  suggestedMinutes?: number | null;
  /**
   * A finish distance read out of that same box ("finish within 1km of here"),
   * in kilometres. Fills the max-distance field exactly as `suggestedMinutes`
   * fills the time one: a starting value the walker can type over, re-applied
   * each time a new one is detected.
   */
  suggestedMaxEndDistanceKm?: number | null;
  /**
   * A search radius read out of that same box ("search up to 10km from here"),
   * in kilometres. Fills the search-radius field exactly as
   * `suggestedMaxEndDistanceKm` fills the max-distance one: a starting value
   * the walker can type over, re-applied each time a new one is detected.
   */
  suggestedSearchRadiusKm?: number | null;
  /**
   * The area named in that same free-text box ("in Zichron Yaakov"), geocoded.
   * Fills the coordinate fields the same way `suggestedMinutes` fills the time
   * one: a starting value the walker can type over, only re-applied when the
   * prompt resolves somewhere new.
   *
   * Outranked by real GPS — see `hasDetectedGpsRef`.
   */
  suggestedOrigin?: Coordinates | null;
  /**
   * The walking pace saved on the signed-in walker's profile, learned from the
   * walks they have actually done. Fills the pace picker the same way
   * `suggestedMinutes` fills the time field: a starting value, so a returning
   * walker isn't asked again for something we already know, and one they can
   * override for this walk by tapping another pace.
   *
   * Null for a logged-out visitor and for anyone whose profile has no pace yet —
   * the picker then opens on its own "Normal" default.
   */
  suggestedPace?: number | null;
  /**
   * The interests saved on that same profile. Ticks those chips on open, again
   * as a starting value: the walker can untick any of them, and nothing ticks
   * them back.
   */
  suggestedCategories?: AttractionCategory[] | null;
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

/**
 * The profile stores a measured pace (14.3 min/km, learned from real walks);
 * the picker offers three. Snap to the nearest one, so a saved pace shows up as
 * a selected option instead of leaving all three buttons unlit and the walker
 * unable to tell whether anything was remembered.
 */
function nearestPaceOption(pace: number): number {
  return PACE_OPTIONS.reduce(
    (closest, option) =>
      Math.abs(option.value - pace) < Math.abs(closest - pace)
        ? option.value
        : closest,
    PACE_OPTIONS[0].value,
  );
}

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
  isSignedIn = false,
  onWalkSettingsChange,
  mapClickedCoords,
  suggestedMinutes,
  suggestedMaxEndDistanceKm,
  suggestedSearchRadiusKm,
  suggestedOrigin,
  suggestedPace,
  suggestedCategories,
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
  // Blank on purpose, and stays blank unless the walker asks for it: most walks
  // do not care where they end, and defaulting to a number would quietly start
  // dropping stops from walks nobody constrained.
  const [endDistanceKm, setEndDistanceKm] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<AttractionCategory[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  /**
   * True once "Use my current location" has actually returned a fix. A real GPS
   * reading is where the walker IS; an area parsed out of a sentence is only
   * where the sentence sounded like. So the prompt is never allowed to move the
   * origin off a detected position, however much later the prompt arrives.
   *
   * Deliberately never reset — not even when the walker then edits the
   * coordinate fields by hand. Typing coordinates is an explicit choice too, and
   * the point of the flag is that free text stops outranking explicit input for
   * the rest of the session. A ref rather than state because nothing renders
   * from it and flipping it must not re-run the effect it guards.
   */
  const hasDetectedGpsRef = useRef(false);

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

  useEffect(() => {
    if (typeof suggestedMaxEndDistanceKm !== "number") {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEndDistanceKm(String(suggestedMaxEndDistanceKm));
  }, [suggestedMaxEndDistanceKm]);

  useEffect(() => {
    if (typeof suggestedSearchRadiusKm !== "number") {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRadiusKm(String(suggestedSearchRadiusKm));
  }, [suggestedSearchRadiusKm]);

  // Depends on the two numbers, not the object: a prompt that resolves to the
  // same place again must not overwrite coordinates the walker has since typed
  // or detected, exactly as re-stating the same walk length leaves the time
  // field alone.
  const suggestedLat = suggestedOrigin?.lat;
  const suggestedLng = suggestedOrigin?.lng;
  useEffect(() => {
    if (typeof suggestedLat !== "number" || typeof suggestedLng !== "number") {
      return;
    }

    // GPS wins for good, whenever it happened.
    if (hasDetectedGpsRef.current) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLat(suggestedLat.toFixed(6));
    setLng(suggestedLng.toFixed(6));
  }, [suggestedLat, suggestedLng]);

  // Keyed on the number for the same reason: the saved profile arrives again on
  // every re-render of the page above, and re-applying it would silently undo a
  // pace the walker has since tapped for this particular walk.
  useEffect(() => {
    if (typeof suggestedPace !== "number") {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPace(nearestPaceOption(suggestedPace));
  }, [suggestedPace]);

  // Keyed on the contents rather than the array, exactly as the origin effect is
  // keyed on its two numbers and not on the object: the profile comes down as a
  // fresh array on every render, and re-applying it would tick back a chip the
  // walker deliberately unticked. Category names never contain a comma, so the
  // key round-trips losslessly.
  const suggestedCategoryKey = (suggestedCategories ?? []).join(",");
  useEffect(() => {
    if (!suggestedCategoryKey) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedCategories(
      suggestedCategoryKey.split(",") as AttractionCategory[],
    );
  }, [suggestedCategoryKey]);

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
        hasDetectedGpsRef.current = true;
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

    const trimmedEndDistance = endDistanceKm.trim();
    const parsedEndDistanceKm =
      trimmedEndDistance === "" ? null : parseFloat(trimmedEndDistance);
    if (
      parsedEndDistanceKm !== null &&
      (!Number.isFinite(parsedEndDistanceKm) || parsedEndDistanceKm <= 0)
    ) {
      setFormError("Enter a valid finish distance (km > 0), or leave it blank.");
      return;
    }

    onBuildWalk({
      origin: { lat: parsedLat, lng: parsedLng },
      availableMinutes: parsedMinutes,
      walkingPaceMinPerKm: pace,
      radiusMeters: parsedRadiusKm * 1000,
      maxEndDistanceFromOriginMeters:
        parsedEndDistanceKm === null ? undefined : parsedEndDistanceKm * 1000,
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

      {/* Finish distance from the start */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-charcoal/80">
          Max distance from start at end (km)
        </label>
        <input
          type="number"
          min={0.1}
          max={50}
          step={0.5}
          placeholder="Any"
          value={endDistanceKm}
          onChange={(e) => setEndDistanceKm(e.target.value)}
          className="w-full rounded-md border border-charcoal/15 px-2 py-2 text-sm focus:border-terra focus:outline-none"
        />
        <p className="text-[11px] text-charcoal/50">
          Leave blank to finish anywhere. Set it to come back near your car or hotel.
        </p>
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

      {/* What the app has picked up about the walker, and how to take it back.
          Sits with the settings because that is where someone goes to ask
          "what does this thing know about me?". */}
      <StandingFactsPanel
        isSignedIn={isSignedIn}
        learnPreferences={walkSettings.preferenceLearningEnabled}
      />

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
