/** Words for the location states, Hebrew and English. Kept apart from `locate.ts`, which has no UI. */
export type LocateLang = "he" | "en";

export const locateCopy = {
  en: {
    searching: "Finding you…",
    approx: "Approximate location",
    roughly: (city: string) => `Roughly in ${city}`,
    roughlyNoCity: "Roughly here",
    timeout: "Finding you took too long. Try again, or search for a place.",
    unavailable: "Your device couldn't find its location. Try again, or search for a place.",
    notSupported: "Your browser can't share a location.",
    deniedTitle: "Location is blocked",
    search: "Search a place",
    how: "How to allow it",
    howIos: "iPhone: Settings › Safari › Location",
    howAndroid: "Android: lock icon in the address bar › Permissions › Location",
    myLocation: "My location",
  },
  he: {
    searching: "מאתר…",
    approx: "מיקום משוער",
    roughly: (city: string) => `בערך ב${city}`,
    roughlyNoCity: "בערך כאן",
    timeout: "האיתור לקח יותר מדי זמן. נסו שוב, או חפשו מקום.",
    unavailable: "המכשיר לא הצליח לאתר מיקום. נסו שוב, או חפשו מקום.",
    notSupported: "הדפדפן לא יכול לשתף מיקום.",
    deniedTitle: "המיקום חסום",
    search: "חיפוש מקום",
    how: "איך מאפשרים",
    howIos: "iPhone: הגדרות › Safari › מיקום",
    howAndroid: "Android: סמל המנעול בשורת הכתובת › הרשאות › מיקום",
    myLocation: "המיקום שלי",
  },
} as const;

/** The page language the planner has set (it writes `<html lang>`); English until then. */
export function currentLocateLang(): LocateLang {
  return typeof document !== "undefined" && document.documentElement.lang === "he" ? "he" : "en";
}
