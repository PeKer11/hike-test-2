import type { Coordinates } from "@/lib/types";
import { haversineDistance } from "@/lib/utils/geo";
import type { AmenityItem } from "@/lib/walk/companion/amenity-detour";
import type { AmenityKind } from "@/lib/walk/companion/companion-types";

import type { ChatStop, ParsedIntent } from "./intent";

export type ChatLang = "en" | "he";

/** Every action needs a tap; `label` is the button text. */
export type ChatAction =
  | { kind: "detour"; item: AmenityItem; label: string }
  | { kind: "drop"; stopId: string; label: string }
  | { kind: "add-stop"; label: string }
  | { kind: "add-place"; name: string; coordinates: Coordinates; label: string }
  | { kind: "apply-changes"; adds: Array<{ name: string; coordinates: Coordinates }>; dropStopIds: string[]; label: string }
  | { kind: "head-back"; label: string };

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
    skipText: (name: string) => `I can skip ${name}.`,
    whichStop: "Which stop? Say its name.",
    noStops: "There are no stops left to change.",
    headBack: "Head back",
    headBackText: "That is the last stop. I can take you back instead.",
    headBackOnly: "I can take you back to the start now.",
    shorterNoDrop: "The stops left are ones you picked, so I won't drop them. I can take you back instead.",
    longer: "Add a stop",
    longerText: "I can look for one more stop ahead.",
    help: "Try: cafe, water, toilet, skip, shorter, longer, or head back.",
  },
  he: {
    found: (kind: string, name: string | undefined, m: number) =>
      `${kind} הכי קרוב${name ? `: ${name}` : ""}, בערך ${m} מ׳ מכאן.`,
    notFound: (kind: string) => `עוד לא רואה ${kind} ליד המסלול.`,
    unsupported: (kind: string) => `עדיין אי אפשר לחפש ${kind}.`,
    detour: "קחו אותי לשם",
    drop: (name: string) => `לדלג על ${name}`,
    dropText: (name: string) => `אפשר לוותר על ${name} כדי לקצר את ההליכה.`,
    skipText: (name: string) => `אפשר לדלג על ${name}.`,
    whichStop: "על איזו עצירה? אמרו את השם שלה.",
    noStops: "לא נשארו עצירות לשנות.",
    headBack: "חזרה",
    headBackText: "זו העצירה האחרונה. אפשר לחזור במקום.",
    headBackOnly: "אפשר להחזיר אתכם לנקודת ההתחלה עכשיו.",
    shorterNoDrop: "העצירות שנשארו הן כאלה שבחרתם, אז לא אוותר עליהן. אפשר לחזור במקום.",
    longer: "להוסיף עצירה",
    longerText: "אפשר לחפש עוד עצירה בהמשך.",
    help: "נסו: קפה, מים, שירותים, דלג, קצר יותר, ארוך יותר, או חזרה.",
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

    case "head-back":
      return { text: t.headBackOnly, actions: [headBack(lang)] };

    default:
      return { text: t.help, actions: [] };
  }
}

export const CHAT_HELP_TEXT: Record<ChatLang, string> = { en: T.en.help, he: T.he.help };
