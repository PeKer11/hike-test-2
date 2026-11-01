/** Safety rules a walker cannot be talked out of by a place name (see src/lib/assistant/safety-diff.ts). */
const SAFETY_RULES = new Set(["access", "avoid_dangerous", "max_grade", "stay_in_area"]);

/** True when a set_walk_params call (raw JSON arguments) clears or loosens a safety rule. */
export function isRelaxingWalkParams(rawArgs: string): boolean {
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(rawArgs) as Record<string, unknown>;
  } catch {
    return false;
  }
  if (Array.isArray(args.clear) && args.clear.some((rule) => typeof rule === "string" && SAFETY_RULES.has(rule))) return true;
  if (args.access === "none") return true;
  if (args.avoid_dangerous === false) return true;
  return false;
}
