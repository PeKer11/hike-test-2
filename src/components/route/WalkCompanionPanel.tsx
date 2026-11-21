"use client";

import { geolocationSupported, locate } from "@/lib/geo/locate";
import { loadSavedStart } from "@/lib/start-location";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Button, LoadingSpinner } from "@/components/ui";
import { PLAN_COPY, VIBES, PACE_LABELS, CATEGORY_LABELS_PLAN, type PlanLang } from "@/components/route/plan-copy";
import { SegRow } from "@/components/ui/SegRow";
import { BTN, CTRL_BOX, chipCell } from "@/components/ui/panel-style";
import { StandingFactsPanel } from "@/components/StandingFactsPanel";
import { WalkSettingsPanel } from "@/components/WalkSettingsPanel";
import type { AttractionCategory, Coordinates } from "@/lib/types";
import type { WalkCompanionInput } from "@/lib/types/walk-companion";
import type { WalkSettings } from "@/lib/types/walk-settings";
import { haversineDistance } from "@/lib/utils/geo";

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
  /** Signed-in walkers build through the chat: hide the form fields and Build button. */
  chatOnly?: boolean;
  isWalking?: boolean;
  /** Language of the form's words. */
  lang?: PlanLang;
  /** The "Stops or request" box, drawn between the vibe row and the time row. */
  promptSlot?: ReactNode;
  /** Bumped by the header's location chip: opens "More options" so the start can be changed. */
  openMoreTick?: number;
  /** Extra rows at the end of "More options" (map display switches). */
  moreSlot?: ReactNode;
}

const PACE_OPTIONS = [
  { label: "Very slow (25 min/km)", value: 25 },
  { label: "Slow (20 min/km)", value: 20 },
  { label: "Normal (15 min/km)", value: 15 },
  { label: "Brisk (12 min/km)", value: 12 },
  { label: "Fast (10 min/km)", value: 10 },
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
  chatOnly = false,
  isWalking = false,
  lang = "en",
  promptSlot,
  openMoreTick = 0,
  moreSlot,
}: WalkCompanionPanelProps) {
  const t = PLAN_COPY[lang];
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [availableMinutes, setAvailableMinutes] = useState("90");
  const [pace, setPace] = useState(15);
  const [customPace, setCustomPace] = useState("");
  const [radiusKm, setRadiusKm] = useState("2");
  // Blank on purpose, and stays blank unless the walker asks for it: most walks
  // do not care where they end, and defaulting to a number would quietly start
  // dropping stops from walks nobody constrained.
  const [endDistanceKm, setEndDistanceKm] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<AttractionCategory[]>([]);
  // The mockup's five route vibes. Each asks the planner for a few stop categories; they add to the interest chips.
  const [vibes, setVibes] = useState<string[]>([]);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDetailsElement>(null);
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
  const locateRef = useRef<{ stop(): void } | null>(null);

  useEffect(() => {
    if (openMoreTick > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMoreOpen(true);
      moreRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [openMoreTick]);

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

  /**
   * `auto` is the silent default (page load, or Build with no point yet): it
   * only fills BLANK fields and does not lock the origin to GPS, so a place the
   * walker names in the prompt still wins. A tap on the button is the explicit
   * choice and locks it, as before.
   */
  const detectLocation = (auto = false): Promise<Coordinates | null> => {
    setLocationError(null);
    const fail = (message: string) => {
      if (!auto) setLocationError(message);
      return Promise.resolve(null);
    };
    if (
      typeof window !== "undefined" &&
      !window.isSecureContext &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1"
    ) {
      return fail(t.errHttps);
    }

    if (!geolocationSupported()) {
      return fail(t.errNoGeo);
    }
    setIsDetecting(true);
    return new Promise((resolve) => {
      let answered = false;
      let firstApplied: Coordinates | null = null;
      const answer = (coords: Coordinates | null) => {
        if (answered) return;
        answered = true;
        setIsDetecting(false);
        resolve(coords);
      };
      const apply = (coords: Coordinates) => {
        const latText = coords.lat.toFixed(6);
        const lngText = coords.lng.toFixed(6);
        const previous = firstApplied;
        // Refining overwrites only what this very detection wrote, never what the walker typed.
        const mine = (text: string, was: number | null) => was !== null && text === was.toFixed(6);
        if (!auto) {
          hasDetectedGpsRef.current = true;
          setLat(latText);
          setLng(lngText);
        } else {
          setLat((prev) => (prev === "" || mine(prev, previous?.lat ?? null) ? latText : prev));
          setLng((prev) => (prev === "" || mine(prev, previous?.lng ?? null) ? lngText : prev));
        }
        firstApplied = coords;
        // The automatic fix on load must not undo the start the walker picked or the chat remembers (its label would then be wrong).
        if (!(auto && loadSavedStart())) onLocationDetected?.(coords);
      };
      locateRef.current?.stop();
      locateRef.current = locate({
        purpose: "start",
        onUpdate: (fix) => {
          // A city-level guess is for centring a map, never a start point.
          if (fix.source === "ip") return;
          const moved = !firstApplied || haversineDistance(firstApplied, fix.coordinates) > 30;
          if (moved) apply(fix.coordinates);
          answer(fix.coordinates);
        },
        onState: (state) => {
          if (state === "denied" || state === "unavailable" || state === "timeout") {
            if (!auto) setLocationError(t.errNoFix);
            answer(null);
          }
        },
      });
    });
  };

  // Current location is the default start: ask for it as soon as the planner
  // opens, unless a point is already there.
  useEffect(() => {
    if (lat === "" && lng === "") {
      void detectLocation(true);
    }
    return () => locateRef.current?.stop();
    // Once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleCategory = (cat: AttractionCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  const submit = async () => {
    setFormError(null);

    let latText = lat;
    let lngText = lng;
    if (latText.trim() === "" && lngText.trim() === "") {
      // No start point yet: ask for the current location instead of an error.
      const detected = await detectLocation(true);
      if (detected) {
        latText = detected.lat.toFixed(6);
        lngText = detected.lng.toFixed(6);
      } else {
        setFormError(t.errStart);
        return;
      }
    }

    const parsedLat = parseFloat(latText);
    const parsedLng = parseFloat(lngText);
    // Blank means "no limit": use the largest value the planner accepts.
    const parsedMinutes = availableMinutes.trim() === "" ? 480 : parseInt(availableMinutes, 10);
    const parsedRadiusKm = radiusKm.trim() === "" ? 10 : parseFloat(radiusKm);

    if (!Number.isFinite(parsedLat) || parsedLat < -90 || parsedLat > 90) {
      setFormError(t.errLat);
      return;
    }
    if (!Number.isFinite(parsedLng) || parsedLng < -180 || parsedLng > 180) {
      setFormError(t.errLng);
      return;
    }
    if (!Number.isFinite(parsedMinutes) || parsedMinutes <= 0) {
      setFormError(t.errMinutes);
      return;
    }
    if (!Number.isFinite(parsedRadiusKm) || parsedRadiusKm <= 0) {
      setFormError(t.errRadius);
      return;
    }

    const trimmedEndDistance = endDistanceKm.trim();
    const parsedEndDistanceKm =
      trimmedEndDistance === "" ? null : parseFloat(trimmedEndDistance);
    if (
      parsedEndDistanceKm !== null &&
      (!Number.isFinite(parsedEndDistanceKm) || parsedEndDistanceKm < 0)
    ) {
      setFormError(t.errEnd);
      return;
    }

    const preferred = Array.from(new Set([...selectedCategories, ...VIBES.filter((v) => vibes.includes(v.id)).flatMap((v) => v.categories)]));
    onBuildWalk({
      origin: { lat: parsedLat, lng: parsedLng },
      availableMinutes: parsedMinutes,
      walkingPaceMinPerKm: pace,
      radiusMeters: parsedRadiusKm * 1000,
      maxEndDistanceFromOriginMeters:
        parsedEndDistanceKm === null ? undefined : parsedEndDistanceKm * 1000,
      preferredCategories: preferred.length > 0 ? preferred : undefined,
    });
  };

  // The time presets mirror the number box: a preset lights up only while the box holds exactly its value.
  const timePreset = availableMinutes === "" ? "open" : ["45", "60", "90"].includes(availableMinutes) ? availableMinutes : null;
  const toggleVibe = (id: string) => setVibes((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));

  const BLOCK = "border-b border-tk-hair px-4 py-3";
  const LABEL = "block text-[16px] font-semibold leading-[1.42] text-tk-ink";
  const META = "block text-[14px] font-normal text-tk-sage";

  // The sheet (mockup r13): vibe row, the request box, time, a quiet "More options" bar, then the one primary button.
  return (
    <section className={`-mx-4 bg-cream font-app-sans ${chatOnly ? "" : "pt-5"}`}>
      {!chatOnly && (
        <>
          <div className={BLOCK}>
            <span className={`${LABEL} mb-2`}>{t.vibeLabel}</span>
            <div role="group" aria-label={t.vibeLabel} className="flex flex-wrap gap-[7px]">
              {VIBES.map((v) => {
                const on = vibes.includes(v.id);
                return (
                  <button key={v.id} type="button" aria-pressed={on} onClick={() => toggleVibe(v.id)} className={`tk-chip !justify-start !pe-3 !ps-[6px] ${on ? "is-on" : ""}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={v.image} alt="" width={30} height={30} className="h-[30px] w-[30px] flex-none rounded-[4px] bg-tk-bar object-cover" />
                    <span>{v[lang]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {promptSlot}

          <div className={BLOCK}>
            <span className={`${LABEL} mb-2`}>{t.timeLabel}</span>
            <SegRow
              label={t.timeLabel}
              value={timePreset}
              onChange={(id) => setAvailableMinutes(id === "open" ? "" : id)}
              items={[
                { id: "45", label: t.time45 },
                { id: "60", label: t.time60 },
                { id: "90", label: t.time90 },
                { id: "open", label: t.timeOpen },
              ]}
            />
          </div>

          <details ref={moreRef} open={moreOpen} onToggle={(e) => setMoreOpen(e.currentTarget.open)} className="border-b border-tk-hair [&>summary::-webkit-details-marker]:hidden">
            <summary className="tk-bar !border-0 cursor-pointer list-none !text-[14px]">
              <span>{t.moreOptions}</span>
              <span aria-hidden>{moreOpen ? "−" : "+"}</span>
            </summary>
            <div className="space-y-4 px-4 py-3">
              {/* Location */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => void detectLocation()}
                  disabled={isDetecting || isLoading}
                  className="tk-champagne inline-flex min-h-11 items-center gap-2 px-4 text-[15px] disabled:opacity-60"
                >
                  <span aria-hidden className="tk-champagne-ring" />
                  {isDetecting ? t.detecting : t.useLocation}
                </button>
                {locationError && <p className="text-[13px] text-rose-700">{locationError}</p>}
                <div dir="ltr" className="grid grid-cols-2 gap-2">
                  <input type="text" value={lat} onChange={(e) => setLat(e.target.value)} placeholder={t.latitude} className={CTRL_BOX} />
                  <input type="text" value={lng} onChange={(e) => setLng(e.target.value)} placeholder={t.longitude} className={CTRL_BOX} />
                </div>
              </div>

              {/* Time, exact */}
              <div className="space-y-2">
                <label className={LABEL}>{t.minutesLabel}</label>
                <input type="number" min={15} max={480} placeholder={t.noLimit} value={availableMinutes} onChange={(e) => setAvailableMinutes(e.target.value)} className={CTRL_BOX} />
              </div>

              {/* Search radius */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className={LABEL}>{t.radiusLabel}</label>
                  <button type="button" onClick={() => setRadiusKm(radiusKm === "" ? "2" : "")} className={chipCell(radiusKm === "")}>
                    {t.noRadius}
                  </button>
                </div>
                <input type="number" min={0.5} max={10} step={0.5} placeholder={t.noLimit} value={radiusKm} onChange={(e) => setRadiusKm(e.target.value)} className={CTRL_BOX} />
              </div>

              {/* Finish distance from the start */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className={LABEL}>{t.endLabel}</label>
                  <button type="button" onClick={() => setEndDistanceKm(endDistanceKm === "" ? "2" : "")} className={chipCell(endDistanceKm === "")}>
                    {t.noLimit}
                  </button>
                </div>
                <input type="number" min={0} max={50} step={0.5} placeholder={t.endAny} value={endDistanceKm} onChange={(e) => setEndDistanceKm(e.target.value)} className={CTRL_BOX} />
                <p className={META}>{t.endHint}</p>
              </div>

              {/* Walking pace */}
              <div className="space-y-2">
                <label className={LABEL}>{t.paceLabel}</label>
                <div className="grid grid-cols-2 gap-2">
                  {PACE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setPace(opt.value);
                        setCustomPace("");
                      }}
                      className={`min-h-11 ${chipCell(pace === opt.value)}`}
                    >
                      {lang === "en" ? opt.label : PACE_LABELS[lang][opt.value]}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min={4}
                  max={40}
                  step={0.5}
                  placeholder={t.customPace}
                  value={customPace}
                  onChange={(e) => {
                    setCustomPace(e.target.value);
                    const n = parseFloat(e.target.value);
                    if (Number.isFinite(n) && n >= 4 && n <= 40) setPace(n);
                  }}
                  className={CTRL_BOX}
                />
              </div>

              {/* Categories */}
              <div className="space-y-2">
                <label className={LABEL}>
                  {t.interests} <span className="font-normal text-tk-sage">{t.optional}</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_OPTIONS.map((opt) => (
                    <button key={opt.value} onClick={() => toggleCategory(opt.value)} className={`min-h-11 ${chipCell(selectedCategories.includes(opt.value))}`}>
                      {lang === "en" ? opt.label : CATEGORY_LABELS_PLAN[lang][opt.value]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Walk settings, and what the app has picked up about the walker with how to take it back. */}
            <WalkSettingsPanel settings={walkSettings} onChange={onWalkSettingsChange} lang={lang} />
            <StandingFactsPanel isSignedIn={isSignedIn} learnPreferences={walkSettings.preferenceLearningEnabled} lang={lang} />
            {moreSlot}
          </details>
        </>
      )}

      {chatOnly && (
        <>
          {/* Signed in: the chat above builds the walk; the settings stay here. */}
          <WalkSettingsPanel settings={walkSettings} onChange={onWalkSettingsChange} lang={lang} />
          <StandingFactsPanel isSignedIn={isSignedIn} learnPreferences={walkSettings.preferenceLearningEnabled} lang={lang} />
          {moreSlot}
        </>
      )}

      <div className="space-y-3 px-4 pb-4 pt-[14px] empty:hidden">
        {formError && <p className="rounded-[6px] bg-rose-50 px-3 py-2 text-[13px] text-rose-700">{formError}</p>}

        {!chatOnly && (
          <button type="button" onClick={submit} disabled={isLoading} className={`${BTN} w-full`}>
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <LoadingSpinner size="sm" />
                {t.building}
              </span>
            ) : (
              <>
                {t.build}
                <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="rtl:-scale-x-100">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </>
            )}
          </button>
        )}
        {canRevertPlan && (
          <Button onClick={() => onRevertPlan?.()} variant="secondary" fullWidth>
            {t.backToPrevious}
          </Button>
        )}
        {isWalking ? (
          <Button onClick={() => onStopWalk?.()} variant="danger" fullWidth>
            {t.endWalk}
          </Button>
        ) : walkPlanReady ? (
          <Button onClick={() => onStartWalk?.()} disabled={isLoading} fullWidth>
            {t.startWalk}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
