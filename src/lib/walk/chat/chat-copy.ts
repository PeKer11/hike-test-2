import type { ChatLang } from "./reply";

/** Fixed texts for every outcome of a free-form question. The model never writes any of them. */
export const CHAT_COPY: Record<
  ChatLang,
  {
    thinking: string;
    signIn: string;
    capReached: string;
    budget: string;
    tooFast: string;
    network: string;
    aiDown: string;
    timeout: string;
    noWalk: string;
    ask: string;
    placeholder: string;
    send: string;
    newest: string;
    approve: string;
    no: string;
    approved: string;
    cancelled: string;
    replaced: string;
  }
> = {
  en: {
    thinking: "Thinking…",
    signIn: "Sign in for free-form questions.",
    capReached: "You've used this walk's 15 questions. Quick commands still work: cafe, skip, shorter.",
    budget: "The AI helper is resting for today. Quick commands still work: cafe, skip, shorter.",
    tooFast: "Too many questions too fast. Try again in a minute, or use a quick command: cafe, skip, shorter.",
    network: "I couldn't reach the helper. Quick commands still work: cafe, skip, shorter.",
    aiDown: "The assistant isn't available right now, try again.",
    timeout: "That took too long. Try again, or use a quick command: cafe, skip, shorter.",
    noWalk: "Start a walk first, then ask me here.",
    ask: "Ask",
    placeholder: "cafe, water, skip, shorter…",
    send: "Send",
    newest: "Newest messages",
    approve: "Approve",
    no: "No",
    approved: "✓ Approved",
    cancelled: "Cancelled",
    replaced: "Replaced by a new proposal",
  },
  he: {
    thinking: "חושב…",
    signIn: "התחברו כדי לשאול שאלות חופשיות.",
    capReached: "השתמשתם ב-15 השאלות של ההליכה הזו. פקודות מהירות עדיין עובדות: קפה, דלג, קצר יותר.",
    budget: "העוזר נח להיום. פקודות מהירות עדיין עובדות: קפה, דלג, קצר יותר.",
    tooFast: "יותר מדי שאלות בבת אחת. נסו שוב בעוד דקה, או השתמשו בפקודה מהירה: קפה, דלג, קצר יותר.",
    network: "לא הצלחתי להגיע לעוזר. פקודות מהירות עדיין עובדות: קפה, דלג, קצר יותר.",
    aiDown: "העוזר לא זמין כרגע, נסו שוב",
    timeout: "זה לקח יותר מדי זמן. נסו שוב, או השתמשו בפקודה מהירה: קפה, דלג, קצר יותר.",
    noWalk: "התחילו הליכה ואז שאלו אותי כאן.",
    ask: "שאלו",
    placeholder: "קפה, מים, דלג, קצר יותר…",
    send: "שלחו",
    newest: "להודעות החדשות",
    approve: "אשר",
    no: "לא",
    approved: "✓ אושר",
    cancelled: "בוטל",
    replaced: "הוחלף בהצעה חדשה",
  },
};

/** The fixed line for "nothing_found". The model only picks the reason; it writes none of this. */
export function noMatchText(lang: ChatLang, reason: "none_near" | "outside_radius" | "search_limit", radiusM?: number): string {
  if (reason === "search_limit") return lang === "he" ? "הגעתי למגבלת החיפושים להיום." : "I've hit today's search limit.";
  if (reason === "outside_radius" && radiusM) return lang === "he" ? `לא מצאתי מקום מתאים בטווח ${radiusM} מ׳.` : `I couldn't find a suitable place within ${radiusM} m.`;
  return lang === "he" ? "לא מצאתי מקום מתאים קרוב." : "I couldn't find a suitable place nearby.";
}
