"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { ConstraintPanel } from "@/components/constraints";
import { DynamicMap } from "@/components/map";
import {
  HikeSearchPanel,
  PlacePromptPanel,
  RouteResults,
  TrailIntelligencePanel,
  WalkCompanionPanel,
  WalkPlanResults,
} from "@/components/route";
import { DirectionOptionsSheet } from "@/components/walk/DirectionOptionsSheet";
import { WalkHud } from "@/components/walk/WalkHud";
import { detectedNote, mayAddToWalk } from "@/lib/walk/detected-note";
import type { WalkAlert } from "@/components/walk/WalkAlertCard";
import type { WalkStatsData } from "@/components/walk/WalkStatsBar";
import { WalkFinishCard, type WalkFinishData } from "@/components/walk/WalkFinishCard";
import { WalkFeedbackCard } from "@/components/walk/WalkFeedbackCard";
import { AssistantChat, type AssistantBuild } from "@/components/assistant/AssistantChat";
import type { WalkCompanionInput } from "@/components/route/WalkCompanionPanel";
import type {
  Attraction,
  AttractionCategory,
  NearbyPlace,
  WalkPlan,
} from "@/lib/types";
import { Button, Card } from "@/components/ui";
import { SideTabs, type SideTab } from "@/components/planner/SideTabs";
import { FriendsPanel } from "@/components/walks/FriendsPanel";
import { MyWalksPanel } from "@/components/walks/MyWalksPanel";
import { listFriends } from "@/lib/walks/friends";
import { SavedPlacePicker } from "@/components/places/SavedPlacePicker";
import { SavedPlacesTab } from "@/components/places/SavedPlacesTab";
import { markStopsVisited } from "@/lib/places/saved-places";
import { recordRun } from "@/lib/walks/walk-runs";
import { newWalkFromPlan, rebuildFromSaved, saveBuiltWalk, stopsFromAttractions, updateWalk, withWalkClient } from "@/lib/walks/walk-history";
import { PlaceSearch, WaypointList } from "@/components/waypoints";
import {
  useCollapseFlow,
  useConstraints,
  useHikeSearch,
  useIsSignedIn,
  useMapInteraction,
  useRouteCalculation,
  useTrailIntelligence,
  useWakeLock,
  useWalkSettings,
  useWalkTicker,
  useWaypoints,
} from "@/lib/hooks";
import type { Coordinates } from "@/lib/types";
import { haversineDistance } from "@/lib/utils/geo";
import { visitMinutes } from "@/lib/assistant/state";
import type { WalkSettings } from "@/lib/types/walk-settings";
import { downloadCsv, downloadGpx } from "@/lib/walk/gpx-exporter";
import { AttractionDistancesPanel } from "@/components/walk/AttractionDistancesPanel";
import { PACE_CONFIRMATION_TIMEOUT_MS } from "@/components/walk/PaceConfirmationNotification";
import { DEVIATION_CONFIRMATION_TIMEOUT_MS } from "@/components/walk/DeviationConfirmationNotification";
import { PaceChecker } from "@/lib/walk/pace-checker";
import { DeviationMonitor } from "@/lib/walk/deviation-monitor";
import { HeadingMonitor } from "@/lib/walk/heading-monitor";
import {
  detectDeviation,
  nextOffRouteState,
  remainingRoute,
} from "@/lib/walk/deviation-detector";
import {
  ADVISOR_CARD_TTL_MS,
  ADVISOR_STOP_QUIET_RADIUS_M,
  ENGINE_MAX_ACCURACY_M,
  LOCAL_REJOIN_COOLDOWN_MS,
  LOCAL_REJOIN_MAX_DEVIATION_M,
} from "@/lib/walk/walk-cadence";
import { SpeedEstimator } from "@/lib/walk/speed-estimator";
import { PaceAdvisor, type PaceAdvice } from "@/lib/walk/pace-advisor";
import {
  detourMinutes,
  isNearAnyStop,
  nextStopAlongM,
  progressAlong,
  routeDirectionDeg,
  timeToFinishMin,
} from "@/lib/walk/walk-stats";
import {
  rejoinCandidates,
  spliceRoute,
  turnInstruction,
} from "@/lib/walk/rejoin";
import { walkCopy } from "@/lib/walk/walk-copy";
import { WalkRecorder } from "@/lib/walk/walk-recorder";
import { WalkTracker } from "@/lib/walk/walk-tracker";
import type { PaceUpdate } from "@/lib/walk/walk-tracker";
import { SimulatedWalkTracker } from "@/lib/walk/simulated-walk-tracker";
import { WalkRecordingPanel } from "@/components/WalkRecordingPanel";
import { PoiAnnouncer, type Announcement } from "@/lib/walk/poi-announcer";
import { DiscoveryLoader, itemToPlace } from "@/lib/walk/discovery-loader";
import { STOP_QUIET_M } from "@/lib/walk/discovery-cadence";
import { calloutsSuppressed, canOfferAdd } from "@/lib/walk/detour-offer";
import { relatePlace } from "@/lib/walk/poi-relation";
import type { OfferedOption, OptionsContext } from "@/lib/walk/options-request";
import {
  VISIT_RADIUS_METERS,
  VisitTracker,
  excludeVisited,
} from "@/lib/walk/visit-tracker";
import {
  replanPaceDirection,
  ReplanTrigger,
  type ReplanReason,
} from "@/lib/walk/replan-trigger";
import {
  buildDeviationRebuildRequest,
  buildHeadingContinuedRebuildRequest,
  buildExtendedTimeRebuildRequest,
  buildOptionRebuildRequest,
  buildDropStopsRebuildRequest,
  buildPaceRebuildRequest,
  MIN_REBUILD_MINUTES,
  buildRecallRebuildRequest,
  promptWalkBuildOptions,
  setSimulatedPaceDrift,
  stopsLostInRebuild,
  toggleSimulatedStray,
  type LostStop,
  type SimulatedPaceDrift,
} from "@/lib/walk/planner-actions";
import { ConsentGate } from "@/components/onboarding/ConsentGate";
import { DroppedStopsPanel } from "@/components/walk/DroppedStopsPanel";
import { useWalkCompanion, type CompanionSnapshot } from "@/lib/hooks/useWalkCompanion";
import { useShortcutOffer } from "@/lib/hooks/useShortcutOffer";
import type { AmenityItem } from "@/lib/walk/companion/amenity-detour";
import { useWalkChat } from "@/lib/hooks/useWalkChat";
import { chatAmenityItems } from "@/lib/walk/chat/amenities";
import { WalkChatBox } from "@/components/walk/WalkChatBox";
import { shortcutCopy } from "@/lib/walk/shortcut";
import { useCommunityBadges, useSocialOptInSync } from "@/lib/hooks/useCommunityBadges";
import { cleanOsmPoiKeys, whitelistWalkEnd } from "@/lib/llm/walk-end-whitelist";
import { FORGOTTEN_EVENT } from "@/lib/preferences/forget-client";
import { parseMemoryWire, type CompanionMemoryWire } from "@/lib/preferences/companion-memory-wire";
import { planAmenityDetour } from "@/lib/walk/companion/amenity-route";
import {
  amenityForAnswer,
  amenityItemsFromPlaces,
  detectUiLang,
  pickAddPlace,
  pickGreenTarget,
  TowardGreenTracker,
} from "@/lib/walk/companion/companion-glue";
import type { AnsweredQuestion } from "@/lib/walk/companion/companion-engine";
import type { AmenityKind } from "@/lib/walk/companion/companion-types";
import { buildWalkEndInput, persistWalkEndFromBrowser } from "@/lib/walk/companion/walk-end";
import {
  buildHabitWalkEnd,
  FoodDwellTracker,
  resolveTimeZone,
} from "@/lib/walk/companion/habit-walk-end";
import { HabitHintChip } from "@/components/planner/HabitHintChip";
import type { HabitHint } from "@/lib/preferences/habit-hints";
import { foodAmenityItems } from "@/lib/walk/companion/habit-ticker";
import { companionText } from "@/lib/walk/companion-copy";
import {
  planDirectionOptions,
  routeDirectionOptions,
  type OfferTheme,
} from "@/lib/walk/options-request";
import { readTtsOptIn, ttsSupported, writeTtsOptIn } from "@/lib/walk/tts";

type PlannerMode = "manual" | "hike-search" | "walk-companion";

// One level of undo: the plan the walker was on before the last automatic re-plan.
interface PlanSnapshot {
  plan: WalkPlan;
  input: WalkCompanionInput;
  geometry: Coordinates[];
  startTime: number;
}

/* Iconoir-style glyph (1.5px stroke, round caps) — DESIGN.md forbids icon
   packages, and this is the only icon the planner needs. */
function IconExpand({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={1.5}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7" />
    </svg>
  );
}

function IconCollapse({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={1.5}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M20 4l-7 7m0 0h6m-6 0V5M4 20l7-7m0 0H5m6 0v6" />
    </svg>
  );
}

// Comfortably past `deviation-detector.ts`'s 50 m re-route threshold, and not
// so far that the stray leaves the map view it was triggered from.
const SIMULATED_STRAY_METERS = 80;

const REPLAN_FAILED_MESSAGE =
  "Couldn't build an updated route just now — keeping you on your current one.";

const MANUAL_RESUME_MESSAGE =
  "We reshaped your walk for your pace. Take a look, then press Start Walk when you're ready.";

// How long a build is allowed to take before we stop waiting for it.
//
// Building a walk runs Overpass discovery and a chain of ORS calls in sequence,
// and on a wide radius with several stops it legitimately takes a minute or
// more — 72s observed locally on 2026-08-18. Until now this request carried no
// deadline of its own at all, so where it gave up was whatever the browser
// decided, which is how a 42s build died on "Network error. Please try again."
// in the same session that a 72s one came back fine. The deadline is ours now,
// and it sits past the slowest real build rather than near the average one:
// this is a foreground action the walker is watching, so failing early on a
// request that was about to succeed costs far more than waiting.
const WALK_PLAN_TIMEOUT_MS = 120_000;

// A rebuild the walker did not ask for, while they are standing on a route that
// already works. Far shorter than the foreground deadline above: the old route
// is a safe place to fall back to, so there is no reason to keep them waiting
// two minutes for the new one.
const MIDWALK_REBUILD_TIMEOUT_MS = 45_000;

const REPLAN_CANCELLED_MESSAGE = "Kept your current route.";

// When a build stops looking normal and starts looking stuck. Well past a
// typical build, well short of the deadline — the walker is told it is still
// running, not that anything is wrong. Deliberately no retry behind it: a
// rebuild re-runs Overpass and ORS, so retrying a slow-but-succeeding request
// would double the load that made it slow.
const WALK_PLAN_SLOW_AFTER_MS = 20_000;

const WALK_PLAN_TIMEOUT_MESSAGE =
  "That took longer than we could wait. Try a smaller search radius or fewer stops.";

interface WalkPlannerAppProps {
  /** True while the frame around this planner fills the viewport. Only drives
      density — every control works identically in both states. */
  isExpanded?: boolean;
  /** Asks the frame around this planner to fill the viewport (or not). Called
      with `true` when a walk starts so the map gets the whole screen. */
  onRequestExpand?: (expanded: boolean) => void;
  /** The signed-in walker's saved pace and interests, read on the server. Passed
      straight through to the companion form, which opens on them. */
  suggestedPace?: number | null;
  suggestedCategories?: AttractionCategory[] | null;
}

// The planner fills whatever box it is given: the small embedded frame on /app
// and the same frame expanded to the viewport are the same mounted component,
// so nothing here may assume a viewport-sized container. Sizing is `h-full` and
// the breakpoints are container queries (`@4xl:`), not viewport ones.
export function WalkPlannerApp({
  isExpanded = false,
  onRequestExpand,
  suggestedPace = null,
  suggestedCategories = null,
}: WalkPlannerAppProps) {
  // Small-frame density. Never gates functionality — only padding and type size.
  const compact = !isExpanded;
  // The default experience is the City Walk flow alone. Manual/Hike planning,
  // the waypoint list, the constraints and the raw place search live behind the
  // "Advanced planning" escape hatch below.
  const [plannerMode, setPlannerMode] = useState<PlannerMode>("walk-companion");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
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
  // Plan-time routine chip from /api/walk-plan (fixed EN/HE text, consent-gated server side).
  const [habitHints, setHabitHints] = useState<HabitHint[]>([]);
  const [walkPlanError, setWalkPlanError] = useState<string | null>(null);
  const [isWalkPlanLoading, setIsWalkPlanLoading] = useState(false);
  // A build that is past `WALK_PLAN_SLOW_AFTER_MS` and still running.
  const [isWalkPlanSlow, setIsWalkPlanSlow] = useState(false);
  const {
    settings: walkSettings,
    setSettings: setWalkSettings,
    loaded: walkSettingsLoaded,
  } = useWalkSettings();
  const isSignedIn = useIsSignedIn();
  // Set when a walk ends: the stops that walk was made of, each of which the
  // walker can rate on its own. Null means "don't ask".
  const [feedbackAttractions, setFeedbackAttractions] = useState<
    Attraction[] | null
  >(null);
  const [showWalkedPath, setShowWalkedPath] = useState(true);
  const [finishData, setFinishData] = useState<WalkFinishData | null>(null);
  const walkInputRef = useRef<WalkCompanionInput | null>(null);
  const walkStartTimeRef = useRef<number>(0);
  const latestPaceUpdateRef = useRef<PaceUpdate | null>(null);
  // Read by the PaceChecker callback, which closes over a stale render's state.
  const walkPlanRef = useRef<WalkPlan | null>(null);
  const pinnedAttractionIdsRef = useRef<string[]>([]);
  const [pinnedAttractionIds, setPinnedAttractionIds] = useState<string[]>([]);
  const [previousPlan, setPreviousPlan] = useState<PlanSnapshot | null>(null);
  const [pinnedTimeWarning, setPinnedTimeWarning] = useState<string | null>(null);
  // What the mid-walk rebuilds have taken off this walk so far, and haven't
  // given back. A running total for the whole walk, not the last rebuild's —
  // see `stopsLostInRebuild`.
  const [lostStops, setLostStops] = useState<LostStop[]>([]);
  const walkTrackerRef = useRef<WalkTracker | SimulatedWalkTracker | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  // Set by the chat's start buttons; the effect below starts the walk once `isSimulating` has settled.
  const [startRequested, setStartRequested] = useState(false);
  // Whether the simulated walker is currently off the planned line. Mirrors the
  // tracker's own flag, which is a ref and so cannot re-label the button.
  const [isSimulatedStray, setIsSimulatedStray] = useState(false);
  // The stray is a routed detour now, so there is a network call between the
  // click and the walker moving off the line. Without this the button looks
  // dead for as long as ORS takes.
  const [isStrayLoading, setIsStrayLoading] = useState(false);
  const [strayNotice, setStrayNotice] = useState<string | null>(null);
  // Which way the simulated walker's pace has been pushed, for the buttons' state.
  const [simulatedPaceDrift, setSimulatedPaceDriftState] =
    useState<SimulatedPaceDrift>(null);
  const paceCheckerRef = useRef<PaceChecker | null>(null);
  const walkSettingsRef = useRef<WalkSettings>(walkSettings);
  const walkRecorderRef = useRef<WalkRecorder | null>(null);
  // What is near the route (loaded once per route, classified locally) and which
  // of it the walker has been told about. Both outlive a re-plan — a place seen
  // stays seen — and are cleared only when the walk ends.
  // The Discovery Collection is the registered tier of that store: one scan per
  // route geometry (plus the uncovered stretch of a splice), framed against the
  // route so callouts use cross-track left/right, never a noisy heading.
  const discoveryRef = useRef<DiscoveryLoader | null>(null);
  const announcerRef = useRef<PoiAnnouncer | null>(null);
  // Every accepted fix of this walk (the track the direction options must not
  // retrace) and where the walk began (the anchor when nothing else is).
  const walkedTrackRef = useRef<Coordinates[]>([]);
  const walkStartPointRef = useRef<Coordinates | null>(null);
  // Mirrors "a card is up" for the per-fix callout gate, which runs in a closure.
  const cardVisibleRef = useRef(false);
  // Written in the same place as the state they mirror, so the per-fix gate sees an
  // off-route / ask card on the very fix that raises it (before the next render).
  const offRouteDismissedRef = useRef(false);
  const deviationConfirmationRef = useRef(false);
  // The ONE "While you're here" line the off-route card may carry.
  const [whileHereNote, setWhileHereNote] = useState<string | null>(null);
  const [callouts, setCallouts] = useState<Announcement[]>([]);
  const [selectedCallout, setSelectedCallout] = useState<Announcement | null>(null);
  // Lives for the whole walk — a re-plan must not forget what was already seen.
  const visitTrackerRef = useRef<VisitTracker | null>(null);
  // Render mirror of the tracker's set: the tracker is a ref, so the stops list
  // can't strike a stop through until the ids reach state.
  const [visitedAttractionIds, setVisitedAttractionIds] = useState<string[]>([]);
  // Also lives for the whole walk: each re-plan builds a fresh PaceChecker, so a
  // trigger owned by the checker would reset its cooldown on every re-plan and
  // never actually throttle them.
  const replanTriggerRef = useRef<ReplanTrigger | null>(null);
  // The standing mid-walk question, for a direction the walker set to "ask".
  // Null when there is nothing to ask.
  const [paceConfirmation, setPaceConfirmation] = useState<ReplanReason | null>(
    null,
  );
  const paceConfirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  // Decides when being off route is worth acting on. Rebuilt per walk like the
  // PaceChecker; unlike the pace trigger it carries nothing across a re-plan,
  // because a re-plan is exactly the event that ends the excursion it was
  // watching.
  const deviationMonitorRef = useRef<DeviationMonitor | null>(null);
  // Which way the walker has been going, asked for at exactly one moment: when
  // the off-route question below lapses unanswered. Fed from the same throttled
  // handler as the deviation monitor so the two windows are measured off the
  // same cadence of fixes.
  const headingMonitorRef = useRef<HeadingMonitor | null>(null);
  // The standing "you're off route — redraw?" question, for `deviationMode: ask`.
  const [deviationConfirmation, setDeviationConfirmation] = useState(false);
  const deviationConfirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  // `isOffRoute` as a closure-safe read. The banner's timeout fires 90 seconds
  // after the render that armed it, and by then the state that render captured
  // may say the walker is still astray when they have long since rejoined.
  const isOffRouteRef = useRef(false);
  const buildWalkRequestIdRef = useRef(0);
  // Aborts the build in flight, if any: the overlay's "Keep my current route"
  // and End walk both go through it.
  const cancelBuildRef = useRef<(() => void) | null>(null);
  // Bumped whenever an in-flight hike search must be abandoned (clear / mode switch / unmount)
  const hikeSearchTokenRef = useRef(0);
  const lastGpsUpdateRef = useRef<number>(0);
  const walkGeometryRef = useRef<Coordinates[]>([]);
  // Where the walker was last matched onto `walkGeometryRef.current`, so the
  // next fix can be matched near it instead of anywhere on the route. Reset to
  // null whenever a walk starts — including the re-plan restart, which swaps in
  // new geometry an old index means nothing against.
  const lastSegmentIndexRef = useRef<number | null>(null);
  const [lastWalkInput, setLastWalkInput] = useState<WalkCompanionInput | null>(null);
  // Explicit mode: stops the user named in free text, applied to the next build.
  const [promptAttractions, setPromptAttractions] = useState<Attraction[] | null>(
    null,
  );
  // Whether those named stops are the whole walk or just its must-haves. Off
  // because naming three places and allowing three hours asks for three places,
  // not for as many places as three hours holds — leftover time is not a
  // request. The walker turns it on in the prompt panel when it is.
  const [fillPromptWalk, setFillPromptWalk] = useState(false);
  // Walk length read out of that same free text, handed to the companion panel
  // as a starting value for its time field. Null until a prompt states one.
  const [promptDurationMinutes, setPromptDurationMinutes] = useState<
    number | null
  >(null);
  // How many stops that same free text asked for ("bring me 3 famous places"),
  // and whether it asked for famous ones. Both describe the current prompt, not
  // the form, so they are sent with every build until a new prompt replaces
  // them — including the "+ 15 min and retry" rebuild, which is still the same
  // request for three places.
  const [promptStopCount, setPromptStopCount] = useState<number | null>(null);
  const [promptMaxEndDistanceKm, setPromptMaxEndDistanceKm] = useState<
    number | null
  >(null);
  const [promptSearchRadiusKm, setPromptSearchRadiusKm] = useState<
    number | null
  >(null);
  const [promptNotableOnly, setPromptNotableOnly] = useState(false);
  // The area that same free text named, geocoded — handed to the companion panel
  // as a starting value for its origin. Null until a prompt resolves one.
  const [promptOrigin, setPromptOrigin] = useState<Coordinates | null>(null);
  // Candidate pins for the places currently listed in PlacePromptPanel — shown
  // until they either become real waypoints or the list they came from is gone.
  const [previewPlaces, setPreviewPlaces] = useState<Attraction[]>([]);
  // Places the walker tapped "Add to walk" on before a walk exists; they join the next build.
  const [wishlist, setWishlist] = useState<Attraction[]>([]);
  // The chat's build callback outlives the render it was created in; read the latest queue through this ref.
  const wishlistRef = useRef(wishlist);
  wishlistRef.current = wishlist;
  const [recordedPointCount, setRecordedPointCount] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<Coordinates | null>(null);
  const [remainingGeometry, setRemainingGeometry] = useState<Coordinates[]>([]);
  const [isOffRoute, setIsOffRoute] = useState(false);
  // Every write to "is the walker off route" goes through here, so the ref and
  // the rendered badge can never disagree.
  const markOffRoute = (next: boolean) => {
    isOffRouteRef.current = next;
    setIsOffRoute(next);
  };
  const [walkPhase, setWalkPhase] = useState<"idle" | "planned" | "walking">("idle");
  // A full mid-walk rebuild tears tracking down (phase -> idle) and resumes it when
  // the new plan lands; keeping the walk screen up meanwhile stops the layout from
  // flipping back to the form for the length of an ORS/Overpass request.
  const [rebuildingMidWalk, setRebuildingMidWalk] = useState(false);
  const walkMode = walkPhase === "walking" || rebuildingMidWalk;
  const [chatOpen, setChatOpen] = useState(false);
  // The chat's onBuild closure can be older than the walk it reports on (replies take many seconds).
  const walkPhaseRef = useRef(walkPhase);
  walkPhaseRef.current = walkPhase;
  // The planning form is hidden while walking; this opens it as a bottom sheet.
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  // Live-walk instruments. Refs, not state: they are fed on every fix, and only
  // the numbers that reach the screen go through setState (once a second).
  const speedEstimatorRef = useRef<SpeedEstimator | null>(null);
  const paceAdvisorRef = useRef<PaceAdvisor | null>(null);
  const [paceAdvisory, setPaceAdvisory] = useState<{
    kind: PaceAdvice;
    at: number;
  } | null>(null);
  const [walkStats, setWalkStats] = useState<WalkStatsData | null>(null);
  // Timestamp (fix clock) of the first fix of this walk leg, for "elapsed".
  const firstFixAtRef = useRef<number | null>(null);
  // Fix clock vs wall clock: lets the ticker ask "what time is it on the fix
  // clock" between fixes without mixing the simulator's clock with Date.now().
  const lastFixWallRef = useRef<number>(0);
  // Where the last accepted fix matched onto the route.
  const matchedRef = useRef<{ segmentIndex: number; point: Coordinates } | null>(
    null,
  );
  // "Turn left, 80 m" while off route; null otherwise.
  const [offRouteHint, setOffRouteHint] = useState<string | null>(null);
  const [offRouteDismissed, setOffRouteDismissed] = useState(false);
  // A local rejoin is being routed (the "Show way back" tap has a network call
  // behind it) / when the last one succeeded, on the fix clock.
  const [isFindingWayBack, setIsFindingWayBack] = useState(false);
  const rejoinInFlightRef = useRef(false);
  const lastLocalRejoinAtRef = useRef(Number.NEGATIVE_INFINITY);
  const isUnmountedRef = useRef(false);
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
  const { center, zoom, clickMode, setClickMode, focusOn, focusTick } = useMapInteraction();

  // A walker who has gone clearly a different way is offered directions, never
  // an automatic re-plan. The machine runs on fix timestamps; `getOptionsContext`
  // reads the live walk at call time.
  const getOptionsContext = (): OptionsContext | null => {
    const fix = latestPaceUpdateRef.current;
    const input = walkInputRef.current;
    const discovery = discoveryRef.current;
    if (!fix || !input || !discovery) return null;
    const matched = matchedRef.current;
    const elapsedMin =
      firstFixAtRef.current === null
        ? 0
        : (fix.timestamp - firstFixAtRef.current) / 60_000;
    const visited = visitTrackerRef.current?.visitedIds ?? new Set<string>();
    return {
      origin: fix.currentPosition,
      // `/api/walk-options` needs an anchor: where the plan was heading, else where it began.
      endAnchor: input.endAnchor ?? walkStartPointRef.current,
      walked: walkedTrackRef.current,
      remainingMin: Math.max(
        MIN_REBUILD_MINUTES,
        input.availableMinutes - elapsedMin,
      ),
      speedMpm: 1000 / input.walkingPaceMinPerKm,
      // A satellite find is never a destination the app proposes.
      items: discovery.items().filter((i) => i.tier !== "detected"),
      excludeIds: new Set([...visited, ...discovery.offeredTwice()]),
      abandonedPlan: matched
        ? remainingRoute(walkGeometryRef.current, matched.segmentIndex, matched.point)
        : walkGeometryRef.current,
    };
  };
  const collapseFlow = useCollapseFlow({
    getContext: getOptionsContext,
    onShown: (options) =>
      discoveryRef.current?.markOffered([
        ...new Set(options.flatMap((o) => o.stops.map((s) => s.id))),
      ]),
    // Nothing to offer: no auto-pick. Only a walker who chose "redraw from here"
    // gets the old full re-plan; everyone else keeps the off-route card and the
    // route alone, as before the collapse existed.
    onNoOptions: () => {
      if (walkSettingsRef.current.deviationMode === "auto") runDeviationTriggeredRebuild();
    },
  });

  // Splice a new route in without re-planning (same steps as runLocalRejoin).
  const applySplicedRoute = (spliced: Coordinates[], atMs: number) => {
    if (walkTrackerRef.current === null) return;
    lastLocalRejoinAtRef.current = atMs;
    walkGeometryRef.current = spliced;
    lastSegmentIndexRef.current = null;
    matchedRef.current = { segmentIndex: 0, point: spliced[0] };
    setRemainingGeometry(spliced);
    walkTrackerRef.current.updateGeometry(spliced);
    discoveryRef.current?.setRoute(
      spliced,
      1000 / (walkInputRef.current?.walkingPaceMinPerKm ?? 15),
      walkInputRef.current?.preferredCategories ?? [],
    );
    void discoveryRef.current?.ensureCovered(spliced, atMs);
  };
  const shortcut = useShortcutOffer({
    getContext: () => {
      const fix = latestPaceUpdateRef.current;
      const matched = matchedRef.current;
      const input = walkInputRef.current;
      if (walkTrackerRef.current === null || !fix || !matched || !input) return null;
      const geometry = walkGeometryRef.current;
      const visited = visitTrackerRef.current?.visitedIds ?? new Set<string>();
      return {
        geometry,
        segmentIndex: matched.segmentIndex,
        matchedPoint: matched.point,
        position: fix.currentPosition,
        atMs: fix.timestamp,
        walkedM: progressAlong(geometry, matched.segmentIndex, matched.point).walkedM,
        stops: (walkPlanRef.current?.orderedAttractions ?? [])
          .filter((a) => !visited.has(a.id))
          .map((a) => ({ id: a.id, point: a.coordinates, label: a.name })),
        speedMps: 1000 / (60 * input.walkingPaceMinPerKm),
        blocked:
          isOffRouteRef.current ||
          rejoinInFlightRef.current ||
          collapseFlow.isCollapsed() ||
          deviationConfirmationRef.current ||
          (cardVisibleRef.current && !shortcutOfferRef.current),
      };
    },
    onApply: applySplicedRoute,
  });
  const shortcutOfferRef = useRef(shortcut.offer);
  shortcutOfferRef.current = shortcut.offer;

  // Take the standing mid-walk question down, and disarm the timer that would
  // have answered it. Called on every walk teardown as well as on an answer:
  // a question about a walk that has ended has nothing left to act on.
  const clearPaceConfirmation = () => {
    if (paceConfirmTimeoutRef.current !== null) {
      clearTimeout(paceConfirmTimeoutRef.current);
      paceConfirmTimeoutRef.current = null;
    }
    setPaceConfirmation(null);
  };

  const clearDeviationConfirmation = () => {
    if (deviationConfirmTimeoutRef.current !== null) {
      clearTimeout(deviationConfirmTimeoutRef.current);
      deviationConfirmTimeoutRef.current = null;
    }
    deviationConfirmationRef.current = false;
    setDeviationConfirmation(false);
  };

  // The fix clock's "now": the last fix's timestamp plus however much wall time
  // has passed since it arrived.
  const fixClockNow = (fixTimestamp: number) =>
    fixTimestamp + (Date.now() - lastFixWallRef.current);

  const refreshWalkStats = () => {
    const fix = latestPaceUpdateRef.current;
    const input = walkInputRef.current;
    const matched = matchedRef.current;
    const firstFixAt = firstFixAtRef.current;
    if (!fix || !input || !matched || firstFixAt === null) return;

    const now = fixClockNow(fix.timestamp);
    const speed = speedEstimatorRef.current?.current(now) ?? {
      kmh: null,
      state: "unknown" as const,
    };
    const { walkedM, remainingM } = progressAlong(
      walkGeometryRef.current,
      matched.segmentIndex,
      matched.point,
    );
    const visited = visitTrackerRef.current?.visitedIds ?? new Set<string>();
    const remainingVisitMin = (walkPlanRef.current?.orderedAttractions ?? [])
      .filter((a) => !visited.has(a.id))
      .reduce((sum, a) => sum + a.avgVisitMinutes, 0);
    const toFinish = timeToFinishMin({
      remainingM,
      kmh: speed.kmh,
      plannedPace: input.walkingPaceMinPerKm,
      remainingVisitMin,
    });
    const elapsedMin = Math.max(0, (now - firstFixAt) / 60_000);
    setWalkStats({
      kmh: speed.kmh,
      speedState: speed.state,
      plannedPaceMinPerKm: input.walkingPaceMinPerKm,
      timeToFinishMin: toFinish,
      elapsedMin,
      overBudget: elapsedMin + toFinish > input.availableMinutes * 1.05,
      distanceToFinishKm: remainingM / 1000,
      walkedM,
      remainingM,
    });
  };

  // Everything on the walk screen that runs on a schedule instead of per fix.
  const handleWalkTick = () => {
    const fix = latestPaceUpdateRef.current;
    if (!fix) return;
    const now = fixClockNow(fix.timestamp);

    const advisor = paceAdvisorRef.current;
    if (advisor) {
      const nearStop = isNearAnyStop(
        fix.currentPosition,
        walkPlanRef.current?.orderedAttractions ?? [],
        ADVISOR_STOP_QUIET_RADIUS_M,
      );
      const advice = advisor.evaluate(now, nearStop);
      // `at` is wall-clock on purpose: it times how long the card has been in
      // front of the walker, not a window of fixes — and the simulator's fix
      // clock runs 10x, which would take every card down after six seconds.
      if (advice) setPaceAdvisory({ kind: advice, at: Date.now() });
    }
    // An unanswered offer takes itself down; the next one is a fresh question.
    setPaceAdvisory((prev) =>
      prev && Date.now() - prev.at > ADVISOR_CARD_TTL_MS ? null : prev,
    );
    // A stalled GPS sends no fixes, so callout expiry cannot ride on them alone.
    const announcer = announcerRef.current;
    if (announcer) {
      const before = announcer.active();
      const after = announcer.expire(now);
      if (after.length !== before.length) setCallouts(after);
    }
    // Low-accuracy or missing fixes never reach feed(): the offer's TTL rides the clock.
    shortcut.expire();
    refreshWalkStats();
  };
  useWalkTicker(walkMode, handleWalkTick);
  useWakeLock(walkMode);

  const stopWalkTracking = () => {
    shortcut.clear();
    speedEstimatorRef.current = null;
    paceAdvisorRef.current = null;
    firstFixAtRef.current = null;
    matchedRef.current = null;
    setPaceAdvisory(null);
    setWalkStats(null);
    setOffRouteHint(null);
    offRouteDismissedRef.current = false;
    setOffRouteDismissed(false);
    setIsFindingWayBack(false);
    setIsDetailsOpen(false);
    setIsSimulatedStray(false);
    setSimulatedPaceDriftState(null);
    paceCheckerRef.current?.stop();
    paceCheckerRef.current = null;
    deviationMonitorRef.current = null;
    headingMonitorRef.current = null;
    walkTrackerRef.current?.stop();
    walkTrackerRef.current = null;
    walkRecorderRef.current?.stop();
    walkRecorderRef.current = null;
    lastGpsUpdateRef.current = 0;
    setIsRecording(false);
    setCurrentPosition(null);
    setRemainingGeometry([]);
    markOffRoute(false);
    setWalkPhase("idle");
    setWalkTrackingMessage(null);
    setAttractionDistances({});
    setCallouts([]);
    setSelectedCallout(null);
    clearPaceConfirmation();
    clearDeviationConfirmation();
    // Drops the options sheet and ignores a `/api/walk-options` answer still in
    // flight: End walk or a re-plan must not be undone by a late response.
    collapseFlow.clear();
    setWhileHereNote(null);
  };

  // Ending the walk tears down everything scoped to *this walk*, not just the GPS
  // session: `stopWalkTracking` alone leaves the revert snapshot armed, so the
  // "back to previous route" button would still be sitting there afterwards and
  // would restart tracking on a walk the user had already ended.
  useEffect(() => {
    if (!startRequested) return;
    setStartRequested(false);
    handleStartWalk();
    // handleStartWalk is rebuilt every render; this fires once per request, after isSimulating settled.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startRequested]);

  const handleEndWalk = () => {
    if (walkMode) {
      setFinishData({
        stops: walkPlanRef.current?.orderedAttractions.length ?? 0,
        elapsedMin: walkStats?.elapsedMin ?? 0,
        walkedKm: (walkStats?.walkedM ?? 0) / 1000,
      });
    }
    // Ask only about a walk that was actually walked, and only when there is
    // somewhere to put the answer: signed in, with preference learning on.
    // Asked before the teardown below, while the plan is still readable.
    if (
      walkMode &&
      isSignedIn &&
      walkSettings.preferenceLearningEnabled
    ) {
      const attractions = walkPlanRef.current?.orderedAttractions ?? [];
      if (attractions.length > 0) {
        setFeedbackAttractions(attractions);
      }
    }

    finishCompanionWalk();
    walkChat.reset();

    // Invalidate any in-flight (mid-walk) rebuild: its success and failure
    // paths both check the id before restarting tracking, and its `finally`
    // skips the loading flags once superseded.
    cancelBuildRef.current?.();
    buildWalkRequestIdRef.current += 1;
    setIsWalkPlanLoading(false);
    setIsWalkPlanSlow(false);
    stopWalkTracking();
    setRebuildingMidWalk(false);
    lastLocalRejoinAtRef.current = Number.NEGATIVE_INFINITY;
    setPreviousPlan(null);
    setPinnedTimeWarning(null);
    setLostStops([]);
    setPinnedAttractionIds([]);
    pinnedAttractionIdsRef.current = [];
    visitTrackerRef.current?.reset();
    setVisitedAttractionIds([]);
    replanTriggerRef.current = null;
    announcerRef.current = null;
    discoveryRef.current?.reset();
    collapseFlow.endWalk();
    shortcut.endWalk();
    walkedTrackRef.current = [];
    walkStartPointRef.current = null;
    // Queued saved places belonged to that walk; the next one starts clean.
    setWishlist([]);
  };

  // Full reset — the same teardown behind "Clear All" (advanced) and
  // "Start over" (simple view).
  const handleClearAll = () => {
    clearWaypoints();
    clearRoute();
    cancelSearch();
    handleEndWalk();
    setPreviewPlaces([]);
    walkRecorderRef.current?.clear();
    setRecordedPointCount(0);
  };

  // Draws a plan on the map and moves the walk into the "planned" phase. Shared by
  // the build path and the revert-to-previous-route path.
  // `keepViewport` is for mid-walk re-plans: the map is following the walker,
  // and re-centring on the first stop would yank it away from them.
  const showPlan = (
    plan: WalkPlan,
    geometry: Coordinates[],
    keepViewport = false,
  ) => {
    setWalkPlan(plan);
    walkPlanRef.current = plan;
    setWalkPhase("planned");
    walkGeometryRef.current = geometry;
    setRemainingGeometry(geometry);
    markOffRoute(false);
    setWalkTrackingMessage(null);
    // The candidates are in the plan now — they get numbered waypoint markers
    // below, so the amber "not committed yet" pins would only duplicate them.
    setPreviewPlaces([]);
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
    if (plan.orderedAttractions[0] && !keepViewport) {
      focusOn(plan.orderedAttractions[0].coordinates, 14);
    }
  };

  // `autoResume` is set only by the pace-triggered rebuild below: after a slow-pace
  // re-plan we jump straight back into live tracking instead of dropping the walker
  // on the "planned" screen. User-initiated rebuilds keep the manual Start Walk step.
  // `keepAttractions` pins the rebuild to the POIs the walker is already heading to
  // instead of re-running discovery — again, automatic path only. `fillRemainingTime`
  // relaxes that to "keep these, then discover more" for user-named stops.
  // Route rules (no repeats, streets to avoid) the assistant gave this walk; the
  // automatic rebuilds that pin `keepAttractions` reuse them, a fresh manual
  // build drops them.
  const routeRulesRef = useRef<AssistantBuild["routeRules"]>(undefined);

  // The saved_walks row of the walk on screen, so finishing it updates the same row.
  const savedWalkIdRef = useRef<Promise<string | null> | null>(null);
  const [walksVersion, setWalksVersion] = useState(0);
  const [sideTab, setSideTab] = useState<SideTab>("plan");
  const [friendRequests, setFriendRequests] = useState(0);
  useEffect(() => {
    if (!isSignedIn || sideTab === "friends") return;
    void withWalkClient((c) => listFriends(c)).then((rows) =>
      setFriendRequests((rows ?? []).filter((f) => f.status === "pending" && f.incoming).length),
    );
  }, [isSignedIn, sideTab]);
  const [walkBookmarked, setWalkBookmarked] = useState(false);

  const handleBuildWalk = async (
    input: WalkCompanionInput,
    options?: {
      autoResume?: boolean;
      /**
       * Whether an automatic rebuild ends in live tracking, or hands the walker
       * the new route to start themselves. Only read alongside `autoResume`,
       * and deliberately a second flag rather than just turning that one off:
       * everything else `autoResume` guards — the undo snapshot, the pins, the
       * visit history — still has to hold for a rebuild the walker didn't ask
       * for, or opting out of auto-resume would quietly plan stops they already
       * visited back into the route. Defaults to resuming.
       */
      resumeTracking?: boolean;
      keepAttractions?: Attraction[];
      /** Visit `keepAttractions` exactly in the given order instead of optimizing it. */
      fixedOrder?: boolean;
      /** The route the assistant already checked: shown as is (this build only, never on automatic rebuilds). */
      presetGeometry?: Coordinates[];
      /** Route rules from the assistant; remembered so automatic rebuilds keep them. */
      routeRules?: AssistantBuild["routeRules"];
      pinnedIds?: string[];
      fillRemainingTime?: boolean;
      heading?: number;
      /** Walk again: this build is another run of an existing saved walk, not a new history entry. */
      existingWalkId?: string;
      /** The stops were already chosen by the AI (the chat); skip the AI builder. */
      aiDecided?: boolean;
    },
  ) => {
    if (options?.routeRules !== undefined) routeRulesRef.current = options.routeRules;
    else if (options?.keepAttractions === undefined) routeRulesRef.current = undefined;
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

    if (snapshot) setRebuildingMidWalk(true);
    stopWalkTracking();
    walkInputRef.current = input;
    setLastWalkInput(input);
    walkStartTimeRef.current = Date.now();
    latestPaceUpdateRef.current = null;
    setPinnedTimeWarning(null);
    if (!options?.autoResume) {
      lastLocalRejoinAtRef.current = Number.NEGATIVE_INFINITY;
      setPreviousPlan(null);
      // A build the walker asked for starts a new walk, and a new walk has not
      // lost anything yet.
      setLostStops([]);
      setPinnedAttractionIds([]);
      pinnedAttractionIdsRef.current = [];
      visitTrackerRef.current?.reset();
      setVisitedAttractionIds([]);
      replanTriggerRef.current = null;
      announcerRef.current = null;
      discoveryRef.current?.reset();
      collapseFlow.endWalk();
      shortcut.endWalk();
      walkChat.reset();
      // A re-plan in the middle of a walk keeps the gray trail: it is still where the walker has been.
      if (walkPhase !== "walking") walkedTrackRef.current = [];
      walkStartPointRef.current = input.origin;
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
    setIsWalkPlanSlow(false);

    let cancelled = false;
    const controller = new AbortController();
    cancelBuildRef.current = () => {
      cancelled = true;
      controller.abort();
    };
    const deadline = window.setTimeout(
      () => controller.abort(),
      snapshot ? MIDWALK_REBUILD_TIMEOUT_MS : WALK_PLAN_TIMEOUT_MS,
    );
    const slowNotice = window.setTimeout(() => {
      if (requestId === buildWalkRequestIdRef.current) {
        setIsWalkPlanSlow(true);
      }
    }, WALK_PLAN_SLOW_AFTER_MS);

    try {
      // The AI decides the stops and their order; the planner below only measures that walk.
      // Skipped for a replay of a saved walk and for a route the chat's AI already built.
      let aiStops: Attraction[] | undefined;
      let aiGeometry: Coordinates[] | undefined;
      if (isSignedIn && !options?.existingWalkId && !options?.presetGeometry && !options?.aiDecided && !options?.autoResume) {
        const chosenByWalker = !options?.autoResume && keepAttractions ? keepAttractions.map((a) => a.id) : [];
        const reason = options?.autoResume
          ? "re-plan in the middle of the walk: the walker is at the start point given, and the limits are what is left"
          : keepAttractions
            ? "the walker changed the stops of the walk; the listed stops are their choice"
            : "a new walk";
        const aiRes = await fetch("/api/ai-walk-plan", {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            origin: input.origin,
            reason,
            availableMinutes: input.availableMinutes,
            walkingPaceMinPerKm: input.walkingPaceMinPerKm,
            radiusMeters: input.radiusMeters,
            maxEndDistanceMeters: input.maxEndDistanceFromOriginMeters,
            routeRules: routeRulesRef.current,
            keep: keepAttractions,
            pinnedIds: [...new Set([...activePinnedIds, ...chosenByWalker])],
            visitedIds: [...visitedIds],
            preferredCategories: input.preferredCategories,
            stopCount: promptStopCount ?? undefined,
            notableOnly: promptNotableOnly,
            heading: options?.heading,
            fillRemainingTime: options?.fillRemainingTime ?? false,
          }),
        });
        const ai = (await aiRes.json().catch(() => ({}))) as { stops?: Attraction[]; geometry?: Coordinates[] | null; error?: string };
        if (requestId !== buildWalkRequestIdRef.current) return;
        if (!aiRes.ok || !ai.stops?.length) {
          if (snapshot) {
            revertToSnapshot(snapshot);
            setWalkTrackingMessage(REPLAN_FAILED_MESSAGE);
            return;
          }
          // The AI itself failed (not sign-in, budget or bad input): the rule-based planner can still build the walk.
          if (aiRes.status !== 502) {
            setWalkPlanError(ai.error ?? "The AI could not build a walk that fits.");
            return;
          }
        } else {
          aiStops = ai.stops;
          aiGeometry = ai.geometry ?? undefined;
        }
      }
      const res = await fetch("/api/walk-plan", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: input.origin.lat,
          lng: input.origin.lng,
          availableMinutes: input.availableMinutes,
          walkingPaceMinPerKm: input.walkingPaceMinPerKm,
          radiusMeters: input.radiusMeters,
          maxEndDistanceFromOriginMeters: input.maxEndDistanceFromOriginMeters,
          endAnchor: input.endAnchor,
          preferredCategories: input.preferredCategories,
          explicitAttractions: aiStops ?? keepAttractions,
          fixedOrder: aiStops || options?.fixedOrder === true ? true : undefined,
          presetGeometry: aiGeometry ?? options?.presetGeometry,
          ...routeRulesRef.current,
          pinnedAttractionIds: activePinnedIds,
          fillRemainingTime: options?.fillRemainingTime ?? false,
          heading: options?.heading,
          stopCount: promptStopCount ?? undefined,
          notableOnly: promptNotableOnly,
          learnPreferences: walkSettings.preferenceLearningEnabled,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      const data = (await res.json()) as WalkPlan & { error?: string; habitHints?: HabitHint[] };

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
      } else if (snapshot && (data.orderedAttractions.length === 0 || (data.geometry?.length ?? 0) < 2)) {
        // A route with no stops or no line would drop the walker out of the walk; keep the one they were on.
        revertToSnapshot(snapshot);
        setWalkTrackingMessage(REPLAN_FAILED_MESSAGE);
      } else {
        showPlan(data, data.geometry ?? [], options?.autoResume === true);
        // A walk the walker asked for is saved as "planned"; automatic rebuilds are the same walk.
        if (!options?.autoResume && isSignedIn && data.orderedAttractions.length > 0) {
          setWalkBookmarked(false);
          savedWalkIdRef.current = options?.existingWalkId
            ? Promise.resolve(options.existingWalkId)
            : saveBuiltWalk(
                newWalkFromPlan(input, data.orderedAttractions, data.totalMinutes, data.totalDistanceMeters, routeRulesRef.current as Record<string, unknown> | undefined),
              ).then((id) => {
                setWalksVersion((v) => v + 1);
                return id;
              });
        }
        applyCompanionMemory((data as { companionMemory?: unknown }).companionMemory);
        setHabitHints(Array.isArray(data.habitHints) ? data.habitHints : []);

        // What this rebuild cost. Only on the automatic path — a snapshot is
        // exactly "there was a walk under way that this replaced", and a build
        // the walker asked for has no before to be missing anything from.
        if (snapshot) {
          setLostStops((prev) =>
            stopsLostInRebuild({
              alreadyLost: prev,
              before: snapshot.plan.orderedAttractions,
              requested: keepAttractions,
              after: data.orderedAttractions,
              // Re-read rather than reusing the set from before the request:
              // the walker kept walking while it was in flight.
              visitedIds:
                visitTrackerRef.current?.visitedIds ?? new Set<string>(),
            }),
          );
        }

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
          if (options.resumeTracking === false) {
            // Opted out of auto-resume: the walk is already stopped and the new
            // plan is on screen, so all that's missing is telling the walker why
            // they're looking at it.
            setWalkTrackingMessage(MANUAL_RESUME_MESSAGE);
          } else {
            handleStartWalk(data);
          }
        }
      }
    } catch {
      if (requestId !== buildWalkRequestIdRef.current) return;
      if (snapshot) {
        revertToSnapshot(snapshot);
        setWalkTrackingMessage(
          cancelled ? REPLAN_CANCELLED_MESSAGE : REPLAN_FAILED_MESSAGE,
        );
      } else {
        // Our own deadline firing and the network dropping are different
        // things, and telling them apart is the difference between "try again"
        // and "ask for less" — the second is the only one that helps here.
        setWalkPlanError(
          controller.signal.aborted
            ? WALK_PLAN_TIMEOUT_MESSAGE
            : "Network error. Please try again.",
        );
      }
    } finally {
      window.clearTimeout(deadline);
      window.clearTimeout(slowNotice);
      if (requestId === buildWalkRequestIdRef.current) {
        cancelBuildRef.current = null;
        setIsWalkPlanLoading(false);
        setIsWalkPlanSlow(false);
        setRebuildingMidWalk(false);
      }
    }
  };

  // The rebuild a pace trigger asks for: re-time the walk the walker is already
  // on from where they are now, and drop them straight back into tracking.
  // Extracted from the PaceChecker callback so the "ask first" path can run
  // exactly the same rebuild once the walker says yes.
  //
  // The direction decides whether discovery runs. Behind plan, the answer is to
  // re-time what is left. Ahead of plan, the whole offer — in the banner and in
  // the setting's own wording — is another stop, and re-timing the same list
  // would have delivered nothing while telling the walker it had.
  // Where the walk actually is, in the shape every mid-walk rebuild builder
  // reads it. Null when there is nothing to rebuild — no input, or no live
  // tracker, since only rebuilding while the user is actually walking is
  // CRITICAL-2 and the tracker still being alive is how these closures read
  // that (they cannot see `walkPhase` from a render they did not participate in).
  const midWalkRebuildState = () => {
    const orig = walkInputRef.current;
    if (!orig) return null;
    if (walkTrackerRef.current === null) return null;
    return {
      originalInput: orig,
      walkStartTime: walkStartTimeRef.current,
      now: Date.now(),
      // Only a trustworthy fix (<=50 m, see `onPositionUpdate`) or the point
      // the walker matched onto the route — never a fix with a wide error
      // circle, which is how a rebuild once started 100 m from the walker.
      currentPosition:
        latestPaceUpdateRef.current?.currentPosition ??
        matchedRef.current?.point ??
        null,
      settings: walkSettingsRef.current,
      currentAttractions: walkPlanRef.current?.orderedAttractions,
      pinnedIds: pinnedAttractionIdsRef.current,
      currentPaceMinPerKm: latestPaceUpdateRef.current?.paceMinPerKm ?? null,
    };
  };

  // "Add a stop" buttons hand the choice to the chat model (owner only for now; the chat
  // falls back to the plain rebuild for everyone else). TODO: paid tier.
  const askForStopRef = useRef<(() => void) | null>(null);
  const addStopViaChat = (reason: ReplanReason) => {
    if (askForStopRef.current) askForStopRef.current();
    else runPaceTriggeredRebuild(reason);
  };

  const runPaceTriggeredRebuild = (reason: ReplanReason) => {
    const state = midWalkRebuildState();
    if (!state) return;
    const lastFix = latestPaceUpdateRef.current;
    const heading = lastFix
      ? headingMonitorRef.current?.recentHeading(lastFix.timestamp) ?? undefined
      : undefined;
    const { input, options } = buildPaceRebuildRequest(reason, state, heading);
    void handleBuildWalk(input, options);
  };

  // The other answer to the slow-pace question: keep every stop and buy the
  // time to reach them at the pace the walker is actually managing.
  const runExtendedTimeRebuild = () => {
    const state = midWalkRebuildState();
    if (!state) return;
    const { input, options } = buildExtendedTimeRebuildRequest(state);
    void handleBuildWalk(input, options);
  };

  // The assistant found a place and the walker tapped "Add": keep every stop,
  // pin the new one, and buy the time to reach all of them.
  const runAddPlaceRebuild = (name: string, coordinates: { lat: number; lng: number }) => {
    const state = midWalkRebuildState();
    if (!state) return;
    const id = `chat-${Math.round(coordinates.lat * 1e5)}-${Math.round(coordinates.lng * 1e5)}`;
    const added = { id, name, coordinates, category: "other" as const, avgVisitMinutes: 20, tags: { name } };
    const { input, options } = buildExtendedTimeRebuildRequest({
      ...state,
      currentAttractions: [...(state.currentAttractions ?? []), added],
      pinnedIds: [...state.pinnedIds, id],
    });
    void handleBuildWalk(input, options);
  };

  // Several chat proposals at once: drop the skipped stops, pin the new ones, one rebuild.
  const runApplyChangesRebuild = (adds: Array<{ name: string; coordinates: { lat: number; lng: number } }>, dropStopIds: string[]) => {
    const state = midWalkRebuildState();
    if (!state) return;
    const drop = new Set(dropStopIds);
    const added = adds.map(({ name, coordinates }) => ({
      id: `chat-${Math.round(coordinates.lat * 1e5)}-${Math.round(coordinates.lng * 1e5)}`,
      name,
      coordinates,
      category: "other" as const,
      avgVisitMinutes: 20,
      tags: { name },
    }));
    const kept = (state.currentAttractions ?? []).filter((a) => !drop.has(a.id));
    const { input, options } = buildExtendedTimeRebuildRequest({
      ...state,
      currentAttractions: [...kept, ...added],
      pinnedIds: [...state.pinnedIds.filter((id) => !drop.has(id)), ...added.map((a) => a.id)],
    });
    void handleBuildWalk(input, options);
  };

  // --- Walk companion --------------------------------------------------------
  // One question slot for the whole walk: `useWalkCompanion` ticks, the arbiter
  // picks, `handleCompanionAnswer` runs the operator. The decisions are in
  // `lib/walk/companion/*`; this is only the wiring to the screen's refs.
  // The layout's lang as first rendered, before this component writes its own
  // answer to <html lang>; used only when the browser reports no language.
  const layoutLangRef = useRef<string | null>(
    typeof document !== "undefined" ? document.documentElement.lang : null,
  );
  const uiLang =
    walkSettings.uiLanguage !== "auto"
      ? walkSettings.uiLanguage
      : detectUiLang(
          layoutLangRef.current,
          typeof navigator !== "undefined" ? navigator.language : null,
        );
  useEffect(() => {
    document.documentElement.lang = uiLang;
    document.documentElement.dir = uiLang === "he" ? "rtl" : "ltr";
  }, [uiLang]);
  // Social layer: all no-ops unless NEXT_PUBLIC_SOCIAL=1 and the walker opted in.
  useSocialOptInSync(isSignedIn, walkSettingsLoaded, (optedIn) => {
    if (optedIn !== walkSettings.socialSharingEnabled) setWalkSettings({ socialSharingEnabled: optedIn });
  });
  const communityAggregates = useCommunityBadges(
    (walkPlan?.orderedAttractions ?? []).map((a) => a.id),
    walkSettings.socialSharingEnabled,
    isSignedIn,
  );
  const companionMemoryRef = useRef<CompanionMemoryWire | null>(null);
  const companionQuestionUpRef = useRef(false);
  const greenTrackerRef = useRef(new TowardGreenTracker());
  // Food/cafe dwells for the routine-habit model (kept in memory, only with consent).
  const foodDwellRef = useRef(new FoodDwellTracker());
  const [voiceOn, setVoiceOn] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  useEffect(() => {
    setVoiceOn(readTtsOptIn());
    setVoiceSupported(ttsSupported());
  }, []);

  // Water / toilets near the route as the companion needs them, and the walker's place along it.
  const companionRouteState = () => {
    const discovery = discoveryRef.current;
    const matched = matchedRef.current;
    if (!discovery) return null;
    return {
      discovery,
      matched,
      walkerAlongM: matched ? discovery.alongM(matched.segmentIndex, matched.point) : null,
    };
  };

  const getCompanionSnapshot = (): CompanionSnapshot | null => {
    const fix = latestPaceUpdateRef.current;
    const input = walkInputRef.current;
    const route = companionRouteState();
    if (!fix || !input || !route || walkTrackerRef.current === null) return null;
    const { discovery, walkerAlongM } = route;
    const visited = visitTrackerRef.current?.visitedIds ?? new Set<string>();
    const remainingStops = (walkPlanRef.current?.orderedAttractions ?? [])
      .filter((a) => !visited.has(a.id))
      .map((a) => ({
        id: a.id,
        name: a.name,
        pinned: pinnedAttractionIdsRef.current.includes(a.id),
      }));
    const speedMpm = 1000 / input.walkingPaceMinPerKm;
    const remainingWalkMin =
      walkStats?.timeToFinishMin ??
      Math.max(0, input.availableMinutes - (walkStats?.elapsedMin ?? 0));
    const environment = discovery.environment;
    const items = discovery.items();
    const pace =
      paceAdvisory && fix.paceMinPerKm
        ? {
            advice: paceAdvisory.kind,
            currentPaceMinPerKm: fix.paceMinPerKm,
            plannedPaceMinPerKm: input.walkingPaceMinPerKm,
          }
        : null;
    const heading = headingMonitorRef.current?.recentHeading(fix.timestamp) ?? null;
    const target = pickGreenTarget(items, fix.currentPosition, heading);
    const headingTowardM = greenTrackerRef.current.update(
      target ? { id: target.item.id, distanceM: target.distanceM } : null,
    );
    const blocked =
      (walkAlert !== null &&
        !walkAlert.id.startsWith("companion-") &&
        !/^pace-(slow|fast)$/.test(walkAlert.id)) ||
      collapseFlow.offer !== null ||
      collapseFlow.isCollapsed();
    const habitOn = walkSettingsRef.current.learningConsent === "granted";
    return {
      tick: {
        nowMs: fix.timestamp,
        position: fix.currentPosition,
        environment,
        speedMpm,
        remainingWalkMin,
        remainingStops,
        pace,
        addPlace:
          paceAdvisory?.kind === "fast"
            ? pickAddPlace(items, { speedMpm, remainingWalkMin, environment })
            : null,
        amenities: [
          ...amenityItemsFromPlaces(discovery.amenities(), (p) => discovery.frameOf(p)),
          // Food/cafe places (routine questions and their "take me" answer), consent only.
          ...(habitOn ? foodAmenityItems(items) : []),
        ],
        habit: habitOn
          ? {
              habits: companionMemoryRef.current?.habits ?? [],
              timeZone: resolveTimeZone(
                fix.currentPosition,
                Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
              ),
              foodEvents: foodDwellRef.current.events,
              items,
            }
          : null,
        walkerAlongM,
        green: target
          ? { parkName: target.item.attraction.name, score: target.item.score, headingTowardM }
          : null,
      },
      ctx: {
        level: walkSettingsRef.current.calloutLevel,
        nearTurn: walkerAlongM !== null && discovery.isNearTurn(walkerAlongM),
        otherCardUp: blocked,
      },
    };
  };

  // Each rebuild takes its cap as an argument: a cap is one answer's, never state.
  const runCappedPaceRebuild = (reason: ReplanReason, capMin?: number) => {
    const state = midWalkRebuildState();
    if (!state) return;
    const { input, options } = buildPaceRebuildRequest(
      reason,
      capMin !== undefined ? { ...state, capMin } : state,
    );
    void handleBuildWalk(input, options);
  };

  const runDropStopsRebuild = (dropStopIds: string[], capMin?: number) => {
    const state = midWalkRebuildState();
    if (!state) return;
    const { input, options } = buildDropStopsRebuildRequest(state, dropStopIds, capMin);
    void handleBuildWalk(input, options);
  };

  // A direction the walker did not pick from the sheet: only used for "head
  // back" and "loop from here" answers, which name the theme themselves.
  const applyOfferedOption = (option: OfferedOption) => {
    const state = midWalkRebuildState();
    if (!state) return;
    collapseFlow.resolve();
    if (option.stops.length === 0) {
      startFromOptionRoute(option);
      return;
    }
    const { input, options } = buildOptionRebuildRequest(
      state,
      option.stops.map((s) => s.attraction),
    );
    void handleBuildWalk(input, options);
  };

  // Falls back to the full options sheet when the theme cannot be routed.
  const runThemedOption = async (theme: OfferTheme) => {
    const ctx = getOptionsContext();
    if (!ctx) return;
    let pick: OfferedOption | undefined;
    try {
      const built = planDirectionOptions(ctx).filter((o) => o.theme === theme);
      if (built.length > 0) {
        pick = (await routeDirectionOptions(ctx, built)).find((o) => o.theme === theme);
      }
    } catch {
      pick = undefined;
    }
    if (walkTrackerRef.current === null) return;
    if (!pick) {
      collapseFlow.offerDifferent();
      return;
    }
    discoveryRef.current?.markOffered(pick.stops.map((s) => s.id));
    applyOfferedOption(pick);
  };

  const runAmenityDetour = async (
    kind: AmenityKind,
    snap: CompanionSnapshot | null,
    preset?: AmenityItem,
  ) => {
    const fix = latestPaceUpdateRef.current;
    const matched = matchedRef.current;
    const discovery = discoveryRef.current;
    if (!snap || !fix || !matched || !discovery || walkTrackerRef.current === null) return;
    const pick = preset ? { item: preset } : amenityForAnswer(snap.tick, kind);
    const requestGeometry = walkGeometryRef.current;
    const spliced = pick
      ? await planAmenityDetour({
          geometry: requestGeometry,
          segmentIndex: matched.segmentIndex,
          position: fix.currentPosition,
          amenity: pick.item.coordinates,
          amenityAlongM: pick.item.alongM ?? null,
          walkerAlongM: snap.tick.walkerAlongM ?? 0,
        })
      : null;
    // The walk may have ended, or been re-planned, while this was in flight.
    if (walkTrackerRef.current === null || walkGeometryRef.current !== requestGeometry) return;
    if (!spliced) {
      setWalkTrackingMessage(companionText(uiLang, "notice.amenityFailed"));
      return;
    }
    walkGeometryRef.current = spliced;
    lastSegmentIndexRef.current = null;
    matchedRef.current = { segmentIndex: 0, point: spliced[0] };
    setRemainingGeometry(spliced);
    walkTrackerRef.current.updateGeometry(spliced);
    discovery.setRoute(
      spliced,
      1000 / (walkInputRef.current?.walkingPaceMinPerKm ?? 15),
      walkInputRef.current?.preferredCategories ?? [],
    );
    void discovery.ensureCovered(spliced, fix.timestamp);
  };

  const handleCompanionAnswer = (answered: AnsweredQuestion, snap: CompanionSnapshot | null) => {
    const action = answered.action;
    switch (action.run) {
      case "none":
        return;
      case "pace-rebuild":
        runCappedPaceRebuild(action.reason, action.capMin);
        return;
      case "drop-stops":
        runDropStopsRebuild(action.dropStopIds, action.capMin);
        return;
      case "extended-time-rebuild":
        runExtendedTimeRebuild();
        return;
      case "walk-options-roundtrip":
        void runThemedOption(action.theme);
        return;
      case "amenity-detour":
        void runAmenityDetour(action.kind, snap);
        return;
      case "head-back":
        void runThemedOption("short");
        return;
      default: {
        const never: never = action;
        return never;
      }
    }
  };

  const companion = useWalkCompanion({
    active: walkPhase === "walking",
    lang: uiLang,
    voice: voiceOn,
    getSnapshot: getCompanionSnapshot,
    // A pace question asked here replaces the older pace card, not joins it.
    onShown: (cand) => {
      if (cand.kind === "pace-slow" || cand.kind === "pace-fast") setPaceAdvisory(null);
    },
    onAnswered: handleCompanionAnswer,
  });

  // "Forget everything" succeeded on the server: drop the in-memory copy too, so
  // the next walk end cannot write the old memory back.
  useEffect(() => {
    const onForgotten = () => {
      companionMemoryRef.current = null;
      companion.setPriors({});
      discoveryRef.current?.setMemory([], 0);
    };
    window.addEventListener(FORGOTTEN_EVENT, onForgotten);
    return () => window.removeEventListener(FORGOTTEN_EVENT, onForgotten);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyCompanionMemory = (raw: unknown) => {
    const wire = parseMemoryWire(raw);
    if (!wire) return;
    companionMemoryRef.current = wire;
    companion.setPriors(wire.priors);
    discoveryRef.current?.setMemory(wire.interactions, wire.sessionCount);
  };

  // At walk end: write the summary (consent-gated, needs a loaded memory so the
  // session clock and the pace history are real), then forget the walk.
  const finishCompanionWalk = () => {
    const memory = companionMemoryRef.current;
    const discovery = discoveryRef.current;
    const input = walkInputRef.current;
    if (walkMode && isSignedIn && (walkStats?.elapsedMin ?? 0) >= 1) {
      // Saved places that were on this walk and visited get the "visited" mark (others are ignored).
      const seen = visitTrackerRef.current?.visitedIds ?? new Set<string>();
      const visitedStops = (walkPlanRef.current?.orderedAttractions ?? []).filter((a) => seen.has(a.id));
      if (visitedStops.length > 0) void markStopsVisited(stopsFromAttractions(visitedStops));
    }
    if (walkMode && isSignedIn && savedWalkIdRef.current && (walkStats?.elapsedMin ?? 0) >= 1) {
      const row = savedWalkIdRef.current;
      const done = { status: "completed" as const, totalMin: walkStats?.elapsedMin ?? 0, distanceM: walkStats?.walkedM ?? 0 };
      void row
        .then(async (id) => {
          if (!id) return false;
          void recordRun(id, { startedAt: new Date(walkStartTimeRef.current).toISOString(), finishedAt: new Date().toISOString(), minutes: done.totalMin, distanceM: done.distanceM });
          return updateWalk(id, done);
        })
        .then(() => setWalksVersion((v) => v + 1));
    }
    if (
      walkMode &&
      isSignedIn &&
      walkSettings.preferenceLearningEnabled &&
      memory &&
      discovery &&
      input &&
      (walkStats?.elapsedMin ?? 0) >= 1
    ) {
      const visited = visitTrackerRef.current?.visitedIds ?? new Set<string>();
      const stops = walkPlanRef.current?.orderedAttractions ?? [];
      const walkEndInput = buildWalkEndInput({
          learnPreferences: true,
          startedAtMs: walkStartTimeRef.current,
          plannedMin: input.availableMinutes,
          actualMin: walkStats?.elapsedMin ?? 0,
          distanceM: walkStats?.walkedM ?? 0,
          environment: discovery.environment,
          stopsPlanned: stops.length,
          stopsVisited: stops.filter((a) => visited.has(a.id)).length,
          records: companion.records(),
          collapseCount: 0,
          items: discovery.items(),
          paceMinPerKm: latestPaceUpdateRef.current?.paceMinPerKm ?? null,
          // Routine habits: local-time bins only, and only with the granted consent.
          habits:
            walkSettings.learningConsent === "granted"
              ? buildHabitWalkEnd({
                  startedAtMs: walkStartTimeRef.current,
                  actualMin: walkStats?.elapsedMin ?? 0,
                  timeZone: resolveTimeZone(
                    latestPaceUpdateRef.current?.currentPosition ?? null,
                    Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
                  ),
                  records: companion.records(),
                  foodEvents: foodDwellRef.current.events,
                })
              : null,
        });
      void persistWalkEndFromBrowser(walkEndInput, memory.sessionCount, memory.paceByEnv);
      // LLM-written note for next time. Only with the consent from the first-run
      // screen; walk facts are numbers and enums, never coordinates or names.
      void fetch("/api/session-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          learnPreferences: walkSettings.learningConsent === "granted",
          routine: walkSettings.learningConsent === "granted",
          uiLang,
          walkEnd: whitelistWalkEnd(walkEndInput as unknown as Record<string, unknown>),
          // Only real OSM ids leave the device; local memory keeps every key.
          poiKeys: cleanOsmPoiKeys((walkEndInput.interactions ?? []).map((i) => i.poiKey)),
        }),
      }).catch(() => undefined);
    }
    companion.reset();
    foodDwellRef.current.reset();
    companionMemoryRef.current = null;
    greenTrackerRef.current = new TowardGreenTracker();
  };

  // The rebuild an off-route trigger asks for: the same walk, redrawn to start
  // from wherever the walker actually is. Same guards as the pace rebuild, and
  // the same request-building helper underneath — see
  // `buildDeviationRebuildRequest` for why the two share it.
  const runDeviationTriggeredRebuild = () => {
    const state = midWalkRebuildState();
    if (!state) return;
    const { input, options } = buildDeviationRebuildRequest(state);
    void handleBuildWalk(input, options);
  };

  /**
   * Get a straying walker back onto the route they already have, without
   * re-planning anything: pick a couple of points ahead on the old route, ask
   * ORS for a street-following way to the better one, and splice it in front of
   * the rest of the route. Stops, their order and the GPS watch are untouched —
   * which is the point; `handleBuildWalk` would tear all three down.
   *
   * Never draws a straight line. If it cannot get a real street route (offline,
   * quota, implausible detour) it falls back to the full re-plan from here — the
   * second such failure collapses the walk into direction options instead. A
   * walker too far away for "back on the route" to be honest is, when the
   * rejoin was started automatically, left to the collapse (options after 60 s);
   * when they asked for it, they get the full re-plan from here.
   */
  const runLocalRejoin = async (auto = false) => {
    const fix = latestPaceUpdateRef.current;
    const matched = matchedRef.current;
    const geometry = walkGeometryRef.current;
    if (walkTrackerRef.current === null) return;
    if (rejoinInFlightRef.current) return;
    // Options are on screen (or being fetched): nothing re-plans on its own.
    if (collapseFlow.isCollapsed()) return;
    const rejoinFailed = () => {
      if (fix && collapseFlow.rejoinFailed(fix.timestamp)) return;
      runDeviationTriggeredRebuild();
    };
    if (!fix || !matched || geometry.length < 2) {
      runDeviationTriggeredRebuild();
      return;
    }
    if (fix.timestamp - lastLocalRejoinAtRef.current < LOCAL_REJOIN_COOLDOWN_MS) {
      return;
    }
    const from = fix.currentPosition;
    if (haversineDistance(from, matched.point) > LOCAL_REJOIN_MAX_DEVIATION_M) {
      if (auto && collapseFlow.canCollapse(fix.timestamp)) return;
      runDeviationTriggeredRebuild();
      return;
    }

    const visited = visitTrackerRef.current?.visitedIds ?? new Set<string>();
    const stopsAhead = (walkPlanRef.current?.orderedAttractions ?? [])
      .filter((a) => !visited.has(a.id))
      .map((a) => a.coordinates);
    const candidates = rejoinCandidates(
      from,
      geometry,
      matched.segmentIndex,
      nextStopAlongM(geometry, matched.segmentIndex, matched.point, stopsAhead),
    );
    if (candidates.length === 0) {
      rejoinFailed();
      return;
    }

    rejoinInFlightRef.current = true;
    setIsFindingWayBack(true);
    const requestGeometry = geometry;
    try {
      const res = await fetch("/api/reroute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, candidates: candidates.map((c) => c.point) }),
      });
      const data = (await res.json()) as {
        geometry?: Coordinates[];
        candidateIndex?: number;
      };
      const candidate = candidates[data.candidateIndex ?? -1];
      // The walk may have ended, or been re-planned, while this was in flight.
      if (walkTrackerRef.current === null || walkGeometryRef.current !== requestGeometry) {
        return;
      }
      if (!res.ok || !candidate || !data.geometry || data.geometry.length < 2) {
        rejoinFailed();
        return;
      }

      const spliced = spliceRoute(requestGeometry, candidate, data.geometry);
      lastLocalRejoinAtRef.current = fix.timestamp;
      walkGeometryRef.current = spliced;
      lastSegmentIndexRef.current = null;
      matchedRef.current = { segmentIndex: 0, point: spliced[0] };
      setRemainingGeometry(spliced);
      walkTrackerRef.current.updateGeometry(spliced);
      // A new routeVersion: re-frame the collection locally. It is scanned again
      // only for a stretch the old scan did not cover (usually none: 0 requests).
      discoveryRef.current?.setRoute(
        spliced,
        1000 / (walkInputRef.current?.walkingPaceMinPerKm ?? 15),
        walkInputRef.current?.preferredCategories ?? [],
      );
      void discoveryRef.current?.ensureCovered(spliced, fix.timestamp);
    } catch {
      if (walkTrackerRef.current !== null) rejoinFailed();
    } finally {
      rejoinInFlightRef.current = false;
      setIsFindingWayBack(false);
    }
  };

  /**
   * The third answer to the off-route question, for a walker who gave none.
   *
   * Opt-in via `WalkSettings.continueHeadingOnSilence` (default off) — this is
   * a rebuild taken on an absence of input, not a response to one, so it only
   * runs at all for a walker who has said that's what they want silence to
   * mean. Everyone else's silence still just leaves the old route alone.
   *
   * Runs when the banner lapses, and only rebuilds if the walker is *both*
   * still off route and has held one direction for the whole heading window.
   * Anything else — they rejoined, they stopped, they turned a corner, the GPS
   * stream went quiet — falls back to the old behaviour of leaving the route
   * alone, which is also what every `null` from `sustainedHeading` means.
   *
   * The "still off route" check is not redundant with the banner being up. The
   * banner outlives the excursion that raised it: a walker who wandered off,
   * was asked, ignored the banner and then rejoined would otherwise be rebuilt
   * ninety seconds later around a route they are already walking.
   *
   * Judged against the last fix's timestamp rather than `Date.now()`, for the
   * reason `PaceChecker.evaluationTime` documents — the simulator's stream runs
   * ahead of the wall clock, and a heading window measured against the wrong
   * one can never close.
   */
  const continueInHeadingAfterSilence = () => {
    if (!walkSettingsRef.current.continueHeadingOnSilence) return;
    if (!isOffRouteRef.current) return;
    // Visible options are never overridden; a collapse still being fetched is
    // simply superseded by this rebuild (its `stopWalkTracking` drops the request).
    if (collapseFlow.isOffering()) return;

    const lastFix = latestPaceUpdateRef.current;
    if (!lastFix) return;

    const heading = headingMonitorRef.current?.sustainedHeading(
      lastFix.timestamp,
    );
    if (heading === null || heading === undefined) return;

    const state = midWalkRebuildState();
    if (!state) return;

    const { input, options } = buildHeadingContinuedRebuildRequest(
      state,
      heading,
    );
    void handleBuildWalk(input, options);
  };

  /**
   * Raise the off-route question rather than redrawing, for `deviationMode:
   * ask`. Unlike the slow-pace question, no answer does not simply mean
   * rebuild: the walker may have deliberately stepped off the route, and the
   * cost of ignoring that is nothing. What silence means instead is decided by
   * `continueInHeadingAfterSilence` — the stale route stands unless the walker
   * has spent the whole ninety seconds walking steadily away from it.
   *
   * Nothing extra rate-limits that path. `DeviationMonitor` armed its
   * three-minute cooldown the moment it raised this banner, and one banner can
   * only lapse once, so the worst case is unchanged: one rebuild per cooldown.
   */
  const askBeforeRedrawing = () => {
    if (walkTrackerRef.current === null) return;

    clearDeviationConfirmation();
    deviationConfirmationRef.current = true;
    setDeviationConfirmation(true);

    deviationConfirmTimeoutRef.current = setTimeout(() => {
      deviationConfirmTimeoutRef.current = null;
      deviationConfirmationRef.current = false;
      setDeviationConfirmation(false);
      continueInHeadingAfterSilence();
    }, DEVIATION_CONFIRMATION_TIMEOUT_MS);
  };

  /**
   * Raise the question instead of rebuilding, for a direction the walker set to
   * "ask". A banner, not a dialog — see `PaceConfirmationNotification`.
   *
   * No answer times out differently by direction, and the asymmetry is the
   * point. Ignoring a slow-pace question has a cost the walker can't see coming
   * — they run past the time they said they had — so silence falls back to the
   * old auto behaviour and the route is adjusted. Ignoring an ahead-of-plan
   * question costs nothing: they finish early. Adding a stop to someone's walk
   * because they didn't look at their phone is not a reasonable default.
   */
  const askBeforeRebuilding = (reason: ReplanReason) => {
    if (walkTrackerRef.current === null) return;

    clearPaceConfirmation();
    setPaceConfirmation(reason);

    paceConfirmTimeoutRef.current = setTimeout(() => {
      paceConfirmTimeoutRef.current = null;
      setPaceConfirmation(null);
      if (replanPaceDirection(reason) === "slow" && !collapseFlow.isCollapsed()) {
        runPaceTriggeredRebuild(reason);
      }
    }, PACE_CONFIRMATION_TIMEOUT_MS);
  };

  // `planOverride` is passed by the auto-resume path, where `walkPlan` state has just
  // been set and this closure would still read the previous (null) value.
  const handleStartWalk = (planOverride?: WalkPlan) => {
    // An in-flight rebuild can resolve after unmount; it must not start a GPS watch.
    if (isUnmountedRef.current) return;
    const plan = planOverride ?? walkPlan;
    if (!plan || walkGeometryRef.current.length < 2) {
      setWalkPlanError("Build a walk plan before starting live tracking.");
      return;
    }
    walkPlanRef.current = plan;
    // Give the map the whole screen for the walk.
    onRequestExpand?.(true);
    const initialPosition =
      (planOverride ? walkInputRef.current?.origin : currentPosition) ??
      walkInputRef.current?.origin ??
      walkGeometryRef.current[0] ??
      null;

    stopWalkTracking();
    latestPaceUpdateRef.current = null;
    lastSegmentIndexRef.current = null;
    setRecordedPointCount(0);
    setCurrentPosition(initialPosition);
    markOffRoute(false);
    setWalkPhase("walking");
    setWalkTrackingMessage(null);

    if (initialPosition) {
      // Anchored at the start of the route: a walk begins at its beginning.
      // Searching the whole line let a round trip (which ends where it began)
      // match the walker to the LAST leg, leaving almost nothing to draw.
      const initialDeviation = detectDeviation(
        initialPosition,
        walkGeometryRef.current,
        0,
      );
      lastSegmentIndexRef.current = initialDeviation.closestSegmentIndex;
      matchedRef.current = {
        segmentIndex: initialDeviation.closestSegmentIndex,
        point: initialDeviation.closestPointOnRoute,
      };
      setRemainingGeometry(
        remainingRoute(
          walkGeometryRef.current,
          initialDeviation.closestSegmentIndex,
          // The matched point, not the raw fix: a fix 60 m off the line would
          // otherwise start the drawn route with a straight cut to a vertex.
          initialDeviation.closestPointOnRoute,
        ),
      );
    } else {
      setRemainingGeometry(walkGeometryRef.current);
    }

    const attractions = plan.orderedAttractions;

    // The announcer and the nearby store belong to the whole walk, not to one
    // route: a re-plan restarts this function but must not re-announce places.
    const discovery = discoveryRef.current ?? new DiscoveryLoader();
    discoveryRef.current = discovery;
    discovery.setLang(uiLang);
    const memory = companionMemoryRef.current;
    if (memory) discovery.setMemory(memory.interactions, memory.sessionCount);
    const announcer =
      announcerRef.current ??
      new PoiAnnouncer(walkInputRef.current?.preferredCategories ?? []);
    announcerRef.current = announcer;
    // The plan's stops are collection members; frames and scores follow the new
    // route, and only geometry the earlier scans do not cover is scanned.
    discovery.setRoute(
      walkGeometryRef.current,
      1000 / (walkInputRef.current?.walkingPaceMinPerKm ?? 15),
      walkInputRef.current?.preferredCategories ?? [],
    );
    discovery.addPlanStops(attractions);
    void discovery.ensureCovered(
      walkGeometryRef.current,
      (latestPaceUpdateRef.current as PaceUpdate | null)?.timestamp ?? Date.now(),
    );

    // Reused across re-plans within the same walk — only a fresh build resets it.
    const visits = visitTrackerRef.current ?? new VisitTracker();
    visitTrackerRef.current = visits;

    const planInput = walkInputRef.current;
    speedEstimatorRef.current = new SpeedEstimator();
    paceAdvisorRef.current = planInput
      ? new PaceAdvisor(planInput.walkingPaceMinPerKm)
      : null;
    firstFixAtRef.current = null;

    const onPositionUpdate = (update: PaceUpdate) => {
      // The dot accepts any fix the tracker lets through (<=100 m); speed,
      // deviation and visits only trust fixes this good. A poor fix still moves
      // the dot, but never changes what the engine believes.
      if (update.accuracyMeters > ENGINE_MAX_ACCURACY_M) {
        const poorNow = Date.now();
        if (poorNow - lastGpsUpdateRef.current >= 1000) {
          lastGpsUpdateRef.current = poorNow;
          setCurrentPosition(update.currentPosition);
        }
        return;
      }
      latestPaceUpdateRef.current = update;
      lastFixWallRef.current = Date.now();
      if (firstFixAtRef.current === null) firstFixAtRef.current = update.timestamp;

      speedEstimatorRef.current?.record({
        coordinates: update.currentPosition,
        timestamp: update.timestamp,
        accuracyMeters: update.accuracyMeters,
        speedMps: update.speedMps,
      });
      paceAdvisorRef.current?.record(
        {
          coordinates: update.currentPosition,
          timestamp: update.timestamp,
        },
        isNearAnyStop(update.currentPosition, attractions, ADVISOR_STOP_QUIET_RADIUS_M),
      );

      // Feed the re-plan windows from every accepted fix, not from the coarse
      // pace-check tick — the stop/slow detection needs the full sample stream.
      // A fix at a planned stop is the walk working, not slowness (`atStop`).
      paceCheckerRef.current?.recordSample(
        {
          coordinates: update.currentPosition,
          timestamp: update.timestamp,
        },
        isNearAnyStop(update.currentPosition, attractions, VISIT_RADIUS_METERS),
      );

      // Visited detection runs on every accepted fix, like the alerter — a stop
      // walked past between two throttled ticks must still count as reached.
      const newlyVisited = visits.recordPosition(update.currentPosition, attractions);
      if (newlyVisited.length > 0) {
        for (const id of newlyVisited) discovery.setState(id, "visited");
        setVisitedAttractionIds([...visits.visitedIds]);
      }
      if (walkSettings.learningConsent === "granted") {
        foodDwellRef.current.update(update.currentPosition, update.timestamp, [
          ...attractions,
          ...discovery.items().map((i) => i.attraction),
        ]);
      }

      // Throttle setState calls to at most once per second (LOW-2)
      const now = Date.now();
      if (now - lastGpsUpdateRef.current < 1000) return;
      lastGpsUpdateRef.current = now;

      setCurrentPosition(update.currentPosition);
      setAttractionDistances(update.attractionDistances);
      setWalkTrackingMessage(null);
      walkedTrackRef.current.push(update.currentPosition);
      if (walkedTrackRef.current.length > 5_000) {
        // Keep the whole walk's shape at half the resolution rather than only its tail.
        walkedTrackRef.current = walkedTrackRef.current.filter((_, i) => i % 2 === 0);
      }

      // Recorded on and off the route alike. Where the walker is going is a
      // fact about the walker, not about the plan, and the question it answers
      // is asked ninety seconds after the deviation that raised it — by which
      // point a window that had only started filling at the threshold would
      // have thrown away the run-up that shows they were already going there.
      headingMonitorRef.current?.record(
        update.currentPosition,
        update.timestamp,
      );

      const deviation = detectDeviation(
        update.currentPosition,
        walkGeometryRef.current,
        lastSegmentIndexRef.current,
      );
      lastSegmentIndexRef.current = deviation.closestSegmentIndex;
      matchedRef.current = {
        segmentIndex: deviation.closestSegmentIndex,
        point: deviation.closestPointOnRoute,
      };

      // The badge is pure information and appears the moment the walker is off
      // route. The monitor below decides the separate question of whether to
      // offer a rebuild, and takes its time over it — the sustain window gates
      // the offer, never the badge.
      // Hysteresis (off >50 m, on <30 m) and an accuracy gate, so a walker
      // hovering around the line does not flicker the state.
      const offRoute = nextOffRouteState(
        isOffRouteRef.current,
        deviation.deviationMeters,
        update.accuracyMeters,
      );
      markOffRoute(offRoute);

      deviationMonitorRef.current?.record(offRoute, update.timestamp);
      // Fix timestamps only. A walker 400 m+ away for 60 s, two failed rejoins or
      // 8 minutes off route collapse into direction options.
      collapseFlow.feed({
        atMs: update.timestamp,
        deviationM: deviation.deviationMeters,
        accuracyM: update.accuracyMeters,
      });

      // What to tell a walker who is off the line: a turn if their recent
      // movement gives a heading, a compass direction if it does not.
      setOffRouteHint(
        offRoute
          ? turnInstruction(
              headingMonitorRef.current?.recentHeading(update.timestamp) ?? null,
              update.currentPosition,
              deviation.closestPointOnRoute,
            ).text
          : null,
      );
      if (!offRoute) {
        offRouteDismissedRef.current = false;
        setOffRouteDismissed(false);
      }
      refreshWalkStats();

      // Places ahead / left / right. Local only: the collection was scanned once
      // up front, and a walker far outside it triggers (at most) one more scan.
      // On the route, side and distance come from the cross-track frame and the
      // level's gates (`eligibleForCallout`); a GPS heading never decides left or
      // right there. Off the route the walker's own recent heading does.
      // A cyclist is "outside the scan" only after ~5 min of travel, not 450 m.
      const scanKmh = speedEstimatorRef.current?.current(update.timestamp)?.kmh;
      void discovery.maybeScanAround(
        update.currentPosition,
        update.timestamp,
        scanKmh != null ? scanKmh / 3.6 : undefined,
      );
      const level = walkSettingsRef.current.calloutLevel;
      const heading = headingMonitorRef.current?.recentHeading(update.timestamp) ?? null;
      const unvisitedStops = attractions.filter((a) => !visits.visitedIds.has(a.id));
      const stopIds = new Set(unvisitedStops.map((a) => a.id));
      const alreadyUp = new Set(announcer.active().map((a) => a.place.id));
      let shown: Announcement[];
      if (
        calloutsSuppressed({
          collapsed: collapseFlow.isCollapsed(),
          offRoute,
          cardVisible: cardVisibleRef.current,
          offRouteDismissed: offRouteDismissedRef.current,
          askUp: deviationConfirmationRef.current || companionQuestionUpRef.current,
        })
      ) {
        // Direction options are pending or on screen, or the off-route card is
        // up: nothing new is announced until it is dismissed.
        shown = announcer.expire(update.timestamp);
      } else if (!offRoute) {
        const alongM = discovery.alongM(
          deviation.closestSegmentIndex,
          deviation.closestPointOnRoute,
        );
        const planSpeedMps =
          1000 / (60 * (walkInputRef.current?.walkingPaceMinPerKm ?? 15));
        const measuredKmh = speedEstimatorRef.current?.current(update.timestamp);
        const eligible = discovery.eligible({
          alongM,
          speedMps: (measuredKmh?.kmh ?? planSpeedMps * 3.6) / 3.6,
          level,
          nowFixMs: update.timestamp,
          ctx: {
            nearTurn: discovery.isNearTurn(alongM),
            nearStop: isNearAnyStop(update.currentPosition, unvisitedStops, STOP_QUIET_M),
            cardVisible: cardVisibleRef.current,
            paused: measuredKmh?.state === "paused",
            offRoute: false,
            onScreen: announcer.active().length,
            planStopIds: stopIds,
            preferred: walkInputRef.current?.preferredCategories ?? [],
            planSpeedMps,
          },
        });
        shown = announcer.check(
          update.currentPosition,
          heading,
          routeDirectionDeg(
            walkGeometryRef.current,
            deviation.closestSegmentIndex,
            deviation.closestPointOnRoute,
          ),
          eligible.map(itemToPlace),
          stopIds,
          update.timestamp,
          {
            trusted: true,
            frameOf: (id) => discovery.relationOf(id, alongM, update.currentPosition),
          },
        );
      } else {
        const stopPlaces: NearbyPlace[] = unvisitedStops.map((a) => ({
          ...a,
          source: "osm" as const,
          verification: "registered" as const,
          kind: "poi" as const,
        }));
        shown = announcer.check(
          update.currentPosition,
          heading,
          null,
          [...stopPlaces, ...discovery.offRoutePlaces(level)],
          stopIds,
          update.timestamp,
        );
      }
      // The collection is the one "announced once" record; it also feeds the
      // level's budgets (gap, per-10-minutes, category cooldown).
      for (const a of shown) {
        if (!alreadyUp.has(a.place.id)) discovery.recordAnnounced(a.place.id, update.timestamp);
      }
      setCallouts(shown);

      // The off-route card may carry ONE line about something right here.
      const here = offRoute ? discovery.whileHere(update.currentPosition) : null;
      if (here) {
        const { relation } = relatePlace(
          update.currentPosition,
          heading,
          null,
          here.item.attraction.coordinates,
        );
        const side = relation === "left" || relation === "right" ? relation : "on";
        setWhileHereNote(
          walkCopy.discovery.text("en", "deviation.whileHere", {
            name: here.item.attraction.name,
            m: Math.max(10, Math.round(here.distanceM / 10) * 10),
            side: walkCopy.discovery.text("en", `side.${side}`),
          }),
        );
      } else {
        setWhileHereNote(null);
      }

      const remaining = remainingRoute(
        walkGeometryRef.current,
        deviation.closestSegmentIndex,
        deviation.closestPointOnRoute,
      );
      setRemainingGeometry(remaining);
      void shortcut.feed();
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

    const checker = new PaceChecker(walkSettingsRef.current, trigger, (reason, response) => {
      if (response === "auto") {
        if (collapseFlow.isCollapsed()) return;
        runPaceTriggeredRebuild(reason);
        return;
      }

      askBeforeRebuilding(reason);
    });
    paceCheckerRef.current = checker;
    checker.start();

    // A fresh window per walk, and per re-plan: a heading measured against
    // geometry that has been replaced says nothing about the route the walker
    // is on now.
    headingMonitorRef.current = new HeadingMonitor();

    deviationMonitorRef.current = new DeviationMonitor(walkSettingsRef.current, (response) => {
      if (response === "auto") {
        void runLocalRejoin(true);
        return;
      }

      askBeforeRedrawing();
    });
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
    // The snapshot is the *first* of a re-plan chain, so reverting undoes every
    // rebuild since — and with them every stop those rebuilds took. Offering to
    // put back stops the walker is standing on again would be nonsense.
    setLostStops([]);

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

    showPlan(restoredPlan, snapshot.geometry, true);
    setCurrentPosition(resumePosition);

    if (snapshot.geometry.length >= 2) {
      handleStartWalk(restoredPlan);
    }
  };

  const handleRevertPlan = () => {
    if (previousPlan) revertToSnapshot(previousPlan);
  };

  /**
   * "Wait, I wanted that one back."
   *
   * Pins the stop for real — the same pin the list and the map toggles write,
   * so it is protected from every later rebuild too and not just from this one
   * — and then rebuilds with it in the kept set. The pin is written through the
   * ref as well as through state because the request is built in this same
   * tick, before React has committed anything.
   *
   * The stop stays on the dropped list until the rebuild actually returns it;
   * `stopsLostInRebuild` takes it off when it appears in the new plan. If the
   * rebuild fails, the walker still has the offer in front of them.
   */
  const recallDroppedStop = (attractionId: string) => {
    const lost = lostStops.find((s) => s.attraction.id === attractionId);
    if (!lost) return;
    const state = midWalkRebuildState();
    if (!state) return;

    const nextPinned = pinnedAttractionIdsRef.current.includes(attractionId)
      ? pinnedAttractionIdsRef.current
      : [...pinnedAttractionIdsRef.current, attractionId];
    pinnedAttractionIdsRef.current = nextPinned;
    setPinnedAttractionIds(nextPinned);

    const { input, options } = buildRecallRebuildRequest(
      { ...state, pinnedIds: nextPinned },
      lost.attraction,
    );
    void handleBuildWalk(input, options);
  };

  // "Add to walk" on a map popup. A planned walk is rebuilt with the place; with no walk yet it waits in the wishlist.
  const addMapPlaceToWalk = (place: Attraction) => {
    const plan = walkPlanRef.current;
    const input = walkInputRef.current;
    if (plan && input && walkPhase === "planned") {
      if (plan.orderedAttractions.some((a) => a.id === place.id)) return;
      setWishlist((current) => [...current, place]);
      void handleBuildWalk(input, { keepAttractions: [...plan.orderedAttractions, place], fillRemainingTime: false });
      return;
    }
    setWishlist((current) => (current.some((a) => a.id === place.id) ? current : [...current, place]));
  };

  // "From saved places": all picked places join the wishlist; a planned walk is rebuilt once with them.
  const addSavedPlacesToWalk = (places: Attraction[]) => {
    const plan = walkPlanRef.current;
    const input = walkInputRef.current;
    const fresh = places.filter((p) => !wishlist.some((w) => w.id === p.id));
    setWishlist((current) => [...current, ...fresh.filter((p) => !current.some((c) => c.id === p.id))]);
    if (plan && input && walkPhase === "planned") {
      const extra = fresh.filter((p) => !plan.orderedAttractions.some((a) => a.id === p.id));
      if (extra.length > 0) void handleBuildWalk(input, { keepAttractions: [...plan.orderedAttractions, ...extra], fillRemainingTime: false });
    }
  };

  // "Add to walk" on a place the walker was told about: the same rebuild as
  // recalling a dropped stop — pinned, so no later rebuild takes it back out.
  const addNearbyPlaceToWalk = (place: NearbyPlace) => {
    if (place.verification === "detected") return;
    const state = midWalkRebuildState();
    if (!state) return;
    discoveryRef.current?.setState(place.id, "added");
    const nextPinned = pinnedAttractionIdsRef.current.includes(place.id)
      ? pinnedAttractionIdsRef.current
      : [...pinnedAttractionIdsRef.current, place.id];
    pinnedAttractionIdsRef.current = nextPinned;
    setPinnedAttractionIds(nextPinned);
    // Only the plan's own fields go to the planner API.
    const attraction: Attraction = {
      id: place.id,
      name: place.name,
      coordinates: place.coordinates,
      category: place.category,
      avgVisitMinutes: place.avgVisitMinutes,
      tags: place.tags,
    };
    const { input, options } = buildRecallRebuildRequest(
      { ...state, pinnedIds: nextPinned },
      attraction,
    );
    void handleBuildWalk(input, options);
  };

  const dismissCallout = (placeId: string) => {
    announcerRef.current?.dismiss(placeId);
    discoveryRef.current?.setState(placeId, "dismissed");
    setSelectedCallout(null);
    setCallouts(announcerRef.current?.active() ?? []);
  };

  // A stop-less option (a round trip, or the way home) has no stops to re-plan
  // around: its previewed line IS the route, so it is walked as drawn instead of
  // being rebuilt by `/api/walk-plan` into something the walker never saw.
  const startFromOptionRoute = (option: OfferedOption) => {
    const state = midWalkRebuildState();
    if (!state) return;
    const { input } = buildOptionRebuildRequest(state, []);
    if (walkPlanRef.current && walkInputRef.current) {
      const snapshot: PlanSnapshot = {
        plan: walkPlanRef.current,
        input: walkInputRef.current,
        geometry: walkGeometryRef.current,
        startTime: walkStartTimeRef.current,
      };
      setPreviousPlan((prev) => prev ?? snapshot);
    }
    const plan: WalkPlan = {
      orderedAttractions: [],
      segments: [],
      totalDistanceMeters: option.distanceM,
      totalMinutes: option.minutes,
      feasible: true,
      droppedAttractions: [],
      geometry: option.geometry,
    };
    stopWalkTracking();
    walkInputRef.current = input;
    setLastWalkInput(input);
    walkStartTimeRef.current = Date.now();
    latestPaceUpdateRef.current = null;
    showPlan(plan, option.geometry, true);
    setCurrentPosition(input.origin);
    handleStartWalk(plan);
  };

  // The walker picked a direction: rebuild through exactly its stops, from here.
  const chooseOption = (index: number) => {
    const offer = collapseFlow.offer;
    const option = offer?.options[index];
    if (!option) return;
    const state = midWalkRebuildState();
    if (!state) return;
    collapseFlow.resolve();
    if (option.stops.length === 0) {
      startFromOptionRoute(option);
      return;
    }
    const { input, options } = buildOptionRebuildRequest(
      state,
      option.stops.map((s) => s.attraction),
    );
    void handleBuildWalk(input, options);
  };

  // "Back to my plan": after a collapse that is the existing redraw-from-here;
  // from "Show me something different" it simply closes the sheet.
  const backFromOptions = () => {
    const mode = collapseFlow.offer?.mode;
    collapseFlow.resolve();
    if (mode === "collapse") runDeviationTriggeredRebuild();
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

  // Manual "done" for the stop the walker is heading to — identical to having
  // walked past it, because it goes into the same visited set: struck through in
  // the list, and dropped from every later re-plan by `excludeVisited`.
  const skipAttraction = (attractionId: string) => {
    const visits = visitTrackerRef.current;
    if (!visits) return;
    // Idempotent by construction: a skip click racing a GPS fix for the same stop
    // only ever adds it once, in either order.
    visits.markVisited(attractionId);
    discoveryRef.current?.setState(attractionId, "visited");
    setVisitedAttractionIds([...visits.visitedIds]);
    // A pin on a stop that's done has nothing left to enforce.
    setPinnedAttractionIds((prev) => {
      if (!prev.includes(attractionId)) return prev;
      const next = prev.filter((id) => id !== attractionId);
      pinnedAttractionIdsRef.current = next;
      return next;
    });
  };

  // Keep PaceChecker in sync when settings change while a walk is active
  useEffect(() => {
    paceCheckerRef.current?.updateSettings(walkSettings);
    deviationMonitorRef.current?.updateSettings(walkSettings);
    // The rebuild runs out of a closure captured when the walk started, so it
    // has to read settings through a ref — otherwise turning auto-resume off
    // mid-walk wouldn't take effect until the next walk.
    walkSettingsRef.current = walkSettings;
  }, [walkSettings]);

  // Tear down the GPS watch, timers and in-flight searches if the page unmounts mid-walk
  useEffect(() => {
    isUnmountedRef.current = false;
    return () => {
      hikeSearchTokenRef.current += 1;
      buildWalkRequestIdRef.current += 1;
      isUnmountedRef.current = true;
      paceCheckerRef.current?.stop();
      walkTrackerRef.current?.stop();
      walkTrackerRef.current = null;
      walkRecorderRef.current?.stop();
      if (paceConfirmTimeoutRef.current !== null) {
        clearTimeout(paceConfirmTimeoutRef.current);
      }
      if (deviationConfirmTimeoutRef.current !== null) {
        clearTimeout(deviationConfirmTimeoutRef.current);
      }
    };
  }, []);

  // Abandon any in-flight hike search when the user leaves the hike-search mode
  const changePlannerMode = (mode: PlannerMode) => {
    hikeSearchTokenRef.current += 1;
    setPlannerMode(mode);
  };

  // Leaving the advanced surface always lands back on the simple City Walk flow,
  // otherwise the simple view would keep rendering with `plannerMode` set to a
  // mode it no longer offers a switcher for.
  const closeAdvanced = () => {
    changePlannerMode("walk-companion");
    setIsAdvancedOpen(false);
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

  // The one card the walk HUD may show. A single slot: the walker takes in one
  // question at a time, so something decides which of these wins.
  const turnBody = offRouteHint ? walkCopy.turn.toGetBack(offRouteHint) : undefined;
  let walkAlert: WalkAlert | null = null;
  if (walkMode) {
    if (rebuildingMidWalk && isWalkPlanLoading) {
      // Tracking is down while this runs; say so, and let the walker bail out
      // to the route they were already on instead of waiting it out.
      walkAlert = {
        id: "rebuilding",
        tone: "info",
        title: "Updating your route…",
        body: isWalkPlanSlow ? "Still working, this one is slow." : undefined,
        actions: [
          {
            label: "Keep my current route",
            primary: true,
            onClick: () => cancelBuildRef.current?.(),
          },
        ],
      };
    } else if (selectedCallout) {
      // The walker asked about this place: it outranks everything but itself.
      const placePaceMin = walkInputRef.current?.walkingPaceMinPerKm ?? 15;
      const calloutPlace = selectedCallout.place;
      const calloutItem = discoveryRef.current?.collection.items.get(calloutPlace.id);
      const remainingWalkMin =
        walkStats?.timeToFinishMin ??
        Math.max(0, (walkInputRef.current?.availableMinutes ?? 0) - (walkStats?.elapsedMin ?? 0));
      const isPlanStop = (walkPlanRef.current?.orderedAttractions ?? []).some(
        (a) => a.id === calloutPlace.id,
      );
      const mayAdd = mayAddToWalk(
        calloutPlace.verification,
        isPlanStop ||
          canOfferAdd({
            lateralM: isOffRoute ? null : (calloutItem?.frame?.lateralM ?? null),
            fallbackDistanceM: selectedCallout.distanceM,
            speedMpm: 1000 / placePaceMin,
            remainingWalkMin,
            environment: discoveryRef.current?.environment ?? "urban",
          }),
      );
      const calloutWarning =
        calloutPlace.verification === "crowd-signal"
          ? walkCopy.discovery.en["warn.crowd"]
          : calloutPlace.verification === "detected"
            ? detectedNote(calloutPlace.tags)
            : undefined;
      walkAlert = {
        id: `visit-${selectedCallout.place.id}`,
        tone: "info",
        title: walkCopy.visit.title,
        subject: selectedCallout.place.name,
        body: walkCopy.visit.detour(
          detourMinutes(
            selectedCallout.distanceM,
            placePaceMin,
            selectedCallout.place.avgVisitMinutes,
          ),
        ),
        note: calloutWarning,
        actions: [
          ...(mayAdd
            ? [
                {
                  label: walkCopy.visit.add,
                  primary: true,
                  onClick: () => {
                    const place = selectedCallout.place;
                    dismissCallout(place.id);
                    addNearbyPlaceToWalk(place);
                  },
                },
              ]
            : []),
          {
            label: walkCopy.visit.notNow,
            primary: !mayAdd,
            onClick: () => dismissCallout(selectedCallout.place.id),
          },
        ],
      };
    } else if (deviationConfirmation) {
      walkAlert = {
        id: "off-route-ask",
        tone: "alert",
        title: walkCopy.offRoute.askTitle,
        body: isFindingWayBack ? walkCopy.offRoute.findingWay : turnBody,
        note: whileHereNote ?? undefined,
        actions: [
          {
            label: walkCopy.offRoute.showWayBack,
            primary: true,
            onClick: () => {
              clearDeviationConfirmation();
              void runLocalRejoin();
            },
          },
          {
            label: walkCopy.offRoute.replan,
            onClick: () => {
              clearDeviationConfirmation();
              runDeviationTriggeredRebuild();
            },
          },
          {
            label: walkCopy.offRoute.dismiss,
            onClick: () => {
              clearDeviationConfirmation();
              offRouteDismissedRef.current = true;
              setOffRouteDismissed(true);
            },
          },
          ...(isSignedIn
            ? [
                {
                  label: walkCopy.offRoute.talk,
                  onClick: () => {
                    // Keep the question up: the walker may still tap an answer after talking.
                    walkChat.openWith(
                      uiLang === "he"
                        ? "סטיתי מהמסלול. מה האפשרויות שלי? אפשר לתקן, לבנות מחדש מכאן או להמשיך בדרך שלי."
                        : "I've gone off the planned route. What are my options? I could rejoin, redraw from here, or carry on my own way.",
                    );
                  },
                },
              ]
            : []),
        ],
      };
    } else if (isOffRoute && !offRouteDismissed) {
      walkAlert = {
        id: "off-route",
        tone: "alert",
        title: walkCopy.offRoute.title,
        body: isFindingWayBack ? walkCopy.offRoute.findingWay : turnBody,
        note: whileHereNote ?? undefined,
        // Without this, auto/off mode could never dismiss the card, so callouts
        // stayed held back until the walker rejoined.
        actions: [
          {
            label: walkCopy.offRoute.dismiss,
            onClick: () => {
              offRouteDismissedRef.current = true;
              setOffRouteDismissed(true);
            },
          },
        ],
      };
    } else if (paceConfirmation) {
      const slow = replanPaceDirection(paceConfirmation) === "slow";
      walkAlert = {
        id: `pace-ask-${paceConfirmation}`,
        tone: "info",
        title: slow
          ? paceConfirmation === "full-stop"
            ? walkCopy.pace.askStill
            : walkCopy.pace.askSlow
          : walkCopy.pace.askFast,
        actions: [
          {
            label: slow ? walkCopy.pace.askSlowConfirm : walkCopy.pace.askFastConfirm,
            primary: true,
            onClick: () => {
              const reason = paceConfirmation;
              clearPaceConfirmation();
              if (!slow) addStopViaChat(reason);
              else runPaceTriggeredRebuild(reason);
            },
          },
          {
            label: slow ? walkCopy.pace.askSlowDismiss : walkCopy.pace.askFastDismiss,
            onClick: clearPaceConfirmation,
          },
          ...(slow
            ? [
                {
                  label: walkCopy.pace.askMoreTime,
                  onClick: () => {
                    clearPaceConfirmation();
                    runExtendedTimeRebuild();
                  },
                },
              ]
            : []),
          ...(slow && isSignedIn
            ? [
                {
                  label: walkCopy.offRoute.talk,
                  onClick: () =>
                    walkChat.openWith(
                      uiLang === "he"
                        ? "אני לא מספיק בזמן. מה כדאי לקצר? תציע לי ותשאל אותי."
                        : "I'm running short on time. What should we cut? Suggest something and ask me.",
                    ),
                },
              ]
            : []),
        ],
      };
    } else if (companion.card) {
      const q = companion.card;
      walkAlert = {
        id: q.id,
        tone: "info",
        variant: "question",
        icon: q.kind === "rain" ? "🌧" : q.kind === "heat-water" ? "💧" : q.kind === "sunset" ? "🌇" : "🧭",
        title: q.title,
        // Weather is Open-Meteo data: credit it on the questions it drives.
        footnote:
          (q.kind === "heat-water" || q.kind === "rain") && companion.attribution
            ? companion.attribution
            : undefined,
        actions: q.answers.map((a, i) => ({
          label: a.label,
          primary: i === 0,
          onClick: () => companion.answer(a.id),
        })),
      };
    } else if (shortcut.offer) {
      const o = shortcut.offer;
      const sc = shortcutCopy[uiLang];
      walkAlert = {
        id: o.id,
        tone: "info",
        icon: "↪",
        title: sc.title(o.stopName),
        body: sc.body(o.savingMin, Math.round(o.savingM)),
        actions: [
          { label: sc.accept, primary: true, onClick: () => void shortcut.accept() },
          { label: sc.keep, onClick: shortcut.dismiss },
        ],
      };
    } else if (paceAdvisory) {
      const slow = paceAdvisory.kind === "slow";
      walkAlert = {
        id: `pace-${paceAdvisory.kind}`,
        tone: "info",
        icon: slow ? "🐢" : "🚶",
        title: slow ? walkCopy.pace.slowTitle : walkCopy.pace.fastTitle,
        actions: [
          {
            label: slow ? walkCopy.pace.slowAction : walkCopy.pace.fastAction,
            primary: true,
            onClick: () => {
              setPaceAdvisory(null);
              if (!slow) addStopViaChat("sustained-fast-pace");
              else runPaceTriggeredRebuild("sustained-slow-pace");
            },
          },
          ...(slow
            ? [
                {
                  label: walkCopy.pace.slowKeepStops,
                  onClick: () => {
                    setPaceAdvisory(null);
                    runExtendedTimeRebuild();
                  },
                },
              ]
            : []),
          { label: walkCopy.pace.dismiss, onClick: () => setPaceAdvisory(null) },
        ],
      };
    }
  }

  const walkChat = useWalkChat({
    lang: uiLang === "he" ? "he" : "en",
    isSignedIn,
    freeChat: true,
    getContext: () => {
      const snap = getCompanionSnapshot();
      if (!snap) return null;
      // The lookup is on-device, so it is not gated on habit consent like the companion's.
      const route = companionRouteState();
      if (!route) return null;
      return {
        stops: snap.tick.remainingStops.map((st) => ({ ...st, pinned: st.pinned === true })),
        amenities: chatAmenityItems(route.discovery),
        position: snap.tick.position,
        timing: walkStats
          ? {
              elapsedMin: Math.round(walkStats.elapsedMin),
              remainingMin: walkStats.timeToFinishMin === null ? null : Math.round(walkStats.timeToFinishMin),
              availableMin: walkInputRef.current?.availableMinutes ?? 0,
              overBudget: walkStats.overBudget,
            }
          : undefined,
      };
    },
    onAction: (action) => {
      if (action.kind === "detour") {
        void runAmenityDetour(action.item.kind, getCompanionSnapshot(), action.item);
      } else if (action.kind === "drop") {
        runDropStopsRebuild([action.stopId]);
      } else if (action.kind === "add-stop") {
        runPaceTriggeredRebuild("sustained-fast-pace");
      } else if (action.kind === "apply-changes") {
        runApplyChangesRebuild(action.adds, action.dropStopIds);
      } else if (action.kind === "add-place") {
        runAddPlaceRebuild(action.name, action.coordinates);
      } else {
        void runThemedOption("short");
      }
    },
  });

  askForStopRef.current = () =>
    walkChat.openWith(
      walkSettingsRef.current.stopSuggestionMode === "ask"
        ? uiLang === "he"
          ? "תוסיף עצירה — קודם תשאל אותי איזה סוג מקום בא לי"
          : "Add a stop — first ask me what kind of place I want"
        : uiLang === "he"
          ? "תוסיף עצירה — תבחר אחת בשבילי ותשאל אותי אם זה מתאים"
          : "Add a stop — pick the best one for me and ask if it fits",
    );

  // For the per-fix callout gate (a closure): is any card, or the options sheet, up?
  const optionsOffer = walkMode ? collapseFlow.offer : null;
  useEffect(() => {
    cardVisibleRef.current = walkAlert !== null || optionsOffer !== null;
    // WalkHud shows the options sheet over the alert, so a card under the sheet is not shown yet.
    if (walkAlert && optionsOffer === null && shortcut.offer && walkAlert.id === shortcut.offer.id) shortcut.markShown();
    companionQuestionUpRef.current = companion.card !== null;
  });
  const directionSheet = optionsOffer ? (
    <DirectionOptionsSheet
      options={optionsOffer.options.map((o) => ({
        theme: o.theme,
        minutes: o.minutes,
        distanceM: o.distanceM,
        stopNames: o.stops.map((s) => s.attraction.name),
      }))}
      highlight={collapseFlow.highlight}
      onHighlight={collapseFlow.setHighlight}
      onChoose={chooseOption}
      onBack={backFromOptions}
    />
  ) : undefined;

  return (
    /* @container: every breakpoint below reacts to the frame's width, not the
       window's, so the embedded planner stacks and the expanded one splits.
       The flex row lives on the child, not here — an element can't match its
       own container query, so `@4xl:flex-row` would silently never fire. */
    <div className="@container relative h-full w-full overflow-hidden bg-cream font-brand text-charcoal">
      {walkSettingsLoaded && walkSettings.learningConsent === "unset" ? (
        <ConsentGate
          lang={uiLang}
          onLanguage={(uiLanguage) => setWalkSettings({ uiLanguage })}
          onAnswer={(granted) =>
            setWalkSettings({
              learningConsent: granted ? "granted" : "declined",
              preferenceLearningEnabled: granted,
            })
          }
        />
      ) : null}
      <div className="flex h-full w-full flex-col @4xl:flex-row">
      {/* The aside stays mounted through a walk (form state survives). On a
          narrow frame it is hidden until "Details" lifts it as a bottom sheet;
          from @4xl up it is simply the sidebar it always was. */}
      <aside
        className={`isolate order-2 min-h-0 w-full flex-1 overflow-y-auto overscroll-contain border-t border-charcoal/10 @4xl:relative @4xl:order-1 @4xl:h-full @4xl:w-[320px] @4xl:flex-none @4xl:border-t-0 @4xl:border-r @6xl:w-[400px] ${
          walkMode && !isDetailsOpen ? "hidden @4xl:block" : ""
        } ${
          walkMode && isDetailsOpen
            ? "absolute inset-x-0 bottom-0 z-[700] max-h-[70%] flex-none rounded-t-2xl shadow-[0_-4px_20px_rgba(30,61,47,0.18)] @4xl:static @4xl:max-h-none @4xl:flex-1 @4xl:rounded-none @4xl:shadow-none"
            : "relative"
        } p-[14px] pb-[26px] @4xl:p-[12px] @4xl:pb-[20px] @6xl:p-[14px] @6xl:pb-[26px]`}
        style={{
          backgroundColor: "#d9b98a",
          backgroundImage: "url(/images/traike/sidebar-bg.jpg)",
          backgroundRepeat: "no-repeat",
          backgroundSize: "max(100%, 460px) auto",
          backgroundPosition: "right top",
          backgroundAttachment: "local",
        }}
      >
        {walkMode && isDetailsOpen && (
          <button
            type="button"
            onClick={() => setIsDetailsOpen(false)}
            className="relative z-10 mb-2 ms-auto flex rounded-full border border-forest/20 bg-white px-3 py-1 text-xs font-semibold text-forest @4xl:hidden"
          >
            {walkCopy.hud.closeDetails}
          </button>
        )}
        <div className="relative z-10 mx-auto mb-[17px] max-w-[440px] ps-[7px] pt-[7px] @4xl:mb-[14px] @4xl:pt-[5px] @6xl:mb-[17px] @6xl:pt-[7px]">
          {!compact && (
            <>
          {/* Dotted route + pin that trail off the wordmark. */}
          <svg
            aria-hidden
            viewBox="0 0 250 56"
            className="pointer-events-none absolute start-[117px] top-[28px] h-[25px] w-[111px] rtl:-scale-x-100 @4xl:start-[100px] @4xl:top-[22px] @4xl:h-[19px] @4xl:w-[84px] @6xl:start-[117px] @6xl:top-[28px] @6xl:h-[25px] @6xl:w-[111px]"
          >
            <path d="M6 4C30 14 50 34 80 35S125 10 145 13 195 40 222 50" stroke="#c9663f" strokeWidth="3" strokeDasharray="5 7" strokeLinecap="round" fill="none" />
            <path d="M237 18c-7 0-12 5-12 11.5 0 8 12 22.5 12 22.5s12-14.5 12-22.5C249 23 244 18 237 18Z" fill="#c4633b" />
            <circle cx="237" cy="29.5" r="4" fill="#fcf6ee" />
          </svg>
          <Link
            href="/"
            className="relative block w-fit ms-[31px] font-display text-[24.7px] font-bold leading-none tracking-[0.01em] text-tk-wordmark @4xl:ms-[24px] @4xl:text-[21px] @6xl:ms-[31px] @6xl:text-[24.7px]"
          >
            Traike
          </Link>
            </>
          )}
          <h1 className="relative mt-[16px] font-display text-[28.6px] font-[650] leading-none tracking-[-0.02em] text-tk-ink @4xl:mt-[12px] @4xl:text-[24px] @6xl:mt-[16px] @6xl:text-[28.6px]">
            {isAdvancedOpen ? "Advanced planning" : "Your walk, right now"}
          </h1>
          <p className="relative mt-[6px] max-w-[285px] text-[15.9px] leading-[22.2px] text-tk-lede @4xl:mt-[5px] @4xl:max-w-[250px] @4xl:text-[14px] @4xl:leading-[19.5px] @6xl:mt-[6px] @6xl:max-w-[285px] @6xl:text-[15.9px] @6xl:leading-[22.2px]">
            {isAdvancedOpen
              ? "Place your own stops, set the rules, or search for a marked hike."
              : "Tell us where you are and how long you have — we’ll build the walk."}
          </p>
          <button
            type="button"
            onClick={() => (isAdvancedOpen ? closeAdvanced() : setIsAdvancedOpen(true))}
            aria-pressed={isAdvancedOpen}
            title={
              isAdvancedOpen
                ? "Back to the simple walk builder"
                : "Open the full planner: your own stops, route rules and hike search"
            }
            className="absolute -top-[10px] end-0 inline-flex h-[31px] items-center gap-[9px] rounded-full border border-[#a9b7b0] bg-[#fefcf8] ps-[14px] pe-[15px] text-[12.75px] font-semibold leading-none text-tk-ink shadow-tk-soft transition-colors hover:bg-white @4xl:h-[28px] @4xl:gap-[7px] @4xl:ps-[11px] @4xl:pe-[12px] @4xl:text-[11.5px] @6xl:h-[31px] @6xl:gap-[9px] @6xl:ps-[14px] @6xl:pe-[15px] @6xl:text-[12.75px]"
          >
            {isAdvancedOpen ? (
              <IconCollapse className="h-[14px] w-[14px]" />
            ) : (
              <IconExpand className="h-[14px] w-[14px]" />
            )}
            {isAdvancedOpen ? "Simple view" : "Advanced"}
          </button>
        </div>

        <div className="relative z-10 mx-auto max-w-[440px] space-y-[15px]">
          {isAdvancedOpen && (
            <Card className="space-y-2">
              <div className="text-sm font-semibold text-forest">Planning mode</div>
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
          )}

          {isAdvancedOpen && plannerMode === "manual" ? (
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
                <div className="text-sm font-semibold text-forest">Map click mode</div>
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
          ) : !isAdvancedOpen || plannerMode === "walk-companion" ? (
            <>
              {isSignedIn && !walkMode && <SideTabs value={sideTab} onChange={setSideTab} friendsBadge={sideTab === "friends" ? 0 : friendRequests} />}
              {isSignedIn && !walkMode && sideTab === "walks" && (
                <MyWalksPanel
                  isSignedIn={isSignedIn}
                  refreshKey={walksVersion}
                  onWalkAgain={(walk) => {
                    const { input, attractions, routeRules } = rebuildFromSaved(walk);
                    setSideTab("plan");
                    // The saved rules come back with the walk (an empty set clears whatever the last build used).
                    void handleBuildWalk(input, { keepAttractions: attractions, fixedOrder: true, existingWalkId: walk.id, routeRules: routeRules as AssistantBuild["routeRules"] });
                  }}
                />
              )}
              {isSignedIn && !walkMode && sideTab === "places" && <SavedPlacesTab isSignedIn={isSignedIn} />}
              {isSignedIn && !walkMode && sideTab === "friends" && <FriendsPanel
                  expanded
                  onPlan={(w) => {
                    // A friend's shared walk: same stops in the same order, starting from where I am (or its first stop).
                    const attractions: Attraction[] = w.stops.map((st, i) => ({
                      id: `friend-${i}-${st.lat.toFixed(5)},${st.lng.toFixed(5)}`,
                      name: st.name,
                      coordinates: { lat: st.lat, lng: st.lng },
                      category: st.category as Attraction["category"],
                      avgVisitMinutes: visitMinutes(st.category),
                      tags: {},
                    }));
                    if (attractions.length === 0) return;
                    setSideTab("plan");
                    void handleBuildWalk(
                      { origin: currentPosition ?? attractions[0].coordinates, availableMinutes: attractions.length * 45 + 120, walkingPaceMinPerKm: 15, radiusMeters: 3000 },
                      { keepAttractions: attractions, fixedOrder: true },
                    );
                  }}
                />}
              {/* "contents" keeps the plan column's layout; hidden keeps the chat and form mounted. */}
              <div className={sideTab === "plan" || !isSignedIn || walkMode ? "contents" : "hidden"}>
              {isSignedIn && (
                // Stays mounted while walking so the conversation continues; collapsed then, so it never pushes End Walk down.
                <details className={walkMode ? "rounded-tk-card bg-tk-card shadow-tk-card" : "[&>summary]:hidden"} open={!walkMode || chatOpen}
                  onToggle={(e) => { if (walkMode) setChatOpen(e.currentTarget.open); }}>
                <summary className="cursor-pointer px-4 py-2.5 font-brand text-sm font-semibold text-tk-ink">Chat with Traike · re-plan</summary>
                <AssistantChat
                  origin={currentPosition ?? mapClickedCoords ?? null}
                  isBuilding={isWalkPlanLoading}
                  onPlacesChange={setPreviewPlaces}
                  queuedPlaces={wishlist.map((w) => ({ name: w.name, coordinates: w.coordinates }))}
                  walking={walkMode}
                  onFocusPlace={(coordinates) => focusOn(coordinates, 17)}
                  walkReady={walkPhase === "planned"}
                  onSetOrigin={(coordinates) => {
                    setCurrentPosition(coordinates);
                    focusOn(coordinates, 14);
                  }}
                  onStart={(simulate) => {
                    setIsSimulating(simulate);
                    setStartRequested(true);
                  }}
                  onBuild={(build: AssistantBuild) => {
                    // The chat may have found a queued place under its own id and a different name; hand it
                    // back the saved place's identity so the planner and the picker know it is that place.
                    const savedFor = (s: Attraction) =>
                      wishlistRef.current.find((w) => w.id === s.id || haversineDistance(s.coordinates, w.coordinates) <= 40);
                    const stops = build.stops.map((s) => {
                      const w = savedFor(s);
                      return w ? { ...s, id: w.id } : s; // keep the chat's coordinates: its checked route passes through them
                    });
                    const extraWishlist = wishlistRef.current.filter((w) => !stops.some((s) => s.id === w.id));
                    // Mid-walk: rebuild from where the walker is, with the time that is left — not from the chat's first start.
                    const midWalk = walkPhaseRef.current === "walking" ? midWalkRebuildState() : null;
                    if (midWalk) {
                      const { input, options } = buildOptionRebuildRequest(midWalk, [...stops, ...extraWishlist]);
                      void handleBuildWalk(input, { ...options, fixedOrder: build.fixedOrder, aiDecided: true, routeRules: build.routeRules });
                      return;
                    }
                    setCurrentPosition(build.origin);
                    focusOn(build.origin, 14);
                    void handleBuildWalk(
                      {
                        origin: build.origin,
                        availableMinutes: build.availableMinutes,
                        walkingPaceMinPerKm: build.walkingPaceMinPerKm,
                        radiusMeters: build.radiusMeters,
                        maxEndDistanceFromOriginMeters: build.maxEndDistanceFromOriginMeters,
                      },
                      { keepAttractions: [...stops, ...extraWishlist], fixedOrder: build.fixedOrder, presetGeometry: extraWishlist.length > 0 ? undefined : build.geometry, aiDecided: extraWishlist.length === 0, fillRemainingTime: false, routeRules: build.routeRules, autoResume: walkPhaseRef.current === "walking" },
                    );
                  }}
                />
                </details>
              )}
              {isSignedIn && !walkMode && <SavedPlacePicker addedIds={wishlist.map((w) => w.id)} inWalkIds={(walkPlan?.orderedAttractions ?? []).map((a) => a.id)} onAdd={addSavedPlacesToWalk} />}
              {!walkMode && !isSignedIn && (
                <PlacePromptPanel
                  nearLocation={currentPosition ?? mapClickedCoords}
                  acceptedAttractions={promptAttractions}
                  onAcceptAttractions={setPromptAttractions}
                  onPreview={(coordinates) => focusOn(coordinates, 16)}
                  onFoundPlacesChange={setPreviewPlaces}
                  onDurationDetected={setPromptDurationMinutes}
                  onMaxEndDistanceDetected={setPromptMaxEndDistanceKm}
                  onSearchRadiusDetected={setPromptSearchRadiusKm}
                  onStopCountDetected={setPromptStopCount}
                  onNotableOnlyDetected={setPromptNotableOnly}
                  onOriginDetected={setPromptOrigin}
                  learnPreferences={walkSettings.preferenceLearningEnabled}
                  persistHistory={
                    walkSettings.historyPersistenceEnabled &&
                    walkSettings.learningConsent === "granted"
                  }
                  isSignedIn={isSignedIn}
                  fillRemainingTime={fillPromptWalk}
                  onFillRemainingTimeChange={setFillPromptWalk}
                />
              )}
              {finishData && (
                <WalkFinishCard data={finishData} lang={uiLang === "he" ? "he" : "en"} onClose={() => setFinishData(null)} />
              )}
              {feedbackAttractions && (
                <WalkFeedbackCard
                  attractions={feedbackAttractions}
                  learnPreferences={walkSettings.preferenceLearningEnabled}
                  onDismiss={() => setFeedbackAttractions(null)}
                />
              )}
              {/* What the mid-walk rebuilds took, and one tap to get it back.
                  Walking only, like the stops list — recall is a rebuild, and
                  `midWalkRebuildState` only answers while a tracker is alive.
                  Moved above `WalkCompanionPanel` 2026-08-24: the build form
                  below (location, time, radius, pace, interests, settings) is
                  the same one already used to build this walk, and while
                  walking it is the least useful thing on the screen — placing
                  a cut stop underneath the whole form meant scrolling past
                  it on a narrow screen to notice anything was lost. */}
              {walkPhase === "walking" && (
                <Button
                  variant="secondary"
                  fullWidth
                  // Also off while a collapse is pending or its options are up:
                  // a second request would replace the sheet the walker is reading.
                  disabled={
                    collapseFlow.loading ||
                    collapseFlow.offer !== null ||
                    collapseFlow.isCollapsed()
                  }
                  onClick={() => {
                    setIsDetailsOpen(false);
                    collapseFlow.offerDifferent();
                  }}
                >
                  {collapseFlow.loading
                    ? walkCopy.discovery.text("en", "options.loading")
                    : walkCopy.discovery.text("en", "options.different")}
                </Button>
              )}
              {walkPhase === "walking" && voiceSupported && (
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => {
                    writeTtsOptIn(!voiceOn);
                    setVoiceOn(!voiceOn);
                  }}
                >
                  {companionText(uiLang, voiceOn ? "ui.voiceOn" : "ui.voiceOff")}
                </Button>
              )}
              {walkPhase === "walking" && (
                <DroppedStopsPanel
                  stops={lostStops}
                  onRecall={recallDroppedStop}
                  onDismiss={() => setLostStops([])}
                />
              )}
              {/* Signed-in users build through the assistant chat only; the form returns once a plan exists. */}
              {(!isSignedIn || walkPhase !== "idle") && (
              <WalkCompanionPanel
                chatOnly={isSignedIn}
                isSignedIn={isSignedIn}
                isLoading={isWalkPlanLoading}
                onBuildWalk={(input) => {
                  void handleBuildWalk(
                    input,
                    // Only when the walker ticked the box. Leftover time on its
                    // own is not a reason to insert more stops.
                    promptWalkBuildOptions(promptAttractions, fillPromptWalk),
                  );
                }}
                walkSettings={walkSettings}
                onWalkSettingsChange={setWalkSettings}
                mapClickedCoords={mapClickedCoords}
                suggestedMinutes={promptDurationMinutes}
                suggestedMaxEndDistanceKm={promptMaxEndDistanceKm}
                suggestedSearchRadiusKm={promptSearchRadiusKm}
                suggestedOrigin={promptOrigin}
                suggestedPace={suggestedPace}
                suggestedCategories={suggestedCategories}
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
              )}
              {isSignedIn && walkPhase === "planned" && savedWalkIdRef.current && (
                <Button
                  variant="secondary"
                  fullWidth
                  disabled={walkBookmarked}
                  onClick={() => {
                    setWalkBookmarked(true);
                    void savedWalkIdRef.current
                      ?.then((id) => (id ? updateWalk(id, { status: "saved" }) : false))
                      .then(() => setWalksVersion((v) => v + 1));
                  }}
                >
                  {walkBookmarked ? "Saved for later" : "🔖 Save for later"}
                </Button>
              )}
              {/* Pinned stop no longer fits the remaining time — ask, don't drop it */}
              {pinnedTimeWarning && (
                <Card className="space-y-2 border-amber-300! bg-amber-50!">
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
                    ⚠️ We couldn&apos;t draw the walking route for this plan, so
                    live walking isn&apos;t available right now.
                  </p>
                </Card>
              )}
              {/* Everything else the planner relaxed, could not check, or could not honour — never silent. */}
              {(walkPlan?.warnings ?? []).filter((w) => !w.includes("geometry")).length > 0 && (
                <Card>
                  <ul className="space-y-1 text-sm text-amber-700">
                    {(walkPlan?.warnings ?? []).filter((w) => !w.includes("geometry")).map((w) => (
                      <li key={w}>⚠️ {w}</li>
                    ))}
                  </ul>
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
              {walkPhase === "walking" && (
                <Button variant="secondary" fullWidth onClick={() => setShowWalkedPath((v) => !v)}>
                  {showWalkedPath ? "Hide the path I walked" : "Show the path I walked (gray)"}
                </Button>
              )}
              {walkPhase === "walking" && walkPlan && (
                <AttractionDistancesPanel
                  attractions={walkPlan.orderedAttractions}
                  attractionDistances={attractionDistances}
                  pinnedIds={pinnedAttractionIds}
                  onTogglePin={toggleAttractionPin}
                  visitedIds={visitedAttractionIds}
                  onSkip={skipAttraction}
                />
              )}
              {/* Loading skeleton while plan is being built (MEDIUM-5) */}
              {isWalkPlanLoading && (
                <Card className="space-y-2">
                  <div className="space-y-2 animate-pulse">
                    <div className="h-4 w-1/2 rounded bg-charcoal/15" />
                    <div className="h-3 w-full rounded bg-cream" />
                    <div className="h-3 w-5/6 rounded bg-cream" />
                    <div className="h-3 w-4/6 rounded bg-cream" />
                  </div>
                  {/* A wide radius with several stops runs a minute or more.
                      Said out loud, because a skeleton that has been pulsing
                      for half a minute reads as broken. */}
                  {isWalkPlanSlow && (
                    <p role="status" className="text-xs text-charcoal/60">
                      Still building — this one&apos;s taking longer than usual.
                      Lots of stops or a wide radius means more places to check.
                    </p>
                  )}
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
              {walkPhase !== "walking" && !isWalkPlanLoading && walkPlan && (
                <HabitHintChip
                  hints={habitHints}
                  lang={uiLang}
                  onDismiss={(habit) =>
                    setHabitHints((prev) => prev.filter((h) => h.habit !== habit))
                  }
                />
              )}
              <WalkPlanResults
                plan={walkPlan}
                error={walkPlanError}
                community={communityAggregates}
                lang={uiLang}
              />
              {walkPhase !== "walking" && (
                <label className="@container relative flex h-[36px] cursor-pointer items-center gap-[9px] overflow-hidden rounded-[10px] border border-dashed border-[#dccdb9] bg-tk-card ps-[14px] pe-[12px] text-[13px] leading-none text-[#1d1712] shadow-tk-card">
                  <input
                    type="checkbox"
                    checked={isSimulating}
                    onChange={(e) => setIsSimulating(e.target.checked)}
                    className="h-[18px] w-[18px] shrink-0 accent-tk-check"
                  />
                  Simulate this walk (10× speed)
                  <svg aria-hidden viewBox="0 0 186 34" className="pointer-events-none absolute end-[55px] top-[calc(50%+2px)] hidden h-[15px] w-[83px] -translate-y-1/2 rtl:-scale-x-100 @min-[346px]:block">
                    <path d="M3 27C40 33 62 8 100 13S150 30 183 6" fill="none" stroke="#d4b499" strokeWidth={3} strokeDasharray="7 7" strokeLinecap="round" />
                  </svg>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/traike/footprints.svg" alt="" aria-hidden className="pointer-events-none absolute end-[30px] top-1/2 h-[17px] w-auto -translate-y-1/2 -rotate-[62deg]" />
                </label>
              )}
              {/* The off-route chain has no other way to be seen working: real
                  GPS drift is not something you can ask for on demand, and the
                  simulator only ever walked the route's own geometry. This
                  moves the reported position, so what fires downstream is the
                  real detector on a real position stream. */}
              {walkPhase === "walking" && isSimulating && (
                <div className="space-y-2 rounded-[10px] border border-dashed border-charcoal/20 bg-white px-3 py-2">
                  <p className="text-xs text-charcoal/60">
                    {isStrayLoading
                      ? "Finding a real side street to wander down…"
                      : isSimulatedStray
                        ? (strayNotice ??
                          "Walking a detour off the planned line.")
                        : "Send the simulated walker off the planned line to exercise the off-route warning."}
                  </p>
                  <Button
                    variant="secondary"
                    fullWidth
                    disabled={isStrayLoading}
                    onClick={() => {
                      const tracker = walkTrackerRef.current;
                      if (!(tracker instanceof SimulatedWalkTracker)) return;

                      if (tracker.isStraying) {
                        tracker.returnToRoute();
                        setIsSimulatedStray(false);
                        setIsStrayLoading(false);
                        setStrayNotice(null);
                        return;
                      }

                      setIsStrayLoading(true);
                      setStrayNotice(null);
                      void toggleSimulatedStray(
                        tracker,
                        SIMULATED_STRAY_METERS,
                      ).then((straying) => {
                        setIsStrayLoading(false);
                        setIsSimulatedStray(straying);
                        setStrayNotice(
                          tracker.strayMode === "synthetic"
                            ? `No routed detour available (${tracker.lastDetourError}). Nudged ${SIMULATED_STRAY_METERS} m off the line instead.`
                            : null,
                        );
                      });
                    }}
                  >
                    {isStrayLoading
                      ? "Routing a detour…"
                      : isSimulatedStray
                        ? "Rejoin the route"
                        : `Stray ${SIMULATED_STRAY_METERS} m off route`}
                  </Button>
                </div>
              )}
              {/* The pace side of the same problem: the re-plan trigger needs a
                  15-minute average to be off plan, which no amount of clicking
                  can produce by hand. This walks the route at the wrong speed
                  for it, so the real ReplanTrigger measures a real drift off a
                  real position stream. At 10× that is ~90 seconds of watching. */}
              {walkPhase === "walking" && isSimulating && (
                <div className="space-y-2 rounded-[10px] border border-dashed border-charcoal/20 bg-white px-3 py-2">
                  <p className="text-xs text-charcoal/60">
                    {simulatedPaceDrift === null
                      ? "Walk the route at the wrong speed for it to exercise the pace re-plan. Takes about 90 seconds to trigger."
                      : `Walking ${simulatedPaceDrift === "slow" ? "60% slower" : "40% faster"} than planned.`}
                  </p>
                  <div className="flex gap-2">
                    {(["slow", "fast", null] as const).map((drift) => (
                      <Button
                        key={drift ?? "normal"}
                        variant="secondary"
                        fullWidth
                        onClick={() => {
                          const tracker = walkTrackerRef.current;
                          if (!(tracker instanceof SimulatedWalkTracker)) return;

                          setSimulatedPaceDriftState(
                            setSimulatedPaceDrift(tracker, drift),
                          );
                        }}
                      >
                        {drift === "slow"
                          ? "Slow pace"
                          : drift === "fast"
                            ? "Fast pace"
                            : "Normal pace"}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
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
              </div>
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

          {isAdvancedOpen ? (
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
              <Button variant="danger" onClick={handleClearAll}>
                Clear All
              </Button>
            </Card>
          ) : (
            <button
              type="button"
              onClick={handleClearAll}
              className="mx-auto flex items-center gap-[8px] py-2 text-[12.75px] font-semibold leading-[20px] text-[#34261c]"
            >
              <svg aria-hidden viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 12a8 8 0 1 1-2.5-5.8" />
                <path d="M20 4v5h-5" />
              </svg>
              Start over
            </button>
          )}

          {isAdvancedOpen ? (
            <>
              <RouteResults route={route} error={hikeSearchError ?? error} />
              {plannerMode !== "walk-companion" ? (
                <TrailIntelligencePanel
                  report={trailBriefing}
                  isLoading={isTrailBriefingLoading}
                  error={trailBriefingError}
                />
              ) : null}
            </>
          ) : null}
        </div>
      </aside>

      {/* Percentage height, not viewport height: when stacked, the map takes a
          share of the frame it is in — a 45vh map inside a 560px frame would
          leave the sidebar nothing. */}
      <section
        className={`relative order-1 overflow-hidden @4xl:order-2 @4xl:h-full @4xl:min-h-0 @4xl:flex-1 ${
          walkMode
            ? "h-full min-h-0 flex-1"
            : "h-[45%] min-h-[180px] shrink-0"
        }`}
      >
        <DynamicMap
          waypoints={waypoints}
          routeGeometry={
            walkPhase === "walking" ? remainingGeometry : (route?.geometry ?? [])
          }
          center={center}
          focusTick={focusTick}
          zoom={zoom}
          onMapClick={handleMapClick}
          walkedGeometry={walkPhase === "walking" && showWalkedPath ? [...walkedTrackRef.current] : undefined}
          currentPosition={currentPosition ?? undefined}
          followPosition={walkPhase === "walking"}
          previewPlaces={plannerMode === "walk-companion" ? previewPlaces : []}
          onAddToWalk={walkPhase === "walking" ? undefined : addMapPlaceToWalk}
          addedIds={wishlist.map((w) => w.id)}
          pinnedIds={pinnedAttractionIds}
          // Gated on `walkPlan` existing, not on `walkPhase === "walking"` —
          // fixed 2026-08-24, found as a discoverability gap in the map-pin
          // work above. `handleBuildWalk` sends `pinnedAttractionIds` on
          // every build, including the very first one, so a pin set while
          // looking at the "planned" screen (before pressing Start Walk)
          // already does something real: it survives straight into
          // `Start Walk` and is honoured by the first automatic mid-walk
          // rebuild that follows. It does NOT survive a walker-initiated
          // `Build My Walk` retry — that path takes the `!options?.autoResume`
          // branch, which clears pins before the request body is even built,
          // and neither "+ 15 min and retry" nor the prompt-walk options pass
          // pins through. Restricting the tap to `walking` only hid a control
          // that already worked on this one path. Still off before a plan
          // exists at all, because until then the markers on screen may be
          // hand-drawn waypoints whose ids no pin means anything against.
          onTogglePin={walkPlan ? toggleAttractionPin : undefined}
          hudInset={walkMode}
          compactControls={!isExpanded}
          extraAttribution={walkMode && companion.attribution ? [companion.attribution] : undefined}
          callouts={walkMode ? callouts : undefined}
          onCalloutSelect={walkMode ? setSelectedCallout : undefined}
          previewRoutes={optionsOffer?.options.map((o, i) => ({
            id: `${o.theme}-${i}`,
            geometry: o.geometry,
            highlighted: i === collapseFlow.highlight,
          }))}
        />
        {walkMode && (
          <WalkHud
            alert={walkAlert}
            chat={<WalkChatBox chat={walkChat} lang={uiLang === "he" ? "he" : "en"} />}
            sheet={directionSheet}
            stats={walkStats}
            onDetails={() => setIsDetailsOpen(true)}
            onEndWalk={handleEndWalk}
          />
        )}
      </section>
      </div>
    </div>
  );
}
