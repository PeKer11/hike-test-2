import type { WalkSettings } from "@/lib/types/walk-settings";
import type { ReplanResponse } from "@/lib/walk/pace-checker";

/**
 * How long the walker has to stay off the planned route before the question is
 * worth raising.
 *
 * Deliberately nothing like `ReplanTrigger`'s 15-minute rolling window. That
 * number exists because a per-tick *pace* is mostly noise — you cannot tell a
 * slow walker from a red light without averaging over a long stretch. A
 * per-tick *deviation* is not noisy in the same way: `detectDeviation` anchors
 * its search to the previous segment, so what it reports is a real distance
 * from a real part of the route, and the only false positives left are single
 * bad fixes.
 *
 * 30 seconds is sized against those two failure modes. A GPS glitch — an urban
 * canyon reflection, a fix taken before the receiver has settled — lasts a fix
 * or two, not thirty of them, so it never fills the window. Meanwhile a walker
 * who really has taken a wrong turn covers only about 40 m in 30 s at an
 * ordinary pace, so nothing is lost by waiting: they are barely further astray
 * than when the badge first appeared, and they have had a chance to turn round
 * on their own before the app says anything.
 */
export const DEVIATION_SUSTAIN_MS = 30_000;

/**
 * A window can't be "sustained" on the strength of one sample, however old its
 * timestamp claims to be. Two fixes bracketing the window is the minimum that
 * shows the walker was off route *throughout* it rather than at its edges.
 */
const MIN_SUSTAINED_SAMPLES = 3;

/**
 * Decides when going off route is worth acting on, from the per-tick
 * `detectDeviation` verdict.
 *
 * Structurally the deviation counterpart of `PaceChecker`: it owns the mode
 * gate and hands the caller an `auto`/`ask` answer, never an `off` one. It
 * differs in having no timer of its own — the pace triggers need a clock
 * because "has 15 minutes of slowness accumulated" is a question nobody's GPS
 * fix asks, whereas every fix already carries an off-route verdict. Driving
 * this from the sample stream instead keeps it deterministic and means the
 * decision is never staler than the last fix.
 */
export class DeviationMonitor {
  private settings: WalkSettings;
  private readonly onDeviationSustained: (response: ReplanResponse) => void;
  private offRouteSince: number | null = null;
  private offRouteSamples = 0;
  /**
   * One question per excursion. Without this a walker who says "no, I know
   * where I'm going" would be asked again on the very next fix, since they are
   * still off route — and a walker in `auto` would rebuild in a loop. Cleared
   * when they rejoin the route, which is also what a successful rebuild looks
   * like from here: new geometry, deviation back to nothing.
   */
  private firedForThisExcursion = false;

  constructor(
    settings: WalkSettings,
    onDeviationSustained: (response: ReplanResponse) => void,
  ) {
    this.settings = settings;
    this.onDeviationSustained = onDeviationSustained;
  }

  /**
   * Feed every deviation verdict here, with the timestamp of the fix it came
   * from — not `Date.now()`. The simulator's timestamps run ahead of the wall
   * clock, and mixing the two is what broke the pace windows (see
   * `PaceChecker.evaluationTime`).
   */
  record(needsReroute: boolean, timestamp: number): void {
    if (!needsReroute) {
      // Back on the route: whatever was building up is cancelled outright, and
      // the next excursion starts from zero. A walker who clips 50 m at a
      // corner and comes straight back has not been off route "for 30 seconds"
      // in any sense the walker would recognise.
      this.offRouteSince = null;
      this.offRouteSamples = 0;
      this.firedForThisExcursion = false;
      return;
    }

    if (this.offRouteSince === null) {
      this.offRouteSince = timestamp;
    }
    this.offRouteSamples += 1;

    if (this.firedForThisExcursion) return;
    if (this.offRouteSamples < MIN_SUSTAINED_SAMPLES) return;
    if (timestamp - this.offRouteSince < DEVIATION_SUSTAIN_MS) return;

    // Gated here rather than at the top of the method, in the same spirit as
    // `PaceChecker`: the window keeps filling while the mode is `off`, so a
    // walker who switches it on part-way through an excursion is answered from
    // how long they have *actually* been off route, not from a fresh 30 seconds
    // starting the moment they touched the setting. `off` also deliberately
    // leaves the once-per-excursion latch alone — nothing was decided, so
    // there is nothing to have used up.
    if (this.settings.deviationMode === "off") return;

    this.firedForThisExcursion = true;
    this.onDeviationSustained(this.settings.deviationMode);
  }

  updateSettings(settings: WalkSettings): void {
    this.settings = settings;
  }

  /** Clears the window — call when a new walk starts. */
  reset(): void {
    this.offRouteSince = null;
    this.offRouteSamples = 0;
    this.firedForThisExcursion = false;
  }
}
