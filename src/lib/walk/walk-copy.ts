/**
 * Every user-facing string on the live-walk screen, in one place so a Hebrew
 * (or any other) translation can replace this file's contents without touching
 * components. Strings that carry a value are small functions, not templates.
 */
import type { AttractionCategory } from "@/lib/types";
import { discoveryCopy, discoveryText } from "@/lib/walk/discovery-copy";
import type { Relation } from "@/lib/walk/poi-relation";

const COMPASS_POINTS = [
  "north",
  "north-east",
  "east",
  "south-east",
  "south",
  "south-west",
  "west",
  "north-west",
] as const;

/** Nearest 10 m, never "0 m": a walker cannot act on finer than that. */
function roundedMeters(meters: number): string {
  return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
}

export const walkCopy = {
  /** Discovery callouts, tier badges, direction options (EN + HE tables). */
  discovery: { ...discoveryCopy, text: discoveryText },
  hud: {
    details: "Details",
    endWalk: "End walk",
    closeDetails: "Close",
    detailsTitle: "Walk details",
  },
  stats: {
    pace: "Walking pace",
    paceUnit: "km/h",
    paused: "Paused",
    unknown: "—",
    timeToFinish: "Time to finish",
    timeUnit: "min",
    distanceToFinish: "Distance to finish",
    distanceUnit: "km",
  },
  pace: {
    slowTitle: "You're going slower than planned",
    slowAction: "Show shorter route",
    slowKeepStops: "Keep all stops",
    fastTitle: "You're at a great pace!",
    fastAction: "Extend the hike",
    dismiss: "Dismiss",
    // The "ask" setting's standing question (same wording the old banner used).
    askStill: "You've been still for a while. Planning to keep going at this rate?",
    askSlow: "You're walking slower than planned. Do you plan to speed back up?",
    askFast: "You're ahead of plan. Want to add another stop?",
    askSlowConfirm: "Adjust my route",
    askFastConfirm: "Add a stop",
    askSlowDismiss: "I'll speed up",
    askFastDismiss: "No, keep it as is",
    askMoreTime: "Give me more time",
  },
  offRoute: {
    title: "You're off the route",
    // The question the "ask" setting poses: same wording the old banner used.
    askTitle: "You've gone off the planned route",
    showWayBack: "Show way back",
    replan: "Redraw from here",
    dismiss: "I know where I'm going",
    findingWay: "Finding the way back…",
    wayBackFailed: "Couldn't find a way back just now. Re-plan from here?",
  },
  turn: {
    straight: (m: number) => `Keep straight, ${roundedMeters(m)}`,
    left: (m: number) => `Turn left, ${roundedMeters(m)}`,
    right: (m: number) => `Turn right, ${roundedMeters(m)}`,
    around: (m: number) => `Turn around, ${roundedMeters(m)}`,
    compass: (bearingDeg: number, m: number) =>
      `Head ${COMPASS_POINTS[Math.round((((bearingDeg % 360) + 360) % 360) / 45) % 8]}, ${roundedMeters(m)}`,
    // Appended to the card title once a direction is known.
    toGetBack: (instruction: string) => `${instruction} to get back on track`,
  },
  callout: {
    nextStop: "Next stop",
    osmBadge: "OSM",
    mappedBadge: "Mapped",
    relation: (relation: Relation): string => {
      switch (relation) {
        case "here":
          return "right here";
        case "ahead":
          return "ahead";
        case "left":
          return "on your left";
        case "right":
          return "on your right";
        case "behind":
          return "behind you";
      }
    },
    line: (categoryLabel: string, relationLabel: string, meters: number) =>
      `${categoryLabel} · ${relationLabel} · ${Math.round(meters)} m`,
    dismiss: "Dismiss",
  },
  visit: {
    title: "Would you like to visit?",
    detour: (minutes: number) => `≈ ${minutes} min detour and visit`,
    add: "Add to walk",
    notNow: "Not now",
  },
  scenery: {
    wood: "Wooded area (mapped)",
    park: "Park (mapped)",
    water: "Water (mapped)",
    beach: "Beach (mapped)",
    viewpoint: "Viewpoint (mapped)",
    other: "Green space (mapped)",
  },
  categories: {
    landmark: "Landmark",
    museum: "Museum",
    park: "Park",
    food: "Food & drink",
    viewpoint: "Viewpoint",
    religious: "Place of worship",
    shopping: "Shop",
    entertainment: "Entertainment",
    nature: "Nature",
    other: "Place",
  } satisfies Record<AttractionCategory, string>,
} as const;
