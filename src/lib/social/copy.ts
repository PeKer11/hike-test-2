import type { SaveProfileCode } from "./profiles";

export type SocialLang = "en" | "he";

/** One line per RPC code of save_social_profile. Hebrew is plural and gender-neutral (house style). */
export const profileErrorCopy: Record<SocialLang, Record<Exclude<SaveProfileCode, "ok">, string>> = {
  en: {
    signin: "Log in first.",
    suspended: "This profile is paused for review.",
    adult_required: "Social features are for ages 18 and up. Tick the box to continue.",
    rate_limited: "One moment, then try again.",
    name_reserved: "That name is reserved. Pick another.",
    invalid: "Names are 2 to 30 characters, with no links, symbols or long numbers.",
    unavailable: "Profiles are not available yet.",
    error: "Couldn't save. Try again.",
  },
  he: {
    signin: "צריך להתחבר קודם.",
    suspended: "הפרופיל מושהה לבדיקה.",
    adult_required: "החברתי מיועד לגיל 18 ומעלה. סמנו את התיבה כדי להמשיך.",
    rate_limited: "רגע אחד, ואז אפשר שוב.",
    name_reserved: "השם הזה שמור. בחרו אחר.",
    invalid: "שם באורך 2 עד 30 תווים, בלי קישורים, סימנים או מספרים ארוכים.",
    unavailable: "פרופילים עדיין לא זמינים.",
    error: "השמירה לא הצליחה. אפשר לנסות שוב.",
  },
};
