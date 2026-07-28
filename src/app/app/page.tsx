"use client";

import { useEffect, useRef, useState } from "react";

import { ConstraintPanel } from "@/components/constraints";
import { DynamicMap } from "@/components/map";
import {
  HikeSearchPanel,
  RouteResults,
  TrailIntelligencePanel,
  WalkCompanionPanel,
  WalkPlanResults,
} from "@/components/route";
import { OffRouteNotification } from "@/components/walk/OffRouteNotification";
import type { WalkCompanionInput } from "@/components/route/WalkCompanionPanel";
import type { Attraction, WalkPlan } from "@/lib/types";
import { Button, Card } from "@/components/ui";
import { PlaceSearch, WaypointList } from "@/components/waypoints";
import {
  useConstraints,
  useHikeSearch,
  useMapInteraction,
  useRouteCalculation,
  useTrailIntelligence,
  useWalkSettings,
  useWaypoints,
} from "@/lib/hooks";
import type { Coordinates } from "@/lib/types";
import { downloadCsv, downloadGpx } from "@/lib/walk/gpx-exporter";
import { AttractionDistancesPanel } from "@/components/walk/AttractionDistancesPanel";
import { PaceChecker } from "@/lib/walk/pace-checker";
import { detectDeviation, remainingRoute } from "@/lib/walk/deviation-detector";
import { WalkRecorder } from "@/lib/walk/walk-recorder";
import { WalkTracker } from "@/lib/walk/walk-tracker";
import type { PaceUpdate } from "@/lib/walk/walk-tracker";
import { SimulatedWalkTracker } from "@/lib/walk/simulated-walk-tracker";
import { WalkRecordingPanel } from "@/components/WalkRecordingPanel";
import { PoiAlerter } from "@/lib/walk/poi-alerter";
import type { PoiAlert } from "@/lib/walk/poi-alerter";
import { VisitTracker, excludeVisited } from "@/lib/walk/visit-tracker";
import { ReplanTrigger } from "@/lib/walk/replan-trigger";

type PlannerMode = "manual" | "hike-search" | "walk-companion";

// One level of undo: the plan the walker was on before the last automatic re-plan.
interface PlanSnapshot {
  plan: WalkPlan;
  input: WalkCompanionInput;
  geometry: Coordinates[];
  startTime: number;
}

const REPLAN_FAILED_MESSAGE =
  "Couldn't build an updated route just now — keeping you on your current one.";

export default function HomePage() {
  const [plannerMode, setPlannerMode] = useState<PlannerMode>("manual");
  const [hikeSearchOriginInput, setHikeSearchOriginInput] = useState({
    lat: "31.7683",
    lng: "35.2137",
  });
  const [useMapClickForHikeOrigin, setUseMapClickForHikeOrigin] = useState(false);
  const {
    waypoints,
    setWaypoints,
    addWaypoint,
    updateWaypoint,
    removeWaypoint,
    reorderWaypoints,
    toggleRequired,
    setStartWaypoint,
    setEndWaypoint,
    setWaypointTimeWindow,
    clearWaypoints,
  } = useWaypoints();
  const {
    constraints,
    toggleMaxDistance,
    setMaxDistanceKm,
    toggleTimeWindows,
    setDefaultTimeWindow,
    toggleFixedStartEnd,
  } = useConstraints();
  const { route, isLoading, error, calculateRoute, clearRoute, applyRoute } =
    useRouteCalculation();
  const { isSearching, error: hikeSearchError, findHike, cancelSearch } =
    useHikeSearch();
  const [walkPlan, setWalkPlan] = useState<WalkPlan | null>(null);
  const [walkPlanError, setWalkPlanError] = useState<string | null>(null);
  const [isWalkPlanLoading, setIsWalkPlanLoading] = useState(false);
  const { settings: walkSettings, setSettings: setWalkSettings } = useWalkSettings();
  const walkInputRef = useRef<WalkCompanionInput | null>(null);
  const walkStartTimeRef = useRef<number>(0);
  const latestPaceUpdateRef = useRef<PaceUpdate | null>(null);
  // Read by the PaceChecker callback, which closes over a stale render's state.
  const walkPlanRef = useRef<WalkPlan | null>(null);
  const pinnedAttractionIdsRef = useRef<string[]>([]);
  const [pinnedAttractionIds, setPinnedAttractionIds] = useState<string[]>([]);
  const [previousPlan, setPreviousPlan] = useState<PlanSnapshot | null>(null);
  const [pinnedTimeWarning, setPinnedTimeWarning] = useState<string | null>(null);
  const walkTrackerRef = useRef<WalkTracker | SimulatedWalkTracker | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const paceCheckerRef = useRef<PaceChecker | null>(null);
  const walkRecorderRef = useRef<WalkRecorder | null>(null);
  const poiAlerterRef = useRef<PoiAlerter | null>(null);
  // Lives for the whole walk — a re-plan must not forget what was already seen.
  const visitTrackerRef = useRef<VisitTracker | null>(null);
  // Also lives for the whole walk: each re-plan builds a fresh PaceChecker, so a
  // trigger owned by the checker would reset its cooldown on every re-plan and
  // never actually throttle them.
  const replanTriggerRef = useRef<ReplanTrigger | null>(null);
  const [poiAlert, setPoiAlert] = useState<PoiAlert | null>(null);
  const poiAlertTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buildWalkRequestIdRef = useRef(0);
  // Bumped whenever an in-flight hike search must be abandoned (clear / mode switch / unmount)
  const hikeSearchTokenRef = useRef(0);
  const lastGpsUpdateRef = useRef<number>(0);
  const walkGeometryRef = useRef<Coordinates[]>([]);
  const [lastWalkInput, setLastWalkInput] = useState<WalkCompanionInput | null>(null);
  const [recordedPointCount, setRecordedPointCount] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<Coordinates | null>(null);
  const [remainingGeometry, setRemainingGeometry] = useState<Coordinates[]>([]);
  const [isOffRoute, setIsOffRoute] = useState(false);
  const [offRouteDeviation, setOffRouteDeviation] = useState(0);
  const [walkPhase, setWalkPhase] = useState<"idle" | "planned" | "walking">("idle");
  const [mapClickedCoords, setMapClickedCoords] = useState<Coordinates | null>(null);
  const [walkTrackingMessage, setWalkTrackingMessage] = useState<string | null>(null);
  const [attractionDistances, setAttractionDistances] = useState<Record<string, number>>({});
  const routeAnchor =
    route?.orderedWaypoints[0]?.coordinates ?? route?.geometry[0];
  const {
    report: trailBriefing,
    isLoading: isTrailBriefingLoading,
    error: trailBriefingError,
  } = useTrailIntelligence(route, routeAnchor);
  const { center, zoom, clickMode, setClickMode, focusOn } = useMapInteraction();

  const stopWalkTracking = () => {
    paceCheckerRef.current?.stop();
    paceCheckerRef.current = null;
    walkTrackerRef.current?.stop();
    walkTrackerRef.current = null;
    walkRecorderRef.current?.stop();
    walkRecorderRef.current = null;
    poiAlerterRef.current = null;
    if (poiAlertTimeoutRef.current !== null) {
      clearTimeout(poiAlertTimeoutRef.current);
      poiAlertTimeoutRef.current = null;
    }
    lastGpsUpdateRef.current = 0;
    setIsRecording(false);
    setCurrentPosition(null);
    setRemainingGeometry([]);
    setIsOffRoute(false);
    setOffRouteDeviation(0);
    setWalkPhase("idle");
    setWalkTrackingMessage(null);
    setAttractionDistances({});
    setPoiAlert(null);
  };

  // Ending the walk tears down everything scoped to *this walk*, not just the GPS
  // session: `stopWalkTracking` alone leaves the revert snapshot armed, so the
  // "back to previous route" button would still be sitting there afterwards and
  // would restart tracking on a walk the user had already ended.
  const handleEndWalk = () => {
    stopWalkTracking();
    setPreviousPlan(null);
    setPinnedTimeWarning(null);
    setPinnedAttractionIds([]);
    pinnedAttractionIdsRef.current = [];
    visitTrackerRef.current?.reset();
    replanTriggerRef.current = null;
  };

  // Draws a plan on the map and moves the walk into the "planned" phase. Shared by
  // the build path and the revert-to-previous-route path.
  const showPlan = (plan: WalkPlan, geometry: Coordinates[]) => {
    setWalkPlan(plan);
    walkPlanRef.current = plan;
    setWalkPhase("planned");
    walkGeometryRef.current = geometry;
    setRemainingGeometry(geometry);
    setIsOffRoute(false);
    setOffRouteDeviation(0);
    setWalkTrackingMessage(null);
    // Show attraction markers on the map
    clearWaypoints();
    clearRoute();
    const attractionWaypoints = plan.orderedAttractions.map((a, i) => ({
      id: a.id,
      name: `${i + 1}. ${a.name}`,
      coordinates: a.coordinates,
      required: true,
      isStart: i === 0,
      isEnd: i === plan.orderedAttractions.length - 1,
    }));
    // Set them directly: addWaypoint would mint fresh ids and drop the
    // required/isStart/isEnd flags, leaving the markers out of sync with
    // the route waypoints handed to applyRoute below.
    setWaypoints(attractionWaypoints);
    // If ORS returned geometry, show the route line on the map
    if (geometry.length > 0) {
      applyRoute({
        orderedWaypoints: attractionWaypoints,
        geometry,
        totalDistanceMeters: plan.totalDistanceMeters,
        totalDurationSeconds: plan.totalMinutes * 60,
        segments: [],
        warnings: [],
      });
    }
    if (plan.orderedAttractions[0]) {
      focusOn(plan.orderedAttractions[0].coordinates, 14);
    }
  };

  // `autoResume` is set only by the pace-triggered rebuild below: after a slow-pace
  // re-plan we jump straight back into live tracking instead of dropping the walker
  // on the "planned" screen. User-initiated rebuilds keep the manual Start Walk step.
  // `keepAttractions` pins the rebuild to the POIs the walker is already heading to
  // instead of re-running discovery — again, automatic path only.
  const handleBuildWalk = async (
    input: WalkCompanionInput,
    options?: {
      autoResume?: boolean;
      keepAttractions?: Attraction[];
      pinnedIds?: string[];
    },
  ) => {
    // Snapshot what the walker is on now, so an automatic re-plan can be undone —
    // and so a failed re-plan can put them back instead of stranding them.
    const snapshot: PlanSnapshot | null =
      options?.autoResume && walkPlanRef.current && walkInputRef.current
        ? {
            plan: walkPlanRef.current,
            input: walkInputRef.current,
            geometry: walkGeometryRef.current,
            startTime: walkStartTimeRef.current,
          }
        : null;
    if (snapshot) {
      // Keep the *first* snapshot of a re-plan chain. A "+15 min" retry is another
      // automatic step on top of an already-adjusted plan, so overwriting here would
      // make "back to previous route" land on an intermediate auto-generated plan
      // instead of the route the walker deliberately started on. A user-initiated
      // build clears it below, which is where a genuinely new chain begins.
      setPreviousPlan((prev) => prev ?? snapshot);
    }

    stopWalkTracking();
    walkInputRef.current = input;
    setLastWalkInput(input);
    walkStartTimeRef.current = Date.now();
    latestPaceUpdateRef.current = null;
    setPinnedTimeWarning(null);
    if (!options?.autoResume) {
      setPreviousPlan(null);
      setPinnedAttractionIds([]);
      pinnedAttractionIdsRef.current = [];
      visitTrackerRef.current?.reset();
      replanTriggerRef.current = null;
    }
    setCurrentPosition(input.origin);

    // Attractions the walker already reached are done — never re-plan them back
    // into the route. If that empties the kept set, the API falls back to fresh
    // discovery, which is the right answer: nothing is left to keep.
    const visitedIds = visitTrackerRef.current?.visitedIds ?? new Set<string>();
    const keepAttractions = options?.keepAttractions
      ? excludeVisited(options.keepAttractions, visitedIds)
      : undefined;
    // A pin on a visited stop has nothing left to enforce — drop it so it can't
    // make the plan infeasible or raise the "you won't reach it" prompt.
    const activePinnedIds = (options?.pinnedIds ?? []).filter(
      (id) => !visitedIds.has(id),
    );

    buildWalkRequestIdRef.current += 1;
    const requestId = buildWalkRequestIdRef.current;

    setWalkPlanError(null);
    setWalkPlan(null);
    setIsWalkPlanLoading(true);
    try {
      const res = await fetch("/api/walk-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: input.origin.lat,
          lng: input.origin.lng,
          availableMinutes: input.availableMinutes,
          walkingPaceMinPerKm: input.walkingPaceMinPerKm,
          radiusMeters: input.radiusMeters,
          preferredCategories: input.preferredCategories,
          explicitAttractions: keepAttractions,
          pinnedAttractionIds: activePinnedIds,
        }),
      });
      const data = (await res.json()) as WalkPlan & { error?: string };

      // Bail if a newer request has superseded this one
      if (requestId !== buildWalkRequestIdRef.current) return;

      if (!res.ok || data.error) {
        // Tracking was already torn down for the rebuild. Dropping the walker
        // mid-walk because Overpass/ORS blipped is worse than keeping the route
        // they were on, so put it back and say so.
        if (snapshot) {
          revertToSnapshot(snapshot);
          setWalkTrackingMessage(REPLAN_FAILED_MESSAGE);
        } else {
          setWalkPlanError(data.error ?? "Failed to build walk plan.");
        }
      } else {
        showPlan(data, data.geometry ?? []);

        // A pinned stop is never dropped, so the plan can come back over budget.
        // Say so instead of failing quietly — the walker decides what to do.
        if (activePinnedIds.length > 0) {
          const droppedPins = data.droppedAttractions.filter((a) =>
            activePinnedIds.includes(a.id),
          );
          if (!data.feasible || droppedPins.length > 0) {
            setPinnedTimeWarning(
              `At your current pace you probably won't reach every pinned stop within the remaining ${Math.round(
                input.availableMinutes,
              )} min. Keep going anyway, add time, or unpin a stop.`,
            );
          }
        }

        // Pace-triggered rebuild: resume live tracking on the new route without
        // making the walker press "Start Walk" again. An over-budget plan caused
        // by a pin still resumes — the warning above is the user's decision point.
        if (
          options?.autoResume &&
          data.orderedAttractions.length > 0 &&
          (data.geometry?.length ?? 0) >= 2
        ) {
          handleStartWalk(data);
        }
      }
    } catch {
      if (requestId !== buildWalkRequestIdRef.current) return;
      if (snapshot) {
        revertToSnapshot(snapshot);
        setWalkTrackingMessage(REPLAN_FAILED_MESSAGE);
      } else {
        setWalkPlanError("Network error. Please try again.");
      }
    } finally {
      if (requestId === buildWalkRequestIdRef.current) {
        setIsWalkPlanLoading(false);
      }
    }
  };

  // `planOverride` is passed by the auto-resume path, where `walkPlan` state has just
  // been set and this closure would still read the previous (null) value.
  const handleStartWalk = (planOverride?: WalkPlan) => {
    const plan = planOverride ?? walkPlan;
    if (!plan || walkGeometryRef.current.length < 2) {
      setWalkPlanError("Build a walk plan before starting live tracking.");
      return;
    }
    walkPlanRef.current = plan;

    const initialPosition =
      (planOverride ? walkInputRef.current?.origin : currentPosition) ??
      walkInputRef.current?.origin ??
      walkGeometryRef.current[0] ??
      null;

    stopWalkTracking();
    latestPaceUpdateRef.current = null;
    setRecordedPointCount(0);
    setCurrentPosition(initialPosition);
    setIsOffRoute(false);
    setOffRouteDeviation(0);
    setWalkPhase("walking");
    setWalkTrackingMessage(null);

    if (initialPosition) {
      const initialDeviation = detectDeviation(
        initialPosition,
        walkGeometryRef.current,
      );
      setRemainingGeometry(
        remainingRoute(
          walkGeometryRef.current,
          initialDeviation.closestSegmentIndex,
          initialPosition,
        ),
      );
    } else {
      setRemainingGeometry(walkGeometryRef.current);
    }

    const attractions = plan.orderedAttractions;

    // Instantiate PoiAlerter for this walk session (CRITICAL-1)
    const alerter = new PoiAlerter();
    poiAlerterRef.current = alerter;

    // Reused across re-plans within the same walk — only a fresh build resets it.
    const visits = visitTrackerRef.current ?? new VisitTracker();
    visitTrackerRef.current = visits;

    const onPositionUpdate = (update: PaceUpdate) => {
      latestPaceUpdateRef.current = update;

      // Feed the re-plan windows from every accepted fix, not from the coarse
      // pace-check tick — the stop/slow detection needs the full sample stream.
      paceCheckerRef.current?.recordSample({
        coordinates: update.currentPosition,
        timestamp: update.timestamp,
      });

      // Visited detection runs on every accepted fix, like the alerter — a stop
      // walked past between two throttled ticks must still count as reached.
      visits.recordPosition(update.currentPosition, attractions);

      // PoiAlerter check — runs every tick, not throttled (CRITICAL-1)
      const alert = alerter.check(
        update.currentPosition,
        update.bearing ?? null,
        attractions,
      );
      if (alert) {
        setPoiAlert(alert);
        // Auto-dismiss after 8 seconds
        if (poiAlertTimeoutRef.current !== null) clearTimeout(poiAlertTimeoutRef.current);
        poiAlertTimeoutRef.current = setTimeout(() => setPoiAlert(null), 8000);
      }

      // Throttle setState calls to at most once per second (LOW-2)
      const now = Date.now();
      if (now - lastGpsUpdateRef.current < 1000) return;
      lastGpsUpdateRef.current = now;

      setCurrentPosition(update.currentPosition);
      setAttractionDistances(update.attractionDistances);
      setWalkTrackingMessage(null);

      const deviation = detectDeviation(
        update.currentPosition,
        walkGeometryRef.current,
      );

      if (deviation.needsReroute) {
        setIsOffRoute(true);
        setOffRouteDeviation(Math.round(deviation.deviationMeters));
      } else {
        setIsOffRoute(false);
        setOffRouteDeviation(0);
      }

      const remaining = remainingRoute(
        walkGeometryRef.current,
        deviation.closestSegmentIndex,
        update.currentPosition,
      );
      setRemainingGeometry(remaining);
    };

    const onGpsError = (error: { isTimeout: boolean; message: string }) => {
      if (error.isTimeout) {
        setWalkTrackingMessage(
          "GPS signal is weak right now. Waiting for the next location update...",
        );
        return;
      }
      setWalkTrackingMessage(`Live tracking issue: ${error.message}`);
    };

    const tracker = isSimulating
      ? new SimulatedWalkTracker(
          walkGeometryRef.current,
          onPositionUpdate,
          attractions,
          walkInputRef.current?.walkingPaceMinPerKm ?? 15,
        )
      : new WalkTracker(onPositionUpdate, onGpsError, attractions, walkGeometryRef.current);
    walkTrackerRef.current = tracker;
    tracker.start();

    const recorder = new WalkRecorder(30_000);
    walkRecorderRef.current = recorder;
    setIsRecording(true);
    recorder.start(() => {
      const update = latestPaceUpdateRef.current;
      if (update) {
        setRecordedPointCount((count) => count + 1);
      }
      return update;
    });

    const input = walkInputRef.current;
    if (!input) {
      return;
    }

    // Carried across re-plans within the same walk, so the cooldown armed by the
    // last re-plan still applies to the next one.
    const trigger =
      replanTriggerRef.current ?? new ReplanTrigger(input.walkingPaceMinPerKm);
    replanTriggerRef.current = trigger;

    const checker = new PaceChecker(
      walkSettings,
      trigger,
      () => {
        const orig = walkInputRef.current;
        if (!orig) return;
        // Only auto-rebuild when the user is actually walking (CRITICAL-2)
        // This ref closure captures the live walkPhase via the setter comparison below
        // We re-read walkPhase by checking the tracker is still active
        if (walkTrackerRef.current === null) return;
        const elapsedMinutes = (Date.now() - walkStartTimeRef.current) / 60_000;
        const remainingMinutes = Math.max(15, orig.availableMinutes - elapsedMinutes);
        const currentPos = latestPaceUpdateRef.current?.currentPosition ?? orig.origin;
        void handleBuildWalk(
          {
            ...orig,
            origin: currentPos,
            availableMinutes: remainingMinutes,
          },
          {
            autoResume: true,
            // Re-time the walk the user is already on — no fresh POI discovery.
            keepAttractions: walkPlanRef.current?.orderedAttractions,
            pinnedIds: pinnedAttractionIdsRef.current,
          },
        );
      },
    );
    paceCheckerRef.current = checker;
    checker.start();
  };

  // Undo the last automatic re-plan: put the walker back on the route they had,
  // starting from wherever they are now.
  const revertToSnapshot = (snapshot: PlanSnapshot) => {
    const resumePosition =
      latestPaceUpdateRef.current?.currentPosition ??
      currentPosition ??
      snapshot.input.origin;

    stopWalkTracking();
    walkInputRef.current = { ...snapshot.input, origin: resumePosition };
    setLastWalkInput(walkInputRef.current);
    walkStartTimeRef.current = snapshot.startTime;
    latestPaceUpdateRef.current = null;
    setPinnedTimeWarning(null);
    setPreviousPlan(null);

    // Undo the re-plan, not the walk: stops already reached stay reached, so the
    // restored plan lists only what is still ahead. The geometry is the original
    // route line — it can't be recomputed offline, and following it past a stop
    // that's already done is harmless.
    const visitedIds = visitTrackerRef.current?.visitedIds ?? new Set<string>();
    const keptIndices = snapshot.plan.orderedAttractions
      .map((a, i) => (visitedIds.has(a.id) ? -1 : i))
      .filter((i) => i >= 0);
    let restoredPlan = snapshot.plan;
    if (keptIndices.length !== snapshot.plan.orderedAttractions.length) {
      const orderedAttractions = keptIndices.map(
        (i) => snapshot.plan.orderedAttractions[i],
      );
      // The results list pairs stop N with segment N. Trimming one list and
      // not the other re-labels every surviving stop with someone else's leg.
      const segments = keptIndices
        .map((i) => snapshot.plan.segments[i])
        .filter((s) => s !== undefined);
      // The snapshot's totals cover the whole original route, including the legs
      // just trimmed — recompute them from what's actually left so the header
      // matches the legs listed underneath it.
      restoredPlan = {
        ...snapshot.plan,
        orderedAttractions,
        segments,
        totalDistanceMeters: segments.reduce((sum, s) => sum + s.distanceMeters, 0),
        totalMinutes:
          segments.reduce((sum, s) => sum + s.walkingMinutes, 0) +
          orderedAttractions.reduce((sum, a) => sum + a.avgVisitMinutes, 0),
      };
    }

    showPlan(restoredPlan, snapshot.geometry);
    setCurrentPosition(resumePosition);

    if (snapshot.geometry.length >= 2) {
      handleStartWalk(restoredPlan);
    }
  };

  const handleRevertPlan = () => {
    if (previousPlan) revertToSnapshot(previousPlan);
  };

  const toggleAttractionPin = (attractionId: string) => {
    setPinnedAttractionIds((prev) => {
      const next = prev.includes(attractionId)
        ? prev.filter((id) => id !== attractionId)
        : [...prev, attractionId];
      // The PaceChecker callback reads a ref — it can't see this state update.
      pinnedAttractionIdsRef.current = next;
      return next;
    });
  };

  // Keep PaceChecker in sync when settings change while a walk is active
  useEffect(() => {
    paceCheckerRef.current?.updateSettings(walkSettings);
  }, [walkSettings]);

  // Tear down the GPS watch, timers and in-flight searches if the page unmounts mid-walk
  useEffect(() => {
    return () => {
      hikeSearchTokenRef.current += 1;
      buildWalkRequestIdRef.current += 1;
      paceCheckerRef.current?.stop();
      walkTrackerRef.current?.stop();
      walkRecorderRef.current?.stop();
      if (poiAlertTimeoutRef.current !== null) {
        clearTimeout(poiAlertTimeoutRef.current);
      }
    };
  }, []);

  // Abandon any in-flight hike search when the user leaves the hike-search mode
  const changePlannerMode = (mode: PlannerMode) => {
    hikeSearchTokenRef.current += 1;
    setPlannerMode(mode);
  };

  const handleMapClick = (coordinates: Coordinates) => {
    if (plannerMode === "hike-search") {
      if (useMapClickForHikeOrigin) {
        setHikeSearchOriginInput({
          lat: coordinates.lat.toFixed(6),
          lng: coordinates.lng.toFixed(6),
        });
      }
      return;
    }

    if (plannerMode === "walk-companion") {
      setMapClickedCoords(coordinates);
      setCurrentPosition(coordinates);
      focusOn(coordinates, 16);
      return;
    }

    if (plannerMode !== "manual") {
      return;
    }

    if (clickMode === "add-waypoint") {
      addWaypoint({
        coordinates,
      });
      return;
    }

    const nextWaypoint = addWaypoint({
      coordinates,
      name: clickMode === "set-start" ? "Custom Start" : "Custom End",
    });

    if (clickMode === "set-start") {
      setStartWaypoint(nextWaypoint.id);
    } else {
      setEndWaypoint(nextWaypoint.id);
    }

    setClickMode("add-waypoint");
  };

  return (
    <>
      <OffRouteNotification
        visible={isOffRoute}
        deviationMeters={offRouteDeviation}
      />
      {/* POI alert overlay (CRITICAL-1) */}
      {poiAlert && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-medium text-white shadow-lg">
          {poiAlert.message}
          <button
            className="ml-3 text-emerald-200 hover:text-white"
            onClick={() => setPoiAlert(null)}
          >
            ✕
          </button>
        </div>
      )}
      <main className="flex min-h-screen w-full flex-col lg:h-screen lg:flex-row lg:overflow-hidden">
      <aside className="order-2 w-full overflow-y-auto border-b border-slate-200 bg-slate-50 p-4 pb-8 lg:order-1 lg:h-full lg:max-w-[400px] lg:border-b-0 lg:border-r lg:pb-4">
        <div className="mb-4 space-y-1">
          <h1 className="text-xl font-bold text-slate-900">Hiking Route Planner</h1>
          <p className="text-xs text-slate-500">
            Add waypoints, configure constraints, and generate an optimized walking route.
          </p>
        </div>

        <div className="space-y-4">
          <Card className="space-y-2">
            <div className="text-sm font-semibold text-slate-900">Planning mode</div>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={plannerMode === "manual" ? "primary" : "secondary"}
                onClick={() => changePlannerMode("manual")}
              >
                Manual
              </Button>
              <Button
                variant={plannerMode === "hike-search" ? "primary" : "secondary"}
                onClick={() => changePlannerMode("hike-search")}
              >
                Hike
              </Button>
              <Button
                variant={plannerMode === "walk-companion" ? "primary" : "secondary"}
                onClick={() => changePlannerMode("walk-companion")}
              >
                City Walk
              </Button>
            </div>
          </Card>

          {plannerMode === "manual" ? (
            <>
              <PlaceSearch
                onSelectPlace={(place) => {
                  addWaypoint({
                    coordinates: place.coordinates,
                    name: place.name,
                  });
                  focusOn(place.coordinates, 14);
                }}
              />

              <Card className="space-y-2">
                <div className="text-sm font-semibold text-slate-900">Map click mode</div>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant={clickMode === "add-waypoint" ? "primary" : "secondary"}
                    onClick={() => setClickMode("add-waypoint")}
                  >
                    Add
                  </Button>
                  <Button
                    variant={clickMode === "set-start" ? "primary" : "secondary"}
                    onClick={() => setClickMode("set-start")}
                  >
                    Start
                  </Button>
                  <Button
                    variant={clickMode === "set-end" ? "primary" : "secondary"}
                    onClick={() => setClickMode("set-end")}
                  >
                    End
                  </Button>
                </div>
              </Card>

              <WaypointList
                waypoints={waypoints}
                onRename={(id, name) => updateWaypoint(id, { name })}
                onToggleRequired={toggleRequired}
                onSetStart={setStartWaypoint}
                onSetEnd={setEndWaypoint}
                onDelete={removeWaypoint}
                onReorder={reorderWaypoints}
                onSetTimeWindow={setWaypointTimeWindow}
              />

              <ConstraintPanel
                constraints={constraints}
                isCalculating={isLoading}
                onToggleMaxDistance={toggleMaxDistance}
                onSetMaxDistanceKm={setMaxDistanceKm}
                onToggleTimeWindows={toggleTimeWindows}
                onSetDefaultTimeWindow={setDefaultTimeWindow}
                onToggleFixedStartEnd={toggleFixedStartEnd}
                onCalculateRoute={() => {
                  void calculateRoute(waypoints, constraints);
                }}
              />
            </>
          ) : plannerMode === "walk-companion" ? (
            <>
              {walkPhase !== "walking" && (
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <input
                    type="checkbox"
                    checked={isSimulating}
                    onChange={(e) => setIsSimulating(e.target.checked)}
                    className="h-4 w-4 rounded border-amber-400 accent-amber-500"
                  />
                  Simulate walk (dev mode — 10× speed)
                </label>
              )}
              <WalkCompanionPanel
                isLoading={isWalkPlanLoading}
                onBuildWalk={(input) => { void handleBuildWalk(input); }}
                walkSettings={walkSettings}
                onWalkSettingsChange={setWalkSettings}
                mapClickedCoords={mapClickedCoords}
                onLocationDetected={(coords) => {
                  setCurrentPosition(coords);
                  focusOn(coords, 16);
                }}
                walkPlanReady={walkPhase === "planned" || walkPhase === "walking"}
                onStartWalk={handleStartWalk}
                onStopWalk={handleEndWalk}
                onRevertPlan={handleRevertPlan}
                canRevertPlan={previousPlan !== null}
                isWalking={walkPhase === "walking"}
              />
              {/* Pinned stop no longer fits the remaining time — ask, don't drop it */}
              {pinnedTimeWarning && (
                <Card className="space-y-2 border-amber-300 bg-amber-50">
                  <p className="text-sm text-amber-800">📌 {pinnedTimeWarning}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => setPinnedTimeWarning(null)}
                    >
                      Keep going
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        const orig = walkInputRef.current;
                        if (!orig) return;
                        void handleBuildWalk(
                          {
                            ...orig,
                            availableMinutes: orig.availableMinutes + 15,
                          },
                          {
                            autoResume: true,
                            keepAttractions: walkPlanRef.current?.orderedAttractions,
                            pinnedIds: pinnedAttractionIdsRef.current,
                          },
                        );
                      }}
                    >
                      + 15 min
                    </Button>
                  </div>
                </Card>
              )}
              {/* Geometry warning banner (LOW-4) */}
              {walkPlan?.warnings?.some((w) => w.includes("geometry")) && (
                <Card>
                  <p className="text-sm text-amber-700">
                    ⚠️ Route geometry is unavailable (ORS API key not configured). Start Walk is disabled.
                  </p>
                </Card>
              )}
              <WalkRecordingPanel
                isRecording={isRecording}
                pointCount={recordedPointCount}
                onDownload={() => {
                  const points = walkRecorderRef.current?.getPoints() ?? [];
                  if (points.length > 0) downloadGpx(points, "My Walk", walkPlan?.orderedAttractions ?? []);
                }}
                onDownloadCsv={() => {
                  const points = walkRecorderRef.current?.getPoints() ?? [];
                  if (points.length > 0) downloadCsv(points, walkPlan?.orderedAttractions ?? [], "My Walk");
                }}
              />
              {walkPhase === "walking" && walkPlan && (
                <AttractionDistancesPanel
                  attractions={walkPlan.orderedAttractions}
                  attractionDistances={attractionDistances}
                  pinnedIds={pinnedAttractionIds}
                  onTogglePin={toggleAttractionPin}
                />
              )}
              {/* Loading skeleton while plan is being built (MEDIUM-5) */}
              {isWalkPlanLoading && (
                <Card className="space-y-2 animate-pulse">
                  <div className="h-4 w-1/2 rounded bg-slate-200" />
                  <div className="h-3 w-full rounded bg-slate-100" />
                  <div className="h-3 w-5/6 rounded bg-slate-100" />
                  <div className="h-3 w-4/6 rounded bg-slate-100" />
                </Card>
              )}
              {/* Retry affordance when plan is infeasible or attractions were dropped (MEDIUM-5) */}
              {!isWalkPlanLoading && walkPlan && lastWalkInput && (
                // A pinned stop can make a non-empty plan infeasible — that case has
                // its own prompt above, so don't claim nothing fit.
                (walkPlan.orderedAttractions.length === 0 ||
                  walkPlan.droppedAttractions.length > 0) && (
                  <Card className="space-y-2">
                    <p className="text-sm text-amber-700">
                      {walkPlan.orderedAttractions.length === 0
                        ? "No attractions fit your time budget."
                        : `Only ${walkPlan.orderedAttractions.length} of ${walkPlan.orderedAttractions.length + walkPlan.droppedAttractions.length} attractions fit — expand time or radius?`}
                    </p>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        void handleBuildWalk({
                          ...lastWalkInput,
                          availableMinutes: lastWalkInput.availableMinutes + 15,
                        });
                      }}
                    >
                      + 15 min and retry
                    </Button>
                  </Card>
                )
              )}
              <WalkPlanResults
                plan={walkPlan}
                error={walkPlanError}
                walkOrigin={lastWalkInput?.origin}
                walkMinutes={lastWalkInput?.availableMinutes}
                walkRadius={lastWalkInput?.radiusMeters}
              />
              <a
                href={lastWalkInput
                  ? `/tsp-debug?lat=${lastWalkInput.origin.lat}&lng=${lastWalkInput.origin.lng}&minutes=${lastWalkInput.availableMinutes}&radius=${lastWalkInput.radiusMeters}`
                  : "/tsp-debug"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                🔬 View TSP Graph
              </a>
              <TrailIntelligencePanel
                report={trailBriefing}
                isLoading={isTrailBriefingLoading}
                error={trailBriefingError}
              />
              {walkTrackingMessage ? (
                <Card>
                  <p className="text-sm text-amber-700">{walkTrackingMessage}</p>
                </Card>
              ) : null}
            </>
          ) : (
            <HikeSearchPanel
              isSearching={isSearching}
              originLatValue={hikeSearchOriginInput.lat}
              originLngValue={hikeSearchOriginInput.lng}
              onOriginInputChange={setHikeSearchOriginInput}
              useMapClickForOrigin={useMapClickForHikeOrigin}
              onUseMapClickForOriginChange={setUseMapClickForHikeOrigin}
              onFindHike={({
                origin,
                endpoint,
                maxDistanceKm,
                maxStartDistanceKm,
                maxFinishDistanceFromOriginKm,
                desiredRouteCount,
              }) => {
                void (async () => {
                  cancelSearch();
                  hikeSearchTokenRef.current += 1;
                  const searchToken = hikeSearchTokenRef.current;
                  const searchConstraints =
                    maxDistanceKm && maxDistanceKm > 0
                      ? {
                          ...constraints,
                          maxDistance: {
                            enabled: true,
                            maxKm: maxDistanceKm,
                          },
                        }
                      : constraints;

                  const result = await findHike(
                    {
                      origin,
                      endpoint,
                      preferences: {
                        maxDistanceMeters:
                          maxDistanceKm && maxDistanceKm > 0
                            ? maxDistanceKm * 1000
                            : undefined,
                        maxStartDistanceMeters:
                          maxStartDistanceKm && maxStartDistanceKm > 0
                            ? maxStartDistanceKm * 1000
                            : undefined,
                        maxFinishDistanceFromOriginMeters:
                          maxFinishDistanceFromOriginKm &&
                          maxFinishDistanceFromOriginKm > 0
                            ? maxFinishDistanceFromOriginKm * 1000
                            : undefined,
                        desiredRouteCount:
                          desiredRouteCount && desiredRouteCount > 0
                            ? desiredRouteCount
                            : 1,
                      },
                    },
                    searchConstraints,
                  );

                  // Abort if the state was cleared or the mode switched mid-flight
                  if (searchToken !== hikeSearchTokenRef.current || !result) {
                    return;
                  }

                  applyRoute(result.route);
                  setWaypoints(result.route.orderedWaypoints);
                  const firstPoint = result.route.geometry[0];
                  if (firstPoint) {
                    focusOn(firstPoint, 13);
                  }
                })();
              }}
            />
          )}

          <Card className="grid grid-cols-2 gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                hikeSearchTokenRef.current += 1;
                clearRoute();
              }}
            >
              Clear Route
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                clearWaypoints();
                clearRoute();
                cancelSearch();
                handleEndWalk();
                walkRecorderRef.current?.clear();
                setRecordedPointCount(0);
              }}
            >
              Clear All
            </Button>
          </Card>

          <RouteResults route={route} error={hikeSearchError ?? error} />
          {plannerMode !== "walk-companion" ? (
            <TrailIntelligencePanel
              report={trailBriefing}
              isLoading={isTrailBriefingLoading}
              error={trailBriefingError}
            />
          ) : null}
        </div>
      </aside>

      <section className="relative order-1 h-[45vh] min-h-[320px] flex-1 overflow-hidden lg:order-2 lg:h-full">
        <DynamicMap
          waypoints={waypoints}
          routeGeometry={
            walkPhase === "walking" ? remainingGeometry : (route?.geometry ?? [])
          }
          center={center}
          zoom={zoom}
          onMapClick={handleMapClick}
          currentPosition={currentPosition ?? undefined}
          followPosition={walkPhase === "walking"}
        />
      </section>
      </main>
    </>
  );
}
