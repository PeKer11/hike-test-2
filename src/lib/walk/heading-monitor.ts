import type { Coordinates } from "@/lib/types";
import {
  angleDifference,
  bearingBetween,
  haversineDistance,
} from "@/lib/utils/geo";

/**
 * How long a walker has to hold a direction before it counts as a direction
 * they chose rather than one they happen to be pointing in.
 *
 * The same *kind* of window as `DEVIATION_SUSTAIN_MS` — a few tens of seconds
 * of continuous walking, off the same ~1 Hz position stream, sized against what
 * a pedestrian actually covers — but deliberately 45 seconds where that one is
 * 30, and the extra 15 seconds are not caution, they are resolution. A
 * deviation verdict arrives complete on every fix, so 30 seconds only has to
 * outlast a bad fix or two. A *direction* has to be measured, and measuring it
 * costs ground: the bearing between two nearby points is mostly noise (see
 * `MIN_HEADING_CHORD_METERS`), so the window has to be long enough to hold two
 * readings taken over a usable baseline. At an unhurried 1.0 m/s of net
 * progress, 45 seconds is 45 m, which is exactly two 20 m chords with room to
 * spare; 30 seconds is 30 m, which is one — and one reading cannot tell you a
 * direction was *held*.
 *
 * The ceiling is the banner it answers: 45 seconds sits comfortably inside the
 * 90 the `ask` question stands, so the verdict is still about the walker's last
 * stretch and not about the whole excursion.
 *
 * It doubles as the staleness bound in `sustainedHeading`: evidence older than
 * the window it was gathered over is not evidence about now.
 */
export const HEADING_SUSTAIN_MS = 45_000;

/**
 * The shortest displacement a single direction reading is allowed to be
 * measured over.
 *
 * The raw per-fix bearing this codebase already carries on `PaceUpdate` is far
 * too noisy for this: at roughly one fix a second a walker moves about 1.4 m
 * between fixes, while a phone's horizontal error in a street is several metres
 * — so the bearing between two consecutive fixes is mostly noise. Bearing error
 * falls off as the baseline grows: over 20 m with ~5 m of positional error at
 * each end it is about atan(5/20) ≈ 14°, which is small enough to test against.
 * So the window is cut into chords of at least this much *straight-line*
 * displacement (not path length — a walker weaving on the spot must not be
 * handed short, noisy chords), and each chord gets one bearing.
 *
 * The ceiling on it is what a real walker can deliver inside the window, and
 * that is what fixes `HEADING_SUSTAIN_MS` at 45 seconds rather than 30: two
 * 20 m chords need 40 m of *net* displacement, and a walker weaving down a
 * pavement nets well under the distance their legs cover. Shrinking the chord
 * instead was the first thing tried and it is the wrong lever — a 15 m chord
 * carries ~18° of bearing error against a ~14° one, and the whole point of the
 * chord is to be long enough to trust.
 */
export const MIN_HEADING_CHORD_METERS = 20;

/**
 * One chord tells you a direction. Two tell you it is the *same* direction —
 * the same argument `MIN_SUSTAINED_SAMPLES` makes about bracketing a window,
 * applied to displacement rather than to time.
 *
 * Two and not three, because three would mean 60 m of net displacement inside
 * the window and put the floor above an ordinary walking pace. Two readings are
 * enough here because they are compared with each other, not with an average
 * they both helped produce — see `HEADING_TOLERANCE_DEG`.
 */
export const MIN_HEADING_CHORDS = 2;

/**
 * How far apart the window's direction readings may be and still count as one
 * direction.
 *
 * A *spread* between chords, not a deviation from their average, and the
 * difference is the whole reason this rejects corners. Measured against the
 * average, a walker who turns 80° mid-window gets an overall heading halfway
 * between the two streets, each chord sits ~40° off it — and worse, the chord
 * that straddles the turn reports the blend and lands almost on the average, so
 * a corner can hide inside a statistic it helped compute. That version of this
 * rule was written first and waved an 80° turn through as "consistent".
 * Comparing the readings with *each other* removes the hiding place: two
 * directions 80° apart are 80° apart whatever their mean.
 *
 * Bounded from below by noise: two 20 m chords carrying ~14° of bearing error
 * each can differ by nearly 30° with the walker going in a dead straight line,
 * so anything under ~30° would fail honest walks. Bounded from above by the
 * turns it has to catch — a street corner is 90°, and something well under that
 * has to be the cut. 35° is the room between them, which also means a curve
 * sharper than about 35° across the window reads as a change of direction
 * rather than a direction. That is the right way for it to fail: a walker
 * rounding a bend gets no answer, and no answer means today's behaviour.
 *
 * The asymmetry is deliberate throughout. Failing this test costs nothing — the
 * walker keeps the route they have. Passing it wrongly rebuilds someone's walk
 * around a direction they did not choose.
 */
export const HEADING_TOLERANCE_DEG = 35;

interface HeadingSample {
  coordinates: Coordinates;
  timestamp: number;
}

/**
 * Answers one question: over the last half minute, has the walker been going
 * somewhere, and where?
 *
 * A sibling of `DeviationMonitor` in shape — fed from the same throttled
 * position handler, driven off sample timestamps rather than the wall clock so
 * the simulator's fast-forwarded stream reads the same as real GPS — but it
 * decides nothing and calls nobody. It is a signal the *caller* asks for at the
 * one moment it matters: when the off-route banner lapses unanswered and the
 * choice is between leaving a stale route alone and continuing the way the
 * walker is actually walking.
 */
export class HeadingMonitor {
  private samples: HeadingSample[] = [];

  /**
   * Feed every accepted fix here. Timestamps come from the fix, never from
   * `Date.now()` — see `DeviationMonitor.record` for what mixing the two broke
   * last time.
   */
  record(coordinates: Coordinates, timestamp: number): void {
    this.samples.push({ coordinates, timestamp });

    // Keep exactly one sample older than the window, so the buffer always
    // *spans* the full window rather than falling just short of it. Trimming to
    // the cutoff itself would leave the oldest sample a fix inside the window
    // and the span permanently under 30 seconds.
    const cutoff = timestamp - HEADING_SUSTAIN_MS;
    while (this.samples.length >= 2 && this.samples[1].timestamp <= cutoff) {
      this.samples.shift();
    }
  }

  /**
   * The direction the walker has held for the whole window, or null if they
   * have not held one.
   *
   * Null covers every way of not having an answer, and the caller treats them
   * all the same because they all mean the same thing — no evidence that this
   * walker meant to go anywhere in particular: too little time recorded, too
   * little ground covered, a turn part-way through, a walker who has stopped,
   * or a stream that has gone quiet.
   *
   * `now` is the timestamp of the latest fix, not the wall clock.
   */
  sustainedHeading(now: number): number | null {
    if (this.samples.length < 2) return null;

    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];

    // A stream that stopped feeding this half a minute ago is describing where
    // the walker *was*, and the banner it would answer is about where they are.
    if (now - last.timestamp > HEADING_SUSTAIN_MS) return null;
    if (last.timestamp - first.timestamp < HEADING_SUSTAIN_MS) return null;

    const chords = this.chordBearings();
    if (chords.length < MIN_HEADING_CHORDS) return null;

    // Every reading against every other, rather than each against their mean —
    // see `HEADING_TOLERANCE_DEG` for the corner that hides from the mean.
    // There are two or three chords in a window, so the pairs are counted
    // rather than being clever about it.
    for (let i = 0; i < chords.length; i += 1) {
      for (let j = i + 1; j < chords.length; j += 1) {
        if (
          angleDifference(chords[i].bearing, chords[j].bearing) >
          HEADING_TOLERANCE_DEG
        ) {
          return null;
        }
      }
    }

    // The direction reported is measured end to end across the chords rather
    // than averaged over their bearings: the longest available baseline is the
    // least noisy estimate of where the walker has actually got to, and
    // averaging bearings would need circular arithmetic to survive the 0°/360°
    // seam for no gain. It is only reached once the readings agree, so it
    // cannot be the mean of a corner.
    return bearingBetween(chords[0].from, chords[chords.length - 1].to);
  }

  /** Clears the window — call when a new walk starts, or tracking stops. */
  reset(): void {
    this.samples = [];
  }

  /**
   * Cut the window into consecutive legs of at least
   * `MIN_HEADING_CHORD_METERS` of straight-line displacement, each with its own
   * bearing. A tail that never reaches the threshold is discarded rather than
   * measured short.
   */
  private chordBearings(): Array<{
    from: Coordinates;
    to: Coordinates;
    bearing: number;
  }> {
    const chords: Array<{
      from: Coordinates;
      to: Coordinates;
      bearing: number;
    }> = [];

    let from = this.samples[0].coordinates;
    for (let i = 1; i < this.samples.length; i += 1) {
      const to = this.samples[i].coordinates;
      if (haversineDistance(from, to) < MIN_HEADING_CHORD_METERS) continue;

      chords.push({ from, to, bearing: bearingBetween(from, to) });
      from = to;
    }

    return chords;
  }
}
