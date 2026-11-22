/**
 * The walker's dot: a leather disc with a cream ring and an ink hairline (the brand's "you / now" mark, readable on
 * satellite as well as on paper), and, once a heading is known, a small arrowhead on its leading edge that turns with
 * the walker. Facing is a hint, never a promise: with no heading there is no arrowhead (see `HeadingSmoother`).
 * `WalkerMarkerShape` is the React version for the Google map; `walkerMarkerHtml` is the same markup as a string for a
 * Leaflet divIcon. Keep the two in step (tests/walker-marker.test.tsx pins that they agree).
 */

/** Leather as a literal, for the accuracy halo (map libraries want colours, not CSS variables). */
export const WALKER_COLOR = "#d2602f";
const LEATHER = `var(--tk-leather, ${WALKER_COLOR})`;
const RING = "#f8f3ea";
const INK = "#1b2620";
/** The box the marker sits in; the disc is centred and the arrowhead reaches out of it on the leading edge. */
export const WALKER_BOX_PX = 60;
const DISC_PX = 26;
// A chevron whose tip is 29 px from the centre: the disc and its rings reach out 17 px, so about 12 px of it shows beyond them.
const ARROW_PATH = "M30 1 40 17 30 12.5 20 17Z";

/** A heading the marker can draw: a real number of degrees (unwrapped is fine); anything else means no arrowhead. */
export function validHeading(headingDeg: number | null | undefined): headingDeg is number {
  return typeof headingDeg === "number" && Number.isFinite(headingDeg);
}

const roundDeg = (deg: number) => Math.round(deg * 10) / 10;

export function WalkerMarkerShape({ headingDeg }: { headingDeg?: number | null }) {
  const has = validHeading(headingDeg);
  return (
    <span
      data-testid="walker-marker"
      data-heading={has ? roundDeg(headingDeg) : undefined}
      role="img"
      aria-label="Your position"
      style={{ position: "relative", display: "block", width: WALKER_BOX_PX, height: WALKER_BOX_PX }}
    >
      {has ? (
        <span
          data-testid="walker-arrow"
          style={{ position: "absolute", inset: 0, transform: `rotate(${roundDeg(headingDeg)}deg)`, transition: "transform 400ms ease-out" }}
        >
          <svg width={WALKER_BOX_PX} height={WALKER_BOX_PX} viewBox="0 0 60 60" aria-hidden>
            <path d={ARROW_PATH} fill={LEATHER} stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        </span>
      ) : null}
      <span
        style={{
          position: "absolute",
          left: (WALKER_BOX_PX - DISC_PX) / 2,
          top: (WALKER_BOX_PX - DISC_PX) / 2,
          width: DISC_PX,
          height: DISC_PX,
          borderRadius: 9999,
          background: LEATHER,
          boxShadow: `0 0 0 2.5px ${RING}, 0 0 0 4px ${INK}`,
        }}
      />
    </span>
  );
}

/** The same marker as an HTML string, for a Leaflet divIcon. */
export function walkerMarkerHtml(headingDeg?: number | null): string {
  const has = validHeading(headingDeg);
  const arrow = has
    ? `<span data-testid="walker-arrow" style="position:absolute;inset:0;transform:rotate(${roundDeg(headingDeg)}deg);transition:transform 400ms ease-out;"><svg width="${WALKER_BOX_PX}" height="${WALKER_BOX_PX}" viewBox="0 0 60 60" aria-hidden="true"><path d="${ARROW_PATH}" fill="${LEATHER}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/></svg></span>`
    : "";
  const offset = (WALKER_BOX_PX - DISC_PX) / 2;
  return (
    `<span data-testid="walker-marker"${has ? ` data-heading="${roundDeg(headingDeg)}"` : ""} role="img" aria-label="Your position" style="position:relative;display:block;width:${WALKER_BOX_PX}px;height:${WALKER_BOX_PX}px;">` +
    arrow +
    `<span style="position:absolute;left:${offset}px;top:${offset}px;width:${DISC_PX}px;height:${DISC_PX}px;border-radius:9999px;background:${LEATHER};box-shadow:0 0 0 2.5px ${RING},0 0 0 4px ${INK};"></span>` +
    `</span>`
  );
}
