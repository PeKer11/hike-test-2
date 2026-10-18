import { arbitrate } from "@/lib/walk/companion/companion-arbiter";

import type { AskPolicy } from "./ports";

/**
 * Kept apart from `adapters.ts` on purpose: the engine runs in the browser and
 * `adapters.ts` pulls in the server-side preference store.
 */
export const arbiterPolicy: AskPolicy = { choose: arbitrate };
