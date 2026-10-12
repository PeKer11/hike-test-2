/**
 * Strings for discovery callouts, tier badges, direction options and the
 * interest level, English and Hebrew. `{name}`-style placeholders are filled by
 * `discoveryText`. Reached from the UI as `walkCopy.discovery`; the tables live
 * here so server-only code (commons-density) need not import the UI copy.
 */
export type CopyLang = "en" | "he";

const en = {
  "badge.registered": "Listed",
  "badge.mapped": "Mapped",
  "badge.crowd": "Photo spot",
  "badge.detected": "Unverified",
  "warn.crowd":
    "Many people photograph here — it's not a listed place. Check before you go.",
  "warn.detected":
    "Looks green or watery on satellite land-cover data. Not verified — may be private or inaccessible.",
  "detected.nameGreen": "Green area (unverified)",
  "detected.nameWater": "Water (unverified)",
  "detected.lead":
    "Detected from satellite data, not a registered place. Looks green on land-cover data but isn't on the map. We haven't checked that it's safe or open to the public.",
  "detected.leadWater":
    "Detected from satellite data, not a registered place. Looks like water on satellite data but isn't on the map. It may be a reservoir or a fenced pool.",
  "hazard.private":
    "May be private land or farmland. Don't enter fenced or signed areas.",
  "hazard.reserve":
    "Nature reserve: stay on marked trails; hours and closures apply. Check *3639.",
  "hazard.flood":
    "Dry streambed. Flash floods can come from rain far away. Don't enter if rain is forecast.",
  "hazard.fire":
    "Fire season: forests can close on high-danger days. No fires. Report fire: 102.",
  "hazard.cliff": "Cliff or steep drop nearby. Keep to marked paths.",
  "hazard.mixed":
    "Mixed area: stay on main streets and follow local guidance.",
  "detected.checkSigns": "Check signs and local rules on site.",
  "detected.footer":
    "Satellite data (ESA WorldCover 2021) can be wrong or out of date. Emergency: 100 police, 101 ambulance, 102 fire.",
  "options.title": "You've gone a different way — pick a direction",
  "options.nature": "Toward nature",
  "options.food": "Food & sights",
  "options.short": "Shorter, back toward the start",
  "options.back": "Back to my plan",
  "options.stats": "{min} min · {km} km · {n} stops",
  "options.choose": "Go this way",
  "options.hint": "Tap a direction to preview it, then choose.",
  "options.loading": "Finding other directions…",
  "options.different": "Show me something different",
  "deviation.whileHere": "While you're here: {name} · {m} m {side}",
  "side.left": "on your left",
  "side.right": "on your right",
  "side.on": "on your path",
  "level.title": "Things along the way",
  "level.label": "How much to point out",
  "level.quiet": "Quiet",
  "level.normal": "Normal",
  "level.chatty": "Chatty",
} as const;

export type DiscoveryCopyKey = keyof typeof en;

const he: Record<DiscoveryCopyKey, string> = {
  "badge.registered": "רשום",
  "badge.mapped": "ממופה",
  "badge.crowd": "נקודת צילום",
  "badge.detected": "לא מאומת",
  "warn.crowd":
    "הרבה אנשים מצלמים כאן — זה לא מקום רשום. כדאי לבדוק לפני שהולכים.",
  "warn.detected":
    "נראה ירוק או מים בנתוני כיסוי קרקע מלוויין. לא מאומת — ייתכן שפרטי או שאין גישה.",
  "detected.nameGreen": "אזור ירוק (לא מאומת)",
  "detected.nameWater": "מים (לא מאומתים)",
  "detected.lead":
    "זוהה מנתוני לוויין, לא מקום רשום. נראה ירוק בנתוני כיסוי קרקע אבל לא מופיע במפה. לא בדקנו שהמקום בטוח או פתוח לציבור.",
  "detected.leadWater":
    "זוהה מנתוני לוויין, לא מקום רשום. נראה כמו מים בנתוני לוויין אבל לא מופיע במפה. ייתכן שזה מאגר או בריכה מגודרת.",
  "hazard.private":
    "ייתכן שזו קרקע פרטית או חקלאית. אל תיכנסו לשטח מגודר או מסומן.",
  "hazard.reserve":
    "שמורת טבע: הולכים רק בשבילים מסומנים, ויש שעות פתיחה וסגירות. בדקו ב־‎*3639.",
  "hazard.flood":
    "אפיק נחל יבש. שיטפונות עלולים להגיע מגשם שיורד הרחק מכאן. אל תיכנסו אם צפוי גשם.",
  "hazard.fire":
    "עונת שריפות: יערות עלולים להיסגר בימי סכנה. אסור להדליק אש. דיווח על שריפה: 102.",
  "hazard.cliff": "יש מצוק או ירידה תלולה בסביבה. הישארו בשבילים מסומנים.",
  "hazard.mixed":
    "אזור מעורב: הישארו ברחובות ראשיים ופעלו לפי הנחיות מקומיות.",
  "detected.checkSigns": "בדקו שילוט וכללים מקומיים בשטח.",
  "detected.footer":
    "נתוני לוויין (ESA WorldCover 2021) עלולים להיות שגויים או לא עדכניים. חירום: 100 משטרה, 101 אמבולנס, 102 כיבוי אש.",
  "options.title": "הלכת בדרך אחרת — בחר כיוון",
  "options.nature": "לכיוון הטבע",
  "options.food": "אוכל ואטרקציות",
  "options.short": "קצר יותר, חזרה להתחלה",
  "options.back": "חזרה לתוכנית שלי",
  "options.stats": "{min} דק׳ · {km} ק״מ · {n} עצירות",
  "options.choose": "בוא נלך כך",
  "options.hint": "הקש על כיוון לתצוגה מקדימה, ואז בחר.",
  "options.loading": "מחפש כיוונים אחרים…",
  "options.different": "הראה לי משהו אחר",
  "deviation.whileHere": "כשאתה כאן: {name} · {m} מ׳ {side}",
  "side.left": "משמאלך",
  "side.right": "מימינך",
  "side.on": "על המסלול",
  "level.title": "דברים בדרך",
  "level.label": "כמה להצביע על מקומות",
  "level.quiet": "שקט",
  "level.normal": "רגיל",
  "level.chatty": "פטפטני",
};

export const discoveryCopy: Record<CopyLang, Record<DiscoveryCopyKey, string>> = {
  en,
  he,
};

export function discoveryText(
  lang: CopyLang,
  key: DiscoveryCopyKey,
  vars: Record<string, string | number> = {},
): string {
  return discoveryCopy[lang][key].replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}
