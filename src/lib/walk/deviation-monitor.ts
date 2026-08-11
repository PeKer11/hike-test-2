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
 * How long after a deviation decision before another one may fire.
 *
 * The once-per-excursion latch below stops a *single* excursion looping the
 * rebuild, but rejoining the route clears it — so a walker bouncing across the
 * 50 m threshold (erratic movement, a GPS fix flapping in an urban canyon, or
 * someone hammering the client on purpose) can start a fresh excursion every
 * time and fire a real rebuild every ~30 seconds. Each of those is an Overpass
 * + ORS + Gemini round trip, so the loop costs real money and latency. This is
 * the deviation counterpart of `REPLAN_COOLDOWN_MS`.
 *
 * Not the pace cooldown's 12 minutes. That number is sized to let a 15-minute
 * rolling window refill with samples from the new route, and there is no such
 * window here — a deviation verdict arrives complete on every fix, so the only
 * thing to wait for is the walker's own reaction to the route they just got.
 * Three minutes is sized against that instead: it cuts the worst-case rebuild
 * rate by six (one per three minutes instead of one per thirty seconds), which
 * is enough to make the loop pointless as an abuse vector, while still being
 * about the time it takes to walk a block, notice the new route is wrong for
 * you, and genuinely need another. A walker who takes a real second wrong turn
 * five minutes later is not affected at all.
 */
export const DEVIATION_REBUILD_COOLDOWN_MS = 3 * 60_000;

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
  private cooldownUntil = 0;

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

    // Checked after the mode gate, unlike `PaceChecker`, which gates the mode
    // after `ReplanTrigger.evaluate()` has already armed its cooldown. The two
    // differ because the pace side has a window to clear and this side does
    // not: there, evaluating is what keeps a stale 15 minutes from being
    // carried into the moment the setting comes back on, so it has to happen
    // regardless of the mode. Here `off` decides nothing and calls nothing, so
    // charging it a cooldown would only punish a walker for having the feature
    // switched off — the same reasoning that already leaves the latch alone.
    //
    // Deliberately *not* conditioned on what the walker does next. An `ask`
    // that is dismissed made no API call, so on cost grounds alone it need not
    // arm anything; the cooldown arms anyway, for two reasons. The banner is
    // itself an interruption worth rate-limiting — a walker who has just said
    // "I know where I'm going" is the last person who wants asking again two
    // minutes later. And dismissal is invisible from here: the callback is
    // fire-and-forget, so conditioning on the answer would mean a new callback
    // into the monitor and a walker who simply ignores the banner would leave
    // the cooldown un-armed forever — exactly the loop this is here to close.
    // `ask`-then-confirm and `ask`-then-dismiss therefore behave identically,
    // as does `auto`.
    if (timestamp < this.cooldownUntil) return;

    // Latched only when it actually fires. A window that completed during the
    // cooldown is not spent: if the walker is still off route when the cooldown
    // lapses, the next fix answers them rather than leaving them stranded on a
    // stale route for the rest of the excursion.
    this.firedForThisExcursion = true;
    this.cooldownUntil = timestamp + DEVIATION_REBUILD_COOLDOWN_MS;
    this.onDeviationSustained(this.settings.deviationMode);
  }

  updateSettings(settings: WalkSettings): void {
    // The cooldown survives, exactly as it does across a `PaceChecker`
    // settings change: changing a setting is not a reason to re-arm a trigger.
    // Otherwise toggling `deviationMode` would be the cheapest way there is to
    // clear the cooldown, which would leave it worth nothing.
    this.settings = settings;
  }

  /** Clears the window and the cooldown — call when a new walk starts. */
  reset(): void {
    this.offRouteSince = null;
    this.offRouteSamples = 0;
    this.firedForThisExcursion = false;
    this.cooldownUntil = 0;
  }
}
