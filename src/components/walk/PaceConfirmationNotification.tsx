import {
  replanPaceDirection,
  type ReplanReason,
} from "@/lib/walk/replan-trigger";

/**
 * How long the question stands before it answers itself. Long enough that a
 * walker with the phone in a pocket has a real chance to see it, short enough
 * that it is not still on screen when the situation it describes has passed.
 */
export const PACE_CONFIRMATION_TIMEOUT_MS = 90_000;

interface PaceConfirmationNotificationProps {
  /** The trigger being asked about, or null when there is nothing to ask. */
  reason: ReplanReason | null;
  onConfirm: () => void;
  onDismiss: () => void;
}

/**
 * The mid-walk "should I rebuild?" question, for a walker whose settings say
 * `ask` rather than `auto` for the direction that fired.
 *
 * A banner rather than a dialog, matching `OffRouteNotification`: this fires
 * while someone is walking down a street, and a modal that blocks the map
 * until it is answered is the wrong shape for that. Ignoring it is a valid
 * answer, and the caller times it out.
 *
 * The slow-pace wording asks about *intent*, not about the route. "Do you plan
 * to speed up?" is a question the walker can actually answer; "shall I shorten
 * your route?" asks them to predict the consequences of a pace they have not
 * decided on yet. A walker who says they will speed up keeps the route they
 * chose, which is the whole point — the old behaviour assumed a slow ten
 * minutes meant a slow rest-of-walk and quietly dropped stops on that guess.
 */
export function PaceConfirmationNotification({
  reason,
  onConfirm,
  onDismiss,
}: PaceConfirmationNotificationProps) {
  if (reason === null) {
    return null;
  }

  const isSlow = replanPaceDirection(reason) === "slow";

  const question = isSlow
    ? reason === "full-stop"
      ? "You've been still for a while. Planning to keep going at this rate?"
      : "You're walking slower than planned. Do you plan to speed back up?"
    : "You're ahead of plan. Want to add another stop?";
  const confirmLabel = isSlow ? "Adjust my route" : "Add a stop";
  const dismissLabel = isSlow ? "I'll speed up" : "No, keep it as is";

  return (
    // Absolute like the off-route banner: it belongs to the planner frame,
    // which is only viewport-sized while expanded. Sits below that banner's
    // row rather than on it — a walker can be off route and behind schedule at
    // the same time, and two overlapping banners answer neither question.
    <div className="absolute top-16 left-1/2 z-[500] w-[min(22rem,90%)] -translate-x-1/2 space-y-2 rounded-xl bg-forest px-4 py-3 text-sm text-white shadow-lg">
      <p>{question}</p>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          className="flex-1 rounded-md bg-terra px-3 py-2 text-xs font-semibold text-white transition hover:bg-terra/90"
        >
          {confirmLabel}
        </button>
        <button
          onClick={onDismiss}
          className="flex-1 rounded-md border border-cream/30 px-3 py-2 text-xs font-semibold text-cream/90 transition hover:bg-white/10"
        >
          {dismissLabel}
        </button>
      </div>
    </div>
  );
}
