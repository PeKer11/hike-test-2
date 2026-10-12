import type { Coordinates } from "@/lib/types";

import type { Candidate } from "../companion-types";
import { sunsetMs } from "../sun";

export interface SunsetProducerInput {
  nowMs: number;
  position: Coordinates;
  remainingWalkMin: number;
  /** Stop to drop when the walker accepts shortening, if one is droppable. */
  dropStopId?: string;
  /** Stops still ahead. A lone stop is never offered for dropping. */
  remainingStopCount?: number;
  ttlMs?: number;
}

export const SUNSET_QUESTION_TTL_MS = 90_000;

/** value = clamp((remaining - minutesToSunset + 10) / 30). Null once the sun is down. */
export function sunsetCandidate(input: SunsetProducerInput): Candidate | null {
  const sunset = sunsetMs(input.nowMs, input.position.lat, input.position.lng);
  if (sunset === null) return null;
  const minutesToSunset = (sunset - input.nowMs) / 60_000;
  if (minutesToSunset <= 0) return null;
  const value = Math.max(
    0,
    Math.min(1, (input.remainingWalkMin - minutesToSunset + 10) / 30),
  );
  if (value <= 0) return null;
  // Safety: the walk would end after dark.
  const droppable =
    input.dropStopId !== undefined &&
    (input.remainingStopCount === undefined || input.remainingStopCount > 1);
  const capMin = Math.max(1, Math.floor(minutesToSunset));
  const endsAfterDark = input.remainingWalkMin > minutesToSunset;
  return {
    kind: "sunset",
    urgency: endsAfterDark ? 3 : 2,
    value,
    answers: [
      {
        id: "shorten",
        label: "answer.shorten",
        operator: {
          op: "shorten",
          dropStopIds: droppable ? [input.dropStopId!] : undefined,
          // Always cap: dropping a stop must not lose the end-by-sunset limit.
          capMin,
        },
      },
      { id: "continue", label: "answer.continue", operator: { op: "dismiss" } },
    ],
    expiresAtMs: input.nowMs + (input.ttlMs ?? SUNSET_QUESTION_TTL_MS),
    context: {
      m: Math.round(minutesToSunset),
      r: Math.round(input.remainingWalkMin),
    },
  };
}
