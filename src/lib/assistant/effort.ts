import type { AssistantState } from "./state";

const PLAN_WORDS = /route|loop|itinerary|plan|stops?|מסלול|תכנן|תתכנן|עצירות|סיבוב|טיול/i;
const CONSTRAINT_WORDS = /wheelchair|stroller|kids?|avoid|without|except|no stairs|shade|אבל|חוץ מ|בלי|עגלה|כיסא גלגלים|ילדים|צל/gi;

/**
 * Claude turns run at `medium`; this says when a message is worth `high`: it asks for a route or plan and is long,
 * stacks several constraints, or is too vague to act on (so the model has to work out what the walker means).
 * Only the explicit env override for the tier beats it, so ops can still pin an effort.
 */
export function needsDeepThinking(message: string, state: Pick<AssistantState, "origin">): boolean {
  const text = message.trim();
  const words = text.split(/\s+/).filter(Boolean).length;
  const constraints = text.match(CONSTRAINT_WORDS)?.length ?? 0;
  if (PLAN_WORDS.test(text) && (words >= 25 || constraints >= 2)) return true;
  if (constraints >= 3) return true;
  // Vague: a request to plan with almost nothing to go on.
  return PLAN_WORDS.test(text) && words <= 4 && !state.origin;
}
