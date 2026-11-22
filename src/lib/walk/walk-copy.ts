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
    closeDetails: "Back to walk",
    detailsTitle: "Walk details",
    /** The sheet's own words (the English strings above stay the default). */
    sheet: {
      en: {
        details: "Details",
        endWalk: "End walk",
        endConfirm: "End walk?",
        nextStop: "Next stop",
        stopOf: (index: number, total: number) => `Stop ${index} of ${total}`,
        minUnit: "min",
        overBudget: (min: number) => `+${min} min over plan`,
        upcoming: "Coming up",
        sections: { walk: "The walk", conditions: "Conditions", places: "Places around", display: "Display", about: "About the map" },
        backToPlan: "Back to previous plan",
      },
      he: {
        details: "פרטים",
        endWalk: "סיום הליכה",
        endConfirm: "לסיים את ההליכה?",
        nextStop: "התחנה הבאה",
        stopOf: (index: number, total: number) => `תחנה ${index} מתוך ${total}`,
        minUnit: "דק׳",
        overBudget: (min: number) => `+${min} דק׳ מעבר לתכנון`,
        upcoming: "בהמשך",
        sections: { walk: "ההליכה", conditions: "תנאים", places: "מקומות סביבי", display: "תצוגה", about: "על המפה" },
        backToPlan: "חזרה לתכנון הקודם",
      },
    },
    /** The GPS chip: shown only while the position is still being found or is weak. */
    gps: {
      en: { searching: "Finding your location…", weak: "Weak GPS", denied: "Location is off. Allow it in your browser settings." },
      he: { searching: "מאתר מיקום…", weak: "GPS חלש", denied: "המיקום כבוי. אפשר אותו בהגדרות הדפדפן." },
    },
  },
  /** The result line on the walk sheet after a rebuild (added, nothing fit, failed). */
  notice: {
    en: {
      added: (name: string, min: number) => `Added: ${name}${min > 0 ? ` · +${min} min` : ""}`,
      undo: "Undo",
      nothingFit: "No place fits the time that is left",
      gone: "That place is no longer within reach",
      replanFailed: "Couldn't update your route just now. Staying on the current one.",
      manualResume: "We reshaped your walk for your pace. Take a look, then press Start Walk.",
      noShorter: "Couldn't find a shorter way back from here.",
      stillUpdating: "Still updating your route. Try again in a moment.",
      // "Back to my route": every way a tap can end says so on the sheet (rejoin.ts, RejoinOutcome).
      wayBackDrawn: (m: number) => `Way back drawn. Follow the green line (${m} m).`,
      wayBackDrawnFar: (m: number) => `Way back drawn (${m} m). Walk to the road first, then follow the green line.`,
      wayBackBusy: "Still finding the way back…",
      wayBackStale: "Waiting for a fresh GPS fix. Tap again in a moment.",
      wayBackFailedOptions: "No street way back found. Finding other ways for you…",
      wayBackFailedRebuild: "No street way back found. Rebuilding your route from here.",
      wayBackFarRebuild: "You're far from the route. Rebuilding it from here.",
      wayBackRebuild: "Rebuilding your route from here.",
    },
    he: {
      added: (name: string, min: number) => `נוסף: ${name}${min > 0 ? ` · +${min} דק׳` : ""}`,
      undo: "ביטול",
      nothingFit: "לא נמצא מקום שנכנס בזמן שנשאר",
      gone: "המקום כבר לא בהישג יד",
      replanFailed: "לא הצלחנו לבנות מסלול מעודכן. ממשיכים במסלול הנוכחי.",
      manualResume: "התאמנו את ההליכה לקצב שלכם. הציצו, ולחצו על התחלה.",
      noShorter: "לא מצאנו דרך קצרה יותר חזרה מכאן.",
      stillUpdating: "המסלול עדיין מתעדכן. נסו שוב בעוד רגע.",
      wayBackDrawn: (m: number) => `סימנו את הדרך חזרה. לכו לפי הקו הירוק (${m} מ׳).`,
      wayBackDrawnFar: (m: number) => `סימנו את הדרך חזרה (${m} מ׳). קודם לכו אל הכביש, ואז לפי הקו הירוק.`,
      wayBackBusy: "עדיין מחפשים דרך חזרה…",
      wayBackStale: "ממתינים לקליטת GPS עדכנית. נסו שוב בעוד רגע.",
      wayBackFailedOptions: "לא נמצאה דרך חזרה ברחובות. מחפשים לכם דרכים אחרות…",
      wayBackFailedRebuild: "לא נמצאה דרך חזרה ברחובות. בונים מחדש את המסלול מכאן.",
      wayBackFarRebuild: "אתם רחוקים מהמסלול. בונים אותו מחדש מכאן.",
      wayBackRebuild: "בונים מחדש את המסלול מכאן.",
    },
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
  statsHe: {
    pace: "קצב הליכה",
    paceUnit: 'קמ"ש',
    paused: "עצירה",
    unknown: "—",
    timeToFinish: "דקות לסיום",
    timeUnit: "דק׳",
    distanceToFinish: 'ק"מ לסיום',
    distanceUnit: 'ק"מ',
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
    showWayBack: "Back to my route",
    replan: "Best route from here",
    dismiss: "I know where I'm going",
    talk: "Tell me what you want",
    findingWay: "Finding the way back…",
    wayBackFailed: "Couldn't find a way back just now. Re-plan from here?",
  },
  /** "Best route from here": keep the stop order or let Traike re-order (small question + the setting's labels). */
  routeOrder: {
    en: {
      title: "Which order for your stops?",
      keep: "Keep my stop order",
      reorder: "Let Traike re-order for the shortest route",
      cancel: "Cancel",
      setting: "When I tap \"Best route from here\"",
      ask: "Ask each time",
      keepOption: "Keep my stop order",
      reorderOption: "Re-order for the shortest route",
    },
    he: {
      title: "באיזה סדר לעבור בעצירות?",
      keep: "לשמור על סדר העצירות שלי",
      reorder: "שטרייק יסדר מחדש למסלול הקצר ביותר",
      cancel: "ביטול",
      setting: "כשאני לוחץ על \"המסלול הכי טוב מכאן\"",
      ask: "לשאול אותי כל פעם",
      keepOption: "לשמור על סדר העצירות שלי",
      reorderOption: "לסדר מחדש למסלול הקצר ביותר",
    },
  },
  /** The "you have arrived" card: shown once the route is walked and every stop is visited. */
  finished: {
    en: { title: "You've reached the end of your route", finish: "Finish walk", keep: "Keep walking" },
    he: { title: "הגעתם לסוף המסלול", finish: "סיום הליכה", keep: "ממשיכים ללכת" },
  },
  /** The plan assumes a much slower pace than the walker is really walking: offer to plan at the real one. */
  paceMismatch: {
    en: {
      title: (kmh: number) => `You're walking about ${kmh} km/h`,
      body: (plannedKmh: number) => `Your plan assumes ${plannedKmh} km/h.`,
      update: (kmh: number) => `Plan at ${kmh} km/h`,
      updateAndLengthen: (kmh: number) => `Plan at ${kmh} km/h and lengthen the walk`,
      spare: (min: number) => `About ${min} min to spare at that pace.`,
      keep: (plannedKmh: number) => `Keep ${plannedKmh} km/h`,
    },
    he: {
      title: (kmh: number) => `אתם הולכים כ-${kmh} קמ״ש`,
      body: (plannedKmh: number) => `התוכנית מניחה ${plannedKmh} קמ״ש.`,
      update: (kmh: number) => `לתכנן לפי ${kmh} קמ״ש`,
      updateAndLengthen: (kmh: number) => `לתכנן לפי ${kmh} קמ״ש ולהאריך את ההליכה`,
      spare: (min: number) => `נשארו כ-${min} דק׳ פנויות בקצב הזה.`,
      keep: (plannedKmh: number) => `להישאר ב-${plannedKmh} קמ״ש`,
    },
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
  /** The big centred off-route card (the English strings match `offRoute`, which existing tests read). */
  offRouteCard: {
    en: {
      askTitle: "You've gone off the planned route",
      title: "You're off the route",
      meters: "m from the route",
      back: "Back to my route",
      best: "Best route from here",
      talk: "Tell me what you want",
      dismiss: "I know where I'm going",
      finding: "Finding the way back…",
      autoReturn: "Returns to your route automatically if you do nothing",
      minimise: "Minimise",
      rebuildPill: "Rebuild route from here",
      pill: (m: number) => `Off route · ${m} m`,
      hint: (kind: string, m: number, bearing: number) => {
        switch (kind) {
          case "straight": return `Keep straight, ${m} m`;
          case "left": return `Turn left, ${m} m`;
          case "right": return `Turn right, ${m} m`;
          case "around": return `Turn around, ${m} m`;
          default: return `Head ${COMPASS_POINTS[Math.round((((bearing % 360) + 360) % 360) / 45) % 8]}, ${m} m`;
        }
      },
    },
    he: {
      askTitle: "סטיתם מהמסלול",
      title: "אתם מחוץ למסלול",
      meters: "מ׳ מהמסלול",
      back: "חזרה למסלול",
      best: "המסלול הכי טוב מכאן",
      talk: "ספרו לי מה אתם רוצים",
      dismiss: "הכול בסדר, ממשיכים ככה",
      finding: "מחפשים דרך חזרה…",
      autoReturn: "אם לא תבחרו, תחזרו למסלול אוטומטית",
      minimise: "הקטנה",
      rebuildPill: "בנו מסלול מחדש מכאן",
      pill: (m: number) => `מחוץ למסלול · ${m} מ׳`,
      hint: (kind: string, m: number, bearing: number) => {
        const north = ["צפונה", "צפון-מזרחה", "מזרחה", "דרום-מזרחה", "דרומה", "דרום-מערבה", "מערבה", "צפון-מערבה"];
        switch (kind) {
          case "straight": return `המשיכו ישר, ${m} מ׳`;
          case "left": return `פנו שמאלה, ${m} מ׳`;
          case "right": return `פנו ימינה, ${m} מ׳`;
          case "around": return `הסתובבו, ${m} מ׳`;
          default: return `לכו ${north[Math.round((((bearing % 360) + 360) % 360) / 45) % 8]}, ${m} מ׳`;
        }
      },
    },
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
