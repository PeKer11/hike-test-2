/**
 * A typed "yes" to a proposal the chat just made. Exact match only: anything
 * longer than these short phrases is a real sentence and goes to the assistant.
 */
const AFFIRM = new Set([
  // he
  "כן", "כן בבקשה", "כן תודה", "בטח", "סבבה", "יאללה", "אוקיי", "אוקי", "בסדר", "מתאים", "מתאים לי",
  "נשמע טוב", "קדימה", "בכיף", "תוסיף", "תוסיף אותו", "תוסיף אותה", "להוסיף",
  // en
  "yes", "yes please", "yeah", "yep", "sure", "ok", "okay", "add it", "do it", "sounds good", "go ahead",
  "please do", "perfect",
]);

/** Trim, strip punctuation and emoji, collapse spaces, lowercase. */
export function normalizeAffirm(text: string): string {
  return text
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function isAffirm(text: string): boolean {
  return AFFIRM.has(normalizeAffirm(text));
}
