import type { AmenityKind } from "@/lib/walk/companion/companion-types";

export type ChatIntentName =
  | "find"
  | "skip"
  | "shorter"
  | "longer"
  | "head-back"
  | "unknown";

export interface ParsedIntent {
  intent: ChatIntentName;
  amenity?: AmenityKind;
  stopId?: string;
}

/** A stop the walker has not visited yet. Names stay on the device unless the LLM fallback is used. */
export interface ChatStop {
  id: string;
  name: string;
  pinned: boolean;
}

// English keywords match at a word start (so "cafes" works, "site" does not hit "sit"); WHOLE_WORDS
// must also end there ("loo" is not "look"). Hebrew matches whole tokens, allowing one attached
// prefix letter (ה, ב, ל, ו, מ, כ): "בקפה" is "coffee", but "אצל"/"שמים" are not "צל"/"מים".
const AMENITY_WORDS: Record<AmenityKind, string[]> = {
  drinking_water: ["water", "drink", "fountain", "thirsty", "מים", "שתיה", "שתייה", "ברזיה", "ברזייה", "צמא", "צמאה", "צמאים", "צמאות"],
  toilets: ["toilet", "restroom", "bathroom", "wc", "loo", "שירותים", "שרותים", "שירותי ציבור"],
  bench: ["bench", "sit down", "seat", "ספסל", "לשבת"],
  shade: ["shade", "shady", "צל"],
  cafe: ["cafe", "coffee", "קפה"],
  food: ["food", "eat", "hungry", "restaurant", "lunch", "snack", "falafel", "אוכל", "לאכול", "רעב", "רעבה", "רעבים", "רעבות", "מסעדה", "נשנוש", "פלאפל"],
};

// Unambiguous: always a skip.
const SKIP_WORDS = [
  "skip", "remove", "forget", "cancel", "דלג", "דלגו", "תדלג", "תדלגו", "הסר", "תוריד", "הורד", "בטל", "וותר",
];
// "drop by a cafe", "לא רוצה ללכת עוד": only a skip when they point at a stop.
const WEAK_SKIP_WORDS = ["drop", "dont want", "do not want", "no need", "לא רוצה", "אין צורך"];
const STOP_REF = ["stop", "place", "עצירה", "תחנה"];
const WHOLE_WORDS = new Set(["loo", "wc"]);
const HEAD_BACK_WORDS = [
  "head back", "go back", "take me back", "lead me back", "back to the start", "back to start",
  "wrap up", "finish now", "end the walk", "go home",
  "חזור", "נחזור", "תחזור", "חזרה", "תחזיר", "להחזיר", "לסיים", "נסיים", "הביתה",
];
const SHORTER_WORDS = [
  "shorter", "shorten", "cut it short", "too long", "less time", "tired", "exhausted",
  "קצר", "קצרה", "קצרים", "קצרות", "לקצר", "פחות זמן", "עייף", "עייפה", "עייפים", "עייפות", "מתיש",
  "ארוך מדי", "ארוך מידי", "ארוכה מדי", "ארוכה מידי",
];
const LONGER_WORDS = [
  "longer", "extend", "add a stop", "add stop", "another stop", "more time", "more stops", "add more",
  "ארוך יותר", "יותר ארוך", "ארוכה יותר", "יותר ארוכה", "להאריך", "עוד עצירה", "עוד תחנה", "עוד זמן", "תוסיף",
];

// Words that carry no stop identity; what is left after removing them is a stop name or nothing.
const FILLER = new Set([
  "the", "a", "an", "it", "this", "that", "next", "stop", "place", "please", "me", "my", "one", "now",
  "let", "lets", "s", "just", "ok", "on", "את", "על", "זה", "בוא", "בואו", "זאת", "הזאת", "הזה", "הבאה", "הבא", "עצירה", "תחנה", "העצירה", "התחנה", "בבקשה", "אותה", "אותו", "נא",
]);

const HEBREW = /[֐-׿]/;
// Hebrew verb stems take tense/person letters (תדלג, נקצר, לוותר, דלגו); nouns only take one article/preposition prefix.
const VERB_STEMS = new Set(["דלג", "קצר", "חזור", "וותר"]);

function wordRegex(word: string, flags = ""): RegExp {
  const body = word.replace(/ /g, "\\s+");
  if (HEBREW.test(word)) {
    const verb = VERB_STEMS.has(word);
    const pre = verb ? "[תנילוי]?" : "[בלהומכ]?";
    const suf = verb ? "[וי]?" : "";
    return new RegExp(`(^|[^\\p{L}])${pre}${body}${suf}(?![\\p{L}])`, `u${flags}`);
  }
  return new RegExp(`(^|[^a-z])${body}[a-z]*`, flags);
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/['’`"״׳]/g, "").replace(/\s+/g, " ").trim();
}

function hasWord(text: string, word: string): boolean {
  const body = word.replace(/ /g, "\\s+");
  if (HEBREW.test(word)) return wordRegex(word).test(text);
  const end = WHOLE_WORDS.has(word) ? "s?([^a-z]|$)" : "";
  return new RegExp(`(^|[^a-z])${body}${end}`).test(text);
}

const hasAny = (text: string, words: string[]) => words.some((w) => hasWord(text, w));

function amenityIn(text: string): AmenityKind | undefined {
  for (const kind of Object.keys(AMENITY_WORDS) as AmenityKind[]) {
    if (hasAny(text, AMENITY_WORDS[kind])) return kind;
  }
  return undefined;
}

/** The first remaining stop, or the stop the walker named, or nothing when the words do not say. */
function skipTarget(text: string, stops: ChatStop[], needsRef = false): string | undefined {
  if (stops.length === 0) return undefined;
  let rest = text;
  // Longest first, so "תדלג" goes whole and does not leave a stray "ת" behind.
  for (const w of [...SKIP_WORDS, ...WEAK_SKIP_WORDS].sort((a, b) => b.length - a.length)) {
    rest = rest.replace(wordRegex(w, "g"), " ");
  }
  const tokens = rest.split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= (HEBREW.test(t) ? 2 : 1) && !FILLER.has(t));
  // "drop by a cafe" is a cafe search: for a weak skip, an amenity word is not a stop name.
  const nameTokens = needsRef ? tokens.filter((t) => !amenityIn(t)) : tokens;
  for (const stop of stops) {
    const name = normalize(stop.name);
    if (name.length < 3) continue;
    if (text.includes(name)) return stop.id;
    if (nameTokens.some((t) => t.length >= 3 && (name.includes(t) || t.includes(name)))) return stop.id;
  }
  // "skip", "skip this", "skip the next one": the first stop ahead. Any other word means a name we could not match.
  return tokens.length === 0 && (!needsRef || hasAny(text, STOP_REF)) ? stops[0].id : undefined;
}

/**
 * Keyword intent for the walk chat. No network, no model. Precedence when a
 * sentence has several: skip > find > head-back > shorter > longer.
 * `stops` are the stops still ahead, in walk order.
 */
export function parseIntent(rawText: string, stops: ChatStop[]): ParsedIntent {
  const text = normalize(rawText);
  if (!text) return { intent: "unknown" };

  if (hasAny(text, SKIP_WORDS)) {
    const stopId = skipTarget(text, stops);
    return stopId ? { intent: "skip", stopId } : { intent: "skip" };
  }
  if (hasAny(text, WEAK_SKIP_WORDS)) {
    const stopId = skipTarget(text, stops, true);
    if (stopId) return { intent: "skip", stopId };
    if (hasAny(text, STOP_REF)) return { intent: "skip" };
  }
  const amenity = amenityIn(text);
  if (amenity) return { intent: "find", amenity };
  if (hasAny(text, HEAD_BACK_WORDS)) return { intent: "head-back" };
  if (hasAny(text, SHORTER_WORDS)) return { intent: "shorter" };
  if (hasAny(text, LONGER_WORDS)) return { intent: "longer" };
  return { intent: "unknown" };
}
