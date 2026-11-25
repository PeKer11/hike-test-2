import { ADD_WORDS_HE } from "@/lib/walk/chat/intent";

/** The most places one card may add. */
export const MAX_ADDS = 3;

const WORD_NUMBERS: Record<string, number> = {
  // Hebrew
  "אחת": 1, "אחד": 1, "שתיים": 2, "שתים": 2, "שניים": 2, "שתי": 2, "שני": 2, "שלוש": 3, "שלושה": 3,
  // English
  one: 1, two: 2, three: 3,
};
const NUM = "(?:\\d+|אחת|אחד|שתיים|שתים|שניים|שתי|שני|שלוש|שלושה|one|two|three)";
/** A number, a distance or a time is not a count of places: "300 מטר", "2 km", "10 דקות". */
const MEASURE = /\d+(?:[.,]\d+)?\s*(?:ק"מ|ק״מ|קמ|מטרים|מטר|דקות|דקה|kilomet(?:er|re)s?|km|meters?|metres?|minutes?|mins?|m|מ)(?![\p{L}])/giu;
const ADD_WORDS = [
  ...ADD_WORDS_HE, "עוד", "תגדיל", "להגדיל", "הגדל", "תרחיב", "תאריך", "להאריך", "כמה",
  "add", "another", "more", "bigger", "longer", "extend", "one", "two", "three",
];

const wordRe = (w: string) => new RegExp(`(^|[^\\p{L}\\d])[בלהומכ]?${w}(?![\\p{L}\\d])`, "iu");

/**
 * How many places the walker asked to add: null when the text does not ask to add anything. A range or a vague
 * amount ("אחת או שתיים", "כמה", "עוד", "bigger") is the smallest number, and a bare ask is one. At most 3.
 */
export function requestedAddCount(text: string): number | null {
  const t = text.toLowerCase().replace(MEASURE, " ").replace(/[?!.,;:"'״׳]/g, " ");
  if (!ADD_WORDS.some((w) => wordRe(w).test(t))) return null;

  const found: number[] = [];
  for (const m of t.matchAll(new RegExp(`(^|[^\\p{L}\\d])[בלהומכ]?(${NUM})(?![\\p{L}\\d])`, "giu"))) {
    const raw = m[2].toLowerCase();
    found.push(/^\d+$/.test(raw) ? Number(raw) : WORD_NUMBERS[raw]);
  }
  // "another stop or two": one numeral after an "or" with nothing counted before it means the first option is one.
  if (found.length === 1 && new RegExp(`(?:או|or)\\s+(?:לפחות\\s+)?[בלהומכ]?${NUM}(?![\\p{L}\\d])`, "iu").test(t) && !new RegExp(`${NUM}\\s+\\S+\\s+(?:או|or)\\s+${NUM}`, "iu").test(t)) {
    found.unshift(1);
  }
  if (found.length === 0) return 1;
  return Math.min(MAX_ADDS, Math.max(1, Math.min(...found)));
}
