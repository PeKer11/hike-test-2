/**
 * How long the question stands before it lapses. The same 90 seconds as the
 * pace question, for the same reason — long enough for a phone in a pocket,
 * short enough not to outlive the situation.
 */
export const DEVIATION_CONFIRMATION_TIMEOUT_MS = 90_000;

interface DeviationConfirmationNotificationProps {
  visible: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}

/**
 * The mid-walk "you're off the route — shall I redraw it from here?" question,
 * for a walker whose `deviationMode` is `ask`.
 *
 * A sibling of `PaceConfirmationNotification` rather than another `reason`
 * inside it: that component's whole body is pace-direction logic (slow vs fast
 * wording, "do you plan to speed up") and threading an unrelated situation
 * through it would mean a component whose props no longer describe one
 * question. The parts worth sharing — banner not dialog, ignoring it is a
 * valid answer, the caller owns the timeout — are conventions, and they are
 * followed here rather than abstracted.
 *
 * Silence means the route stands. That is the opposite of the slow-pace
 * question, which falls back to rebuilding, and the asymmetry follows the
 * cost: falling behind quietly eats the time the walker said they had, while
 * being off route may simply mean they stepped into a shop and are coming back
 * out. Rebuilding someone's walk because they didn't look at their phone is
 * the wrong way round.
 */
export function DeviationConfirmationNotification({
  visible,
  onConfirm,
  onDismiss,
}: DeviationConfirmationNotificationProps) {
  if (!visible) {
    return null;
  }

  return (
    // Third fixed slot down the top of the planner frame: the off-route badge
    // sits at top-4, the pace question at top-16, this at top-36. A walker can
    // be off route and behind schedule at once, so all three can be on screen
    // together, and the slots are fixed rather than packed so a banner does
    // not move under a thumb that is already reaching for it.
    <div className="absolute top-36 left-1/2 z-[500] w-[min(22rem,90%)] -translate-x-1/2 space-y-2 rounded-xl bg-forest px-4 py-3 text-sm text-white shadow-lg">
      <p>You&apos;ve gone off the planned route. Redraw it from where you are?</p>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          className="flex-1 rounded-md bg-terra px-3 py-2 text-xs font-semibold text-white transition hover:bg-terra/90"
        >
          Redraw from here
        </button>
        <button
          onClick={onDismiss}
          className="flex-1 rounded-md border border-cream/30 px-3 py-2 text-xs font-semibold text-cream/90 transition hover:bg-white/10"
        >
          I know where I&apos;m going
        </button>
      </div>
    </div>
  );
}
