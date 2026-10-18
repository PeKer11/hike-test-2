/**
 * Question and answer strings for the active companion, English and Hebrew.
 * Hebrew uses plural, gender-neutral address. `{name}` placeholders are filled
 * by `companionText`. Answer labels use the `answer.*` keys.
 */
import type { CopyLang } from "@/lib/walk/discovery-copy";
import type { QuestionKind } from "@/lib/walk/companion/companion-types";

const en = {
  "q.pace-slow": "Slower than planned. Skip {stop} to finish on time?",
  "q.pace-slow.nostop": "Slower than planned. Shorten the walk to finish on time?",
  "q.pace-fast": "You're ahead of time. Add {place} ({d} min)?",
  "q.toward-green": "You're heading toward {park}. Build a loop from here?",
  "q.sunset": "Sunset in {m} min, {r} min of walking left. Shorten to finish in daylight?",
  "q.heat-water": "It's {t}°C now. Water at {place}, {d} m away?",
  "q.rest": "Bench in the shade {d} m ahead. Stop for 5 min?",
  "q.stop-closing": "{stop} closes at {hhmm}. Skip this stop?",
  "q.rain": "Rain is likely soon ({p}%). Head back?",
  "q.stop-closing.info": "{stop} closes at {hhmm}.",
  "q.habit-eat": "It's around the time you usually eat. Stop for food?",
  "q.habit-coffee": "It's around the time you usually have coffee. Stop for one?",
  "habit.somePlace": "a place nearby",
  "notice.habitMuted.eat": "I'll stop suggesting meal stops. Turn it back on in Settings.",
  "notice.habitMuted.coffee": "I'll stop suggesting coffee stops. Turn it back on in Settings.",
  "notice.amenityFailed": "Couldn't find a walkable way there. Staying on your route.",
  "ui.voiceOn": "Spoken questions: on",
  "ui.voiceOff": "Spoken questions: off",
  "answer.ok": "OK",
  "answer.shorten": "Shorten",
  "answer.keepAll": "Keep all, add {n} min",
  "answer.notNow": "Not now",
  "answer.add": "Add it",
  "answer.finishEarly": "Finish early (head back)",
  "answer.loopFromHere": "Loop from here",
  "answer.backToRoute": "Back to my route",
  "answer.continue": "Continue",
  "answer.takeMe": "Take me there",
  "answer.imFine": "I'm fine",
  "answer.yes": "Yes",
  "answer.no": "No",
  "answer.skip": "Skip it",
  "answer.headBack": "Head back",
  "answer.habitTakeMe": "Take me to {place} ({d} m)",
  "answer.habitAlreadyEat": "Already ate",
  "answer.habitAlreadyCoffee": "Already had one",
} as const;

export type CompanionCopyKey = keyof typeof en;

const he: Record<CompanionCopyKey, string> = {
  "q.pace-slow": "הולכים לאט מהמתוכנן. לוותר על {stop} כדי לסיים בזמן?",
  "q.pace-slow.nostop": "הולכים לאט מהמתוכנן. לקצר את ההליכה כדי לסיים בזמן?",
  "q.pace-fast": "אתם מקדימים. להוסיף את {place} ({d} דק׳)?",
  "q.toward-green": "פניתם לכיוון {park}. לבנות לולאה מכאן?",
  "q.sunset": "השקיעה בעוד {m} דק׳ ונשארו {r} דק׳ הליכה. לקצר כדי לסיים לפני החשכה?",
  "q.heat-water": "עכשיו {t}°. יש מים ב־{place}, במרחק {d} מ׳. לעצור?",
  "q.rest": "ספסל בצל בעוד {d} מ׳. לעצור ל־5 דקות?",
  "q.stop-closing": "שעת הסגירה של {stop}: {hhmm}. לדלג על העצירה?",
  "q.rain": "צפוי גשם בקרוב ({p}%). לחזור?",
  "q.stop-closing.info": "שעת הסגירה של {stop}: {hhmm}.",
  "q.habit-eat": "זה בערך הזמן שבו אתם בדרך כלל אוכלים. לעצור לאכול?",
  "q.habit-coffee": "זה בערך הזמן שבו אתם בדרך כלל שותים קפה. לעצור לקפה?",
  "habit.somePlace": "מקום קרוב",
  "notice.habitMuted.eat": "אפסיק להציע עצירות אוכל. אפשר להחזיר בהגדרות.",
  "notice.habitMuted.coffee": "אפסיק להציע עצירות קפה. אפשר להחזיר בהגדרות.",
  "notice.amenityFailed": "לא נמצאה דרך הליכה לשם. ממשיכים במסלול.",
  "ui.voiceOn": "שאלות בקול: פעיל",
  "ui.voiceOff": "שאלות בקול: כבוי",
  "answer.ok": "הבנתי",
  "answer.shorten": "לקצר",
  "answer.keepAll": "לשמור הכול ולהוסיף {n} דק׳",
  "answer.notNow": "לא עכשיו",
  "answer.add": "להוסיף",
  "answer.finishEarly": "לסיים מוקדם (לחזור)",
  "answer.loopFromHere": "ליצור לולאה מכאן",
  "answer.backToRoute": "לחזור למסלול",
  "answer.continue": "להמשיך",
  "answer.takeMe": "לקחת אותי לשם",
  "answer.imFine": "לא צריך",
  "answer.yes": "כן",
  "answer.no": "לא",
  "answer.skip": "לדלג",
  "answer.headBack": "לחזור",
  "answer.habitTakeMe": "לקחת אותי אל {place} ({d} מ׳)",
  "answer.habitAlreadyEat": "כבר אכלתי",
  "answer.habitAlreadyCoffee": "כבר שתיתי",
};

export const companionCopy: Record<CopyLang, Record<CompanionCopyKey, string>> = {
  en,
  he,
};

export function isCompanionCopyKey(key: string): key is CompanionCopyKey {
  return Object.hasOwn(en, key);
}

/** Fill `{placeholders}`; an unknown key returns the key (never throws). */
export function companionText(
  lang: CopyLang,
  key: string,
  vars: Record<string, string | number> = {},
): string {
  const template = isCompanionCopyKey(key) ? companionCopy[lang][key] : key;
  return template.replace(/\{(\w+)\}/g, (m, name: string) =>
    Object.hasOwn(vars, name) ? String(vars[name]) : m,
  );
}

/** The question text key for a candidate (pace-slow without a droppable stop has its own). */
export function questionKey(
  kind: QuestionKind,
  ctx: Record<string, string | number>,
): CompanionCopyKey {
  if (kind === "pace-slow" && !ctx.stop) return "q.pace-slow.nostop";
  if (kind === "stop-closing" && ctx.info) return "q.stop-closing.info";
  return `q.${kind}` as CompanionCopyKey;
}
