import type { Coordinates } from "@/lib/types";
import { haversineDistance } from "@/lib/utils/geo";
import type { AmenityItem } from "@/lib/walk/companion/amenity-detour";
import type { AmenityKind } from "@/lib/walk/companion/companion-types";

import type { ProposalPlace } from "./proposal";
import type { ChatStop, ParsedIntent } from "./intent";

export type ChatLang = "en" | "he";

/** Every action needs a tap; `label` is the button text. */
export type ChatAction =
  | { kind: "detour"; item: AmenityItem; label: string }
  | { kind: "drop"; stopId: string; label: string }
  | { kind: "add-stop"; label: string; /** A distance the walker typed: the stop must be within it. */ radiusM?: number }
  | { kind: "add-place"; name: string; coordinates: Coordinates; label: string }
  | { kind: "apply-changes"; adds: Array<{ name: string; coordinates: Coordinates }>; dropStopIds: string[]; label: string }
  /** One card for the whole change: the walker approves or declines it as a unit. `label` is unused by the card. */
  | { kind: "proposal"; adds: ProposalPlace[]; dropStopIds: string[]; dropNames: string[]; headBack: boolean; label: string }
  | { kind: "set-pace"; minPerKm: number; label: string }
  | { kind: "head-back"; label: string }
  /** "Back to my route": get onto the planned line again (the walk sheet's own Back to my route). */
  | { kind: "rejoin"; label: string }
  /** Hand the walker's own words to the planner chat (Details + chat, text prefilled; the walker taps Send). */
  | { kind: "ask-planner"; text: string; label: string };

export interface ChatReply {
  text: string;
  actions: ChatAction[];
}

export interface ChatContext {
  /** Stops still ahead, in walk order. */
  stops: ChatStop[];
  /** Amenities known near the route. Stays on the device. */
  amenities: AmenityItem[];
  /** Where the walker is now. Stays on the device. */
  position: Coordinates;
  /** Time picture of the walk, sent to the model so it can talk about shortening. */
  timing?: {
    elapsedMin: number;
    remainingMin: number | null;
    availableMin: number;
    overBudget: boolean;
    plannedKmh?: number | null;
    measuredKmh?: number | null;
    spareMin?: number | null;
  };
}

export const CHAT_AMENITY_RADIUS_M = 600;

const KIND_NAME: Record<AmenityKind, Record<ChatLang, string>> = {
  drinking_water: { en: "drinking water", he: "מים לשתייה" },
  toilets: { en: "toilet", he: "שירותים" },
  bench: { en: "bench", he: "ספסל" },
  shade: { en: "shade", he: "צל" },
  cafe: { en: "cafe", he: "בית קפה" },
  food: { en: "food place", he: "מקום לאכול" },
};

const T = {
  en: {
    found: (kind: string, name: string | undefined, m: number) =>
      `Nearest ${kind}${name ? `: ${name}` : ""}, about ${m} m away.`,
    notFound: (kind: string) => `I don't see a ${kind} near your route yet.`,
    unsupported: (kind: string) => `I can't look up a ${kind} yet.`,
    detour: "Take me there",
    drop: (name: string) => `Skip ${name}`,
    dropText: (name: string) => `I can drop ${name} to make the walk shorter.`,
    whichDrop: "Which stop should I drop to make the walk shorter?",
    skipText: (name: string) => `I can skip ${name}.`,
    whichStop: "Which stop? Say its name.",
    noStops: "There are no stops left to change.",
    headBack: "Head back",
    rejoin: "Back to my route",
    rejoinText: "I can take you back onto your route.",
    headBackText: "That is the last stop. I can take you back instead.",
    headBackOnly: "I can take you back to the start now.",
    shorterNoDrop: "The stops left are ones you picked, so I won't drop them. I can take you back instead.",
    setPace: (kmh: string) => `Got it, you walk about ${kmh} km/h. I can plan the rest of the walk at that speed.`,
    setPaceBtn: (kmh: string) => `Plan at ${kmh} km/h`,
    longer: "Add a stop",
    longerText: "I can look for one more stop ahead.",
    help: "Try: cafe, water, toilet, skip, shorter, longer, back to my route, or head back.",
    needsPlan: "That needs a new plan. Send it to Traike?",
    sendToPlanner: "Send to Traike",
  },
  he: {
    found: (kind: string, name: string | undefined, m: number) =>
      `${kind} הכי קרוב${name ? `: ${name}` : ""}, בערך ${m} מ׳ מכאן.`,
    notFound: (kind: string) => `עוד לא רואה ${kind} ליד המסלול.`,
    unsupported: (kind: string) => `עדיין אי אפשר לחפש ${kind}.`,
    detour: "קחו אותי לשם",
    drop: (name: string) => `לדלג על ${name}`,
    dropText: (name: string) => `אפשר לוותר על ${name} כדי לקצר את ההליכה.`,
    whichDrop: "על איזו עצירה לוותר כדי לקצר את ההליכה?",
    skipText: (name: string) => `אפשר לדלג על ${name}.`,
    whichStop: "על איזו עצירה? אמרו את השם שלה.",
    noStops: "לא נשארו עצירות לשנות.",
    headBack: "חזרה להתחלה",
    rejoin: "חזרה למסלול",
    rejoinText: "אפשר להחזיר אתכם אל המסלול.",
    headBackText: "זו העצירה האחרונה. אפשר לחזור במקום.",
    headBackOnly: "אפשר להחזיר אתכם לנקודת ההתחלה עכשיו.",
    shorterNoDrop: "העצירות שנשארו הן כאלה שבחרתם, אז לא אוותר עליהן. אפשר לחזור במקום.",
    setPace: (kmh: string) => `הבנתי, אתם הולכים בערך ${kmh} קמ״ש. אפשר לתכנן את המשך ההליכה לפי המהירות הזו.`,
    setPaceBtn: (kmh: string) => `לתכנן ב-${kmh} קמ״ש`,
    longer: "להוסיף עצירה",
    longerText: "אפשר לחפש עוד עצירה בהמשך.",
    help: "נסו: קפה, מים, שירותים, דלג, קצר יותר, ארוך יותר, חזרה למסלול, או חזרה להתחלה.",
    needsPlan: "זה דורש תוכנית חדשה. לשלוח לטרייק?",
    sendToPlanner: "שלחו לטרייק",
  },
} as const;

const headBack = (lang: ChatLang): ChatAction => ({ kind: "head-back", label: T[lang].headBack });

/** Turns a parsed intent into fixed-template text and tap actions. The model never writes this text. */
export function resolveChat(intent: ParsedIntent, ctx: ChatContext, lang: ChatLang): ChatReply {
  const t = T[lang];

  switch (intent.intent) {
    case "find": {
      const kind = intent.amenity;
      if (!kind) return { text: t.help, actions: [] };
      const kindName = KIND_NAME[kind][lang];
      // The map data only carries water and toilets, so these can never resolve: say so.
      if (kind === "bench" || kind === "shade") return { text: t.unsupported(kindName), actions: [] };
      let best: { item: AmenityItem; m: number } | null = null;
      for (const item of ctx.amenities) {
        if (item.kind !== kind) continue;
        const m = haversineDistance(ctx.position, item.coordinates);
        if (m <= CHAT_AMENITY_RADIUS_M && (best === null || m < best.m)) best = { item, m };
      }
      if (!best) return { text: t.notFound(kindName), actions: [] };
      return {
        text: t.found(kindName, best.item.name, Math.round(best.m / 10) * 10),
        actions: [{ kind: "detour", item: best.item, label: t.detour }],
      };
    }

    case "skip": {
      if (ctx.stops.length === 0) return { text: t.noStops, actions: [] };
      const stop = ctx.stops.find((s) => s.id === intent.stopId);
      if (!stop) return { text: t.whichStop, actions: [] };
      // Skipping the last stop leaves nothing to walk to: offer the way home instead.
      if (ctx.stops.length === 1) return { text: t.headBackText, actions: [headBack(lang)] };
      return {
        text: t.skipText(stop.name),
        actions: [{ kind: "drop", stopId: stop.id, label: t.drop(stop.name) }],
      };
    }

    case "shorter": {
      if (ctx.stops.length >= 2) {
        const droppable = ctx.stops.filter((s) => !s.pinned);
        // With several stops to choose from, the walker decides which one goes.
        if (droppable.length > 1) {
          return {
            text: t.whichDrop,
            actions: droppable.slice(0, 5).map((s) => ({ kind: "drop" as const, stopId: s.id, label: t.drop(s.name) })),
          };
        }
        const last = droppable[droppable.length - 1];
        if (last) {
          return {
            text: t.dropText(last.name),
            actions: [{ kind: "drop", stopId: last.id, label: t.drop(last.name) }],
          };
        }
        return { text: t.shorterNoDrop, actions: [headBack(lang)] };
      }
      return { text: t.headBackOnly, actions: [headBack(lang)] };
    }

    case "longer":
      return { text: t.longerText, actions: [{ kind: "add-stop", label: t.longer }] };

    case "set-pace": {
      const kmh = intent.speedKmh;
      if (!kmh) return { text: t.help, actions: [] };
      const label = String(Math.round(kmh * 10) / 10);
      return {
        text: t.setPace(label),
        actions: [{ kind: "set-pace", minPerKm: Math.round((60 / kmh) * 2) / 2, label: t.setPaceBtn(label) }],
      };
    }

    case "head-back":
      return { text: t.headBackOnly, actions: [headBack(lang)] };

    case "rejoin":
      return { text: t.rejoinText, actions: [{ kind: "rejoin", label: t.rejoin }] };

    default:
      return { text: t.help, actions: [] };
  }
}

/** For a signed-in walker's sentence the quick commands do not cover: offer to hand it to the planner chat. */
export function plannerHandoff(text: string, lang: ChatLang): ChatReply {
  const t = T[lang];
  return { text: t.needsPlan, actions: [{ kind: "ask-planner", text, label: t.sendToPlanner }] };
}

export const CHAT_HELP_TEXT: Record<ChatLang, string> = { en: T.en.help, he: T.he.help };
