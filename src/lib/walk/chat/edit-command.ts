import { ADD_WORDS_HE, hasAny, normalize, SKIP_WORDS } from "@/lib/walk/chat/intent";
// Whole words only: "address" is not "add".
const ADD_WORDS_EN = /(^|[^a-z])(add|include|put)([^a-z]|$)/;

/**
 * Is the walker's sentence an explicit command to change the walk? "add" and "drop" make the app carry out the
 * model's matching proposals at once (with Undo); a question or a mix of both stays a proposal to tap.
 */
export function editCommand(text: string): "add" | "drop" | null {
  const t = normalize(text);
  const add = hasAny(t, ADD_WORDS_HE) || ADD_WORDS_EN.test(t);
  const drop = hasAny(t, SKIP_WORDS);
  if (add === drop) return null;
  return add ? "add" : "drop";
}
