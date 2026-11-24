/**
 * The walker's dot: a small leather disc (13 px) with a thin cream ring and an ink hairline (the brand's "you / now"
 * mark, readable on satellite as well as on paper without hiding what is under it), and, once a heading is known, a
 * soft direction beam coming out of it, turning with the walker. Facing is a hint, never a promise: with no heading
 * there is no beam (see `HeadingSmoother` and `chooseHeading`).
 * `WalkerMarkerShape` is the React version for the Google map; `walkerMarkerHtml` is the same markup as a string for a
 * Leaflet divIcon. Keep the two in step (tests/walker-marker.test.tsx pins that they agree).
 */

/** Leather as a literal, for the accuracy halo (map libraries want colours, not CSS variables). */
export const WALKER_COLOR = "#d2602f";
/** The accuracy halo is quiet (it must not merge with the beam into one blob) and absent for a good fix. */
export const HALO_FILL_OPACITY = 0.07;
export const HALO_STROKE_OPACITY = 0.25;
export const HALO_MIN_ACCURACY_M = 10;
const LEATHER = `var(--tk-leather, ${WALKER_COLOR})`;
const RING = "#f8f3ea";
const INK = "#1b2620";
/** The box the marker sits in; the disc is centred in it and the beam reaches out of it toward the heading. */
export const WALKER_BOX_PX = 60;
const DISC_PX = 13;
// The cream ring and the ink hairline around the disc, px: the whole dot is 19 px across.
const RING_PX = 2;
const HAIRLINE_PX = 1;
// Ring, hairline, then a faint shadow that keeps the dot apart from a busy satellite picture.
const DOT_SHADOW = `0 0 0 ${RING_PX}px ${RING}, 0 0 0 ${RING_PX + HAIRLINE_PX}px ${INK}, 0 1px 4px 1px rgba(0,0,0,0.3)`;


/**
 * The direction beam, as in Moovit and Google Maps: a translucent wedge of leather coming out of the dot toward the
 * heading, `BEAM_RADIUS_PX` long and 60 degrees wide, solid-ish at the dot and fading to nothing outward. The sides
 * are blurred a little so there is no hard edge. It sits under the disc and exists only once a heading is known; it
 * is drawn pointing up and the heading rotates it. It is the walker's own marker only:
 * the route's direction arrows (RouteArrows) are a different thing and stay as they are.
 */
export const BEAM_RADIUS_PX = 40;
const BEAM_PX = 96;
const BEAM_HALF_ANGLE = (30 * Math.PI) / 180;
const BEAM_C = BEAM_PX / 2;
const BEAM_PATH = (() => {
  const dx = BEAM_RADIUS_PX * Math.sin(BEAM_HALF_ANGLE);
  const dy = BEAM_RADIUS_PX * Math.cos(BEAM_HALF_ANGLE);
  return `M${BEAM_C} ${BEAM_C} L${(BEAM_C - dx).toFixed(1)} ${(BEAM_C - dy).toFixed(1)} A${BEAM_RADIUS_PX} ${BEAM_RADIUS_PX} 0 0 1 ${(BEAM_C + dx).toFixed(1)} ${(BEAM_C - dy).toFixed(1)}Z`;
})();
const beamSvg = (id: string) =>
  `<svg width="${BEAM_PX}" height="${BEAM_PX}" viewBox="0 0 ${BEAM_PX} ${BEAM_PX}" aria-hidden="true" style="position:absolute;left:${-(BEAM_PX - WALKER_BOX_PX) / 2}px;top:${-(BEAM_PX - WALKER_BOX_PX) / 2}px;overflow:visible"><defs><radialGradient id="${id}-g" cx="${BEAM_C}" cy="${BEAM_C}" r="${BEAM_RADIUS_PX}" gradientUnits="userSpaceOnUse"><stop offset="0.15" stop-color="${WALKER_COLOR}" stop-opacity="0.75"/><stop offset="0.55" stop-color="${WALKER_COLOR}" stop-opacity="0.35"/><stop offset="1" stop-color="${WALKER_COLOR}" stop-opacity="0"/></radialGradient><filter id="${id}-b" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.2"/></filter></defs><path d="${BEAM_PATH}" fill="url(#${id}-g)" filter="url(#${id}-b)"/></svg>`;

/** A heading the marker can draw: a real number of degrees (unwrapped is fine); anything else means no beam. */
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
          data-testid="walker-beam"
          style={{ position: "absolute", inset: 0, transform: `rotate(${roundDeg(headingDeg)}deg)`, transition: "transform 400ms ease-out", pointerEvents: "none" }}
          dangerouslySetInnerHTML={{ __html: beamSvg("tk-beam") }}
        />
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
          boxShadow: DOT_SHADOW,
        }}
      />
    </span>
  );
}

/** The same marker as an HTML string, for a Leaflet divIcon. */
export function walkerMarkerHtml(headingDeg?: number | null): string {
  const has = validHeading(headingDeg);
  const beam = has
    ? `<span data-testid="walker-beam" style="position:absolute;inset:0;transform:rotate(${roundDeg(headingDeg)}deg);transition:transform 400ms ease-out;pointer-events:none;">${beamSvg("tk-beam-l")}</span>`
    : "";
  const offset = (WALKER_BOX_PX - DISC_PX) / 2;
  return (
    `<span data-testid="walker-marker"${has ? ` data-heading="${roundDeg(headingDeg)}"` : ""} role="img" aria-label="Your position" style="position:relative;display:block;width:${WALKER_BOX_PX}px;height:${WALKER_BOX_PX}px;">` +
    beam +
    `<span style="position:absolute;left:${offset}px;top:${offset}px;width:${DISC_PX}px;height:${DISC_PX}px;border-radius:9999px;background:${LEATHER};box-shadow:${DOT_SHADOW};"></span>` +
    `</span>`
  );
}
