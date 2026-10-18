"use client";

import { socialEnabled } from "@/lib/social/flag";
import type { UiLanguageSetting } from "@/lib/types/walk-settings";

type Lang = "he" | "en";

const COPY: Record<Lang, Record<string, string>> = {
  en: {
    title: "Before your first walk",
    intro: "Traike gets better the more it knows you. Your choice, any time:",
    learn:
      "What we learn: places you like, your pace, and daily habits (for example, “usually eats around 16:00”) so we can ask at the right time. After each walk we may keep a short summary.",
    ai:
      "What the AI sees: to plan a walk it gets what you type in the request box, your saved preference notes, and the names of nearby places. It never gets your exact GPS position or track, never your name or contact details, and your daily habits (like eating times) are never sent to the AI. After a walk, a summary is also sent to the AI: place identifiers (OpenStreetMap ids) of places you visited, dismissed or declined, plus walk numbers such as duration and distance. What you type is saved in your request history.",
    control:
      "You can change this in Settings whenever you like, and “Forget everything” deletes it all.",
    social:
      "Separately and optionally: you can later choose to contribute anonymously to community recommendations (Settings > Community). It is off unless you turn it on, and nothing in this choice enables it.",
    yes: "Yes, personalize my walks",
    no: "No thanks, keep it generic",
    lang: "Language",
  },
  he: {
    title: "לפני ההליכה הראשונה",
    intro: "Traike משתפר ככל שהוא מכיר אותך. ההחלטה שלך, ואפשר לשנות אותה בכל זמן:",
    learn:
      "מה אנחנו לומדים: מקומות שאהבת, הקצב שלך והרגלים יומיים (למשל “בדרך כלל אוכל בסביבות 16:00”) כדי לשאול בזמן הנכון. אחרי כל הליכה אולי נשמור סיכום קצר.",
    ai:
      "מה ה־AI רואה: כדי לתכנן הליכה הוא מקבל את מה שאתם מקלידים בתיבת הבקשה, את הערות ההעדפה ששמרנו ואת שמות המקומות הסמוכים. הוא לא מקבל את מיקום ה־GPS המדויק או המסלול שלכם, לא את שמכם או פרטי הקשר שלכם, וההרגלים היומיים שלכם (כמו שעות אוכל) לא נשלחים ל־AI בכלל. אחרי הליכה נשלח ל־AI גם סיכום: מזהי מקומות (מזהי OpenStreetMap) של מקומות שביקרתם בהם, דחיתם או סירבתם להם, יחד עם מספרי ההליכה כמו משך ומרחק. מה שאתם מקלידים נשמר בהיסטוריית הבקשות.",
    control:
      "אפשר לשנות בהגדרות בכל רגע, ו“לשכוח הכול” מוחק את הכל.",
    social:
      "בנפרד ובאופן רשותי: אפשר לבחור בהמשך לתרום באנונימיות להמלצות הקהילה (הגדרות > קהילה). זה כבוי אלא אם תפעילו אותו, והבחירה כאן לא מפעילה אותו.",
    yes: "כן, התאימו לי את ההליכות",
    no: "לא תודה, בלי התאמה אישית",
    lang: "שפה",
  },
};

/** One-time consent screen, shown before the first walk or purchase. */
export const CONSENT_COPY = COPY;

export function ConsentGate({
  lang,
  onLanguage,
  onAnswer,
}: {
  lang: Lang;
  onLanguage: (value: UiLanguageSetting) => void;
  onAnswer: (granted: boolean) => void;
}) {
  const t = COPY[lang];
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-title"
      dir={lang === "he" ? "rtl" : "ltr"}
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-charcoal/60 p-4"
    >
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-cream p-6 text-charcoal shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <h2 id="consent-title" className="font-display text-xl font-bold text-forest">
            {t.title}
          </h2>
          <div role="group" aria-label={t.lang} className="flex gap-1 text-sm">
            {(["he", "en"] as const).map((code) => (
              <button
                key={code}
                type="button"
                aria-pressed={lang === code}
                onClick={() => onLanguage(code)}
                className={`rounded-full px-3 py-1 ${
                  lang === code ? "bg-forest text-cream" : "bg-charcoal/10"
                }`}
              >
                {code === "he" ? "עברית" : "English"}
              </button>
            ))}
          </div>
        </div>
        <p className="text-sm">{t.intro}</p>
        <p className="text-sm">{t.learn}</p>
        <p className="text-sm">{t.ai}</p>
        <p className="text-xs text-charcoal/70">{t.control}</p>
        {socialEnabled() ? <p className="text-xs text-charcoal/70">{t.social}</p> : null}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => onAnswer(true)}
            className="rounded-xl bg-forest px-4 py-3 font-semibold text-cream"
          >
            {t.yes}
          </button>
          <button
            type="button"
            onClick={() => onAnswer(false)}
            className="rounded-xl bg-charcoal/10 px-4 py-3"
          >
            {t.no}
          </button>
        </div>
      </div>
    </div>
  );
}
