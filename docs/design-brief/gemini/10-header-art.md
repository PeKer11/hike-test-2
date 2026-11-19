```html
<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Traike — Round 10 Gouache &amp; Screen-Print Header Gallery</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700&family=Frank+Ruhl+Libre:wght@600;700&display=swap" rel="stylesheet">
<style>
  :root {
    --page-bg: #E7DFD1;
    --page-ink: #1B2620;
    --page-muted: #5E584D;
    --page-line: #CBBFAD;
    --leather: #D2602F;
    --rust: #8A3311;
    --amber: #D8903E;
    --cream: #F8F3EA;
    --pine: #1B2620;
    --night-surface: #1A1613;
    --night-umbr: #26180F;
    --on-art-day: #FFF5E8;
    --on-art-night: #FFF1DE;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: var(--page-bg);
    color: var(--page-ink);
    font-family: 'Assistant', sans-serif;
    font-size: 16px;
    line-height: 1.45;
    padding: 28px 24px 64px;
  }

  .wrap {
    max-width: 1240px;
    margin: 0 auto;
  }

  /* Gallery Header & Controls */
  .gallery-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding-bottom: 20px;
    margin-bottom: 28px;
    border-bottom: 1.5px solid var(--pine);
  }

  .gallery-title h1 {
    font-family: 'Frank Ruhl Libre', serif;
    font-weight: 700;
    font-size: 28px;
    letter-spacing: -0.02em;
    color: var(--pine);
  }

  .gallery-title p {
    font-size: 15px;
    color: var(--page-muted);
    margin-top: 2px;
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .seg {
    display: inline-flex;
    background: var(--cream);
    border: 1.5px solid var(--pine);
    border-radius: 6px;
    overflow: hidden;
    box-shadow: 0 2px 0 var(--pine);
  }

  .seg button {
    appearance: none;
    border: 0;
    background: transparent;
    color: var(--pine);
    font-family: 'Assistant', sans-serif;
    font-weight: 700;
    font-size: 14px;
    padding: 8px 14px;
    cursor: pointer;
    border-inline-end: 1px solid var(--page-line);
  }

  .seg button:last-child { border-inline-end: 0; }

  .seg button.active {
    background: var(--pine);
    color: var(--cream);
  }

  /* Scene Section */
  .scene-section {
    margin-bottom: 52px;
  }

  .scene-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
  }

  .scene-meta h2 {
    font-family: 'Frank Ruhl Libre', serif;
    font-weight: 700;
    font-size: 22px;
    color: var(--pine);
  }

  .palette-strip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 600;
    color: var(--page-muted);
  }

  .swatch {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    border: 1.5px solid var(--pine);
    display: inline-block;
  }

  /* Phone Pair Grid */
  .phone-pair {
    display: flex;
    flex-wrap: wrap;
    gap: 24px;
    margin-bottom: 20px;
  }

  .frame-col {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .frame-caption {
    font-size: 14px;
    font-weight: 600;
    color: var(--page-muted);
  }

  /* Desktop Stack */
  .desktop-stack {
    display: flex;
    flex-direction: column;
    gap: 18px;
    overflow-x: auto;
    padding-bottom: 4px;
  }

  /* Header Card Shell (300px header + 34px sheet seam proof) */
  .header-proof {
    border: 1.5px solid var(--pine);
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 3px 0 rgba(27, 38, 32, 0.16);
    flex-shrink: 0;
  }

  .header-proof.phone { width: 390px; }
  .header-proof.desktop { width: 1180px; }

  .header-band {
    position: relative;
    width: 100%;
    height: 300px;
    overflow: hidden;
  }

  /* Sky Gradients ( ONLY allowed smooth gradient ) */
  .theme-day .header-band {
    background: linear-gradient(
      180deg,
      #8A3311 0%,
      #9E3E14 26%,
      #BA561E 50%,
      #D88941 72%,
      #EBC292 87%,
      #F8F3EA 100%
    );
  }

  .theme-night .header-band {
    background: linear-gradient(
      180deg,
      #14131B 0%,
      #1B161E 28%,
      #26180F 56%,
      #231914 78%,
      #1A1613 100%
    );
  }

  /* Artwork Layer: flips cleanly in RTL, melts at bottom into sheet */
  .art-layer {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    -webkit-mask-image: linear-gradient(180deg, #000 0%, #000 72%, rgba(0,0,0,0.45) 89%, transparent 99%);
    mask-image: linear-gradient(180deg, #000 0%, #000 72%, rgba(0,0,0,0.45) 89%, transparent 99%);
  }

  [dir="rtl"] .art-layer {
    transform: scaleX(-1);
  }

  .art-layer svg {
    display: block;
    width: 100%;
    height: 100%;
  }

  /* Tactile Cotton-Rag Paper Tooth Overlay */
  .paper-grain {
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0.14;
    mix-blend-mode: multiply;
  }

  .theme-night .paper-grain {
    opacity: 0.10;
    mix-blend-mode: overlay;
  }

  /* Placeholder Legibility Text Overlay */
  .ui-overlay {
    position: relative;
    z-index: 3;
    width: 100%;
    height: 100%;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
  }

  .desktop .ui-overlay {
    padding: 18px 24px;
  }

  .top-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
  }

  .brand-lockup {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    color: var(--on-art-day);
    font-family: 'Frank Ruhl Libre', serif;
    font-weight: 700;
    font-size: 22px;
    letter-spacing: -0.01em;
  }

  .theme-night .brand-lockup { color: var(--on-art-night); }

  [dir="rtl"] .brand-mark { transform: scaleX(-1); }

  .loc-chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 34px;
    padding-inline: 10px 12px;
    background: var(--cream);
    color: var(--pine);
    border: 1.5px solid var(--pine);
    border-radius: 6px;
    box-shadow: 0 2px 0 var(--pine);
    font-family: 'Assistant', sans-serif;
    font-weight: 600;
    font-size: 15px;
    white-space: nowrap;
  }

  .theme-night .loc-chip {
    background: #29221C;
    color: #F2EADC;
    border-color: #0E0B09;
    box-shadow: 0 2px 0 #0E0B09;
  }

  .now-ring {
    width: 14px;
    height: 14px;
    border-radius: 999px;
    border: 2px solid var(--pine);
    background: var(--cream);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .theme-night .now-ring {
    border-color: #F2EADC;
    background: #29221C;
  }

  .now-ring::after {
    content: "";
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: var(--leather);
  }

  .copy-block {
    max-width: 60%;
    color: var(--on-art-day);
  }

  .desktop .copy-block {
    max-width: 46%;
  }

  .theme-night .copy-block { color: var(--on-art-night); }

  .hero-num {
    font-family: 'Frank Ruhl Libre', serif;
    font-weight: 700;
    font-size: 68px;
    line-height: 0.86;
    letter-spacing: -0.03em;
  }

  .desktop .hero-num { font-size: 78px; }

  .hero-unit {
    font-family: 'Assistant', sans-serif;
    font-weight: 600;
    font-size: 18px;
    letter-spacing: 0;
    margin-inline-start: 4px;
  }

  .hero-title {
    font-family: 'Frank Ruhl Libre', serif;
    font-weight: 600;
    font-size: 28px;
    line-height: 1.08;
    letter-spacing: -0.01em;
  }

  .desktop .hero-title { font-size: 34px; }

  [dir="rtl"] .hero-title,
  [dir="rtl"] .sub-line {
    letter-spacing: 0;
  }

  .sub-line {
    margin-top: 6px;
    font-size: 15px;
    font-weight: 600;
    line-height: 1.35;
    opacity: 0.96;
  }

  /* Seam Strip below 300px to prove zero hard edge into sheet */
  .sheet-seam-proof {
    height: 32px;
    padding: 0 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 14px;
    font-weight: 600;
  }

  .theme-day .sheet-seam-proof {
    background: var(--cream);
    color: var(--page-muted);
  }

  .theme-night .sheet-seam-proof {
    background: var(--night-surface);
    color: #B5AA99;
  }

  /* Optional Safe-Zone Wireframe Overlay */
  .zone-guide {
    display: none;
    position: absolute;
    z-index: 5;
    pointer-events: none;
    border: 1.5px dashed rgba(255, 245, 232, 0.75);
    border-radius: 6px;
    font-size: 13px;
    font-weight: 700;
    color: #FFF5E8;
    padding: 4px 8px;
    background: rgba(27, 38, 32, 0.28);
  }

  body.show-zones .zone-guide { display: block; }

  .zone-text {
    top: 52px;
    inset-inline-start: 14px;
    width: 56%;
    height: 112px;
  }

  .zone-guide-char {
    bottom: 0;
    inset-inline-start: 14px;
    width: 140px;
    height: 190px;
    border-color: #F2C17E;
  }

  .baseline-note {
    padding: 16px 20px;
    background: var(--cream);
    border: 1.5px solid var(--pine);
    border-radius: 6px;
    font-size: 15px;
    color: var(--pine);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .mini-me-swatches {
    display: flex;
    gap: 12px;
  }

  .mini-me {
    width: 150px;
    height: 54px;
    border-radius: 6px;
    border: 1.5px solid var(--pine);
  }

  .mini-me.day {
    background: linear-gradient(180deg, #8A3311 0%, #BA561E 50%, #EBC292 85%, #F8F3EA 100%);
  }

  .mini-me.night {
    background: linear-gradient(180deg, #14131B 0%, #26180F 56%, #1A1613 100%);
  }
</style>
</head>
<body>

<!-- Shared SVG Filters (Gouache Brush Edge, Linocut Block Carve, Cotton Paper Tooth) & Brand Icon -->
<svg width="0" height="0" style="position:absolute;overflow:hidden" aria-hidden="true">
  <defs>
    <!-- Hand-painted gouache irregular edge -->
    <filter id="gouache" x="-6%" y="-6%" width="112%" height="112%" color-interpolation-filters="sRGB">
      <feTurbulence type="turbulence" baseFrequency="0.032 0.038" numOctaves="3" seed="11" result="wobble"/>
      <feDisplacementMap in="SourceGraphic" in2="wobble" scale="2.7" xChannelSelector="R" yChannelSelector="G"/>
    </filter>

    <!-- Coarser carved linocut edge for foliage & foreground stone -->
    <filter id="linocut" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB">
      <feTurbulence type="turbulence" baseFrequency="0.022 0.026" numOctaves="3" seed="23" result="carve"/>
      <feDisplacementMap in="SourceGraphic" in2="carve" scale="3.6" xChannelSelector="R" yChannelSelector="G"/>
    </filter>

    <!-- Subtle cold-press rag paper grain -->
    <filter id="rag-tooth" x="0%" y="0%" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="3" seed="5" result="noise"/>
      <feColorMatrix type="matrix" values="
        0 0 0 0 0.22
        0 0 0 0 0.14
        0 0 0 0 0.08
        0 0 0 0.55 0"/>
    </filter>

    <!-- Brand Mark: Trail curve rising to Now-Ring -->
    <symbol id="icon-brand" viewBox="0 0 26 26">
      <path d="M4 22 C8 22, 10 15, 16 12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
      <circle cx="18.5" cy="8.5" r="5" fill="none" stroke="currentColor" stroke-width="2.2"/>
      <circle cx="18.5" cy="8.5" r="2.2" fill="#D2602F"/>
    </symbol>
  </defs>
</svg>

<div class="wrap">
  <header class="gallery-bar">
    <div class="gallery-title">
      <h1>Traike — Round 10 Painted Header Pictures</h1>
      <p>Gouache &amp; misregistered screen-print posters · Flat opaque plates · Tel Aviv &amp; Jaffa scenes · Seamless sheet melt</p>
    </div>
    <div class="controls">
      <div class="seg" role="group" aria-label="Language and direction">
        <button type="button" id="btn-ltr" class="active" onclick="setDir('ltr')">EN · LTR</button>
        <button type="button" id="btn-rtl" onclick="setDir('rtl')">עברית · RTL</button>
      </div>
      <div class="seg" role="group" aria-label="Safe zone guides">
        <button type="button" id="btn-clean" class="active" onclick="toggleZones(false)">Clean art</button>
        <button type="button" id="btn-zones" onclick="toggleZones(true)">Show safe zones</button>
      </div>
    </div>
  </header>

  <div id="gallery-root"></div>

  <div class="baseline-note">
    <div>
      <strong>6. Me / Settings header (unchanged per brief):</strong> Plain smooth sunset &amp; dusk sky melt without painted foreground art, anchoring the quieter account screen.
    </div>
    <div class="mini-me-swatches">
      <div class="mini-me day" title="Me — Day plain sunset"></div>
      <div class="mini-me night" title="Me — Night plain dusk"></div>
    </div>
  </div>
</div>

<script>
/* ==========================================================================
   POSTER ARTWORK GENERATORS (100% Flat Opaque Gouache & Linocut Plates)
   - Zero gradients on shapes; visible 2px screen-print misregistration
   - Hand-cut irregular polygons/paths + feTurbulence/feDisplacementMap
   - Calm top-start 60% x 55% sky zone; Plan leaves 140x190 bottom-start clear
   ========================================================================== */

function paperOverlaySVG(w, h) {
  return `<svg class="paper-grain" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <rect width="${w}" height="${h}" filter="url(#rag-tooth)"/>
  </svg>`;
}

/* --------------------------------------------------------------------------
   1. HOME — Jaffa Ottoman Clock Tower, Harbour Boats & Coastal Palm
   Accent: Verdigris Copper (#4A6E5D day / #3B5B4D night)
   -------------------------------------------------------------------------- */
function svgHome(mode, size) {
  const night = mode === 'night';
  const c = night ? {
    sea: '#2A232B',
    stoneBack: '#36261E',
    stoneMain: '#4A3123',
    plateShift: '#6E3B22',
    ink: '#131815',
    cream: '#D9CBB8',
    accent: '#3B5B4D',
    sunMoon: '#F2DEC1',
    lit: '#E8A23A',
    sheet: '#1A1613'
  } : {
    sea: '#D8903E',
    stoneBack: '#8A3311',
    stoneMain: '#B5481C',
    plateShift: '#F8F3EA',
    ink: '#1B2620',
    cream: '#F8F3EA',
    accent: '#4A6E5D',
    sunMoon: '#F8F3EA',
    lit: '#1B2620',
    sheet: '#F8F3EA'
  };

  if (size === 'phone') {
    return `<svg viewBox="0 0 390 300" preserveAspectRatio="none" aria-hidden="true">
      <g filter="url(#gouache)">
        <!-- Hand-cut sun (day) or carved crescent moon (night) -->
        ${night
          ? `<path d="M242 42 L251 37 L260 40 L265 49 L262 60 L253 66 L243 65 L250 58 L252 49 Z" fill="${c.sunMoon}"/>`
          : `<path d="M232 146 L241 135 L255 132 L268 138 L273 151 L269 164 L230 163 Z" fill="${c.sunMoon}"/>`
        }

        <!-- Flat harbour sea band on right half -->
        <path d="M168 206 L390 202 L390 258 L150 258 Z" fill="${c.sea}"/>
        <!-- Screen-print cut wave strokes -->
        <path d="M188 220 L226 219 L224 223 L186 223 Z M212 232 L246 231 L245 235 L210 235 Z" fill="${c.plateShift}"/>

        <!-- Two Jaffa harbour fishing boats -->
        <g transform="translate(2, -1.5)">
          <path d="M196 205 L212 182 L214 205 Z" fill="${c.plateShift}"/>
        </g>
        <path d="M189 206 L221 205 L216 213 L194 213 Z" fill="${c.ink}"/>
        <path d="M197 205 L212 183 L213 204 Z" fill="${c.accent}"/>
        <path d="M233 213 L252 212 L249 218 L236 218 Z" fill="${c.ink}"/>

        <!-- Distant stepped Old Jaffa hillside houses + rooftop dud-shemesh -->
        <path d="M244 205 L244 176 L269 175 L270 158 L302 158 L303 142 L352 143 L354 128 L390 128 L390 232 L238 228 Z" fill="${c.stoneBack}"/>
        <!-- Rooftop solar water tank (Dud Shemesh) -->
        <rect x="331" y="131" width="7" height="12" fill="${c.cream}"/>
        <path d="M339 133 L347 142 L344 143 L337 134 Z" fill="${c.ink}"/>

        <!-- Misregistered highlight plate for Clock Tower (+2px, -2px) -->
        <g transform="translate(-2.2, -1.8)">
          <path d="M284 218 L285 112 L292 109 L292 84 L303 66 L315 84 L315 109 L321 112 L323 218 Z" fill="${c.plateShift}"/>
        </g>

        <!-- Jaffa Ottoman Clock Tower main limestone body -->
        <path d="M284 220 L285 113 L322 113 L324 220 Z" fill="${c.stoneMain}"/>
        <path d="M289 113 L290 85 L317 85 L318 113 Z" fill="${c.stoneMain}"/>
        <!-- Copper/verdigris pointed clock-tower roof & spire -->
        <path d="M287 86 L303 62 L320 86 Z" fill="${c.accent}"/>
        <path d="M302 50 L305 50 L305 64 L302 64 Z" fill="${c.ink}"/>
        <!-- Cornice ledges -->
        <path d="M282 112 L325 111 L325 116 L282 116 Z M282 152 L325 151 L325 155 L282 155 Z" fill="${c.ink}"/>
        <!-- Irregular clock plate & hands -->
        <path d="M297 93 L304 90 L310 93 L312 100 L309 106 L302 108 L296 105 L295 98 Z" fill="${c.cream}"/>
        <path d="M303 93 L303 100 L308 102" fill="none" stroke="${c.ink}" stroke-width="2" stroke-linecap="square"/>
        <!-- Arched tower lancet window & lower shutters -->
        <path d="M298 124 C298 118, 309 118, 309 124 L309 144 L298 144 Z" fill="${night ? c.lit : c.accent}"/>
        <rect x="299" y="164" width="9" height="18" fill="${night ? c.lit : c.ink}"/>

        <!-- Foreground Ottoman stone courtyard buildings & AC box -->
        <path d="M322 226 L323 164 L366 162 L367 148 L390 148 L390 245 Z" fill="${c.stoneMain}"/>
        <rect x="340" y="176" width="8" height="13" fill="${night ? c.lit : c.ink}"/>
        <rect x="334" y="176" width="5" height="13" fill="${c.accent}"/>
        <rect x="349" y="176" width="5" height="13" fill="${c.accent}"/>
        <!-- Tiny AC condenser on stone wall -->
        <rect x="360" y="182" width="11" height="8" fill="${c.cream}"/>
        <rect x="362" y="184" width="5" height="5" fill="${c.ink}"/>
      </g>

      <!-- Linocut foreground promenade wall, palm silhouette & street wire -->
      <g filter="url(#linocut)">
        <path d="M262 126 Q326 138 390 116" fill="none" stroke="${c.ink}" stroke-width="1.6"/>
        <!-- Gnarled Jaffa palm on far inline-end -->
        <path d="M366 246 C363 196, 368 142, 360 94 L367 93 C375 142, 371 196, 375 246 Z" fill="${c.ink}"/>
        <path d="M363 96 C342 82, 322 90, 312 103 C330 97, 346 96, 362 102 Z" fill="${c.ink}"/>
        <path d="M363 94 C346 70, 326 68, 315 76 C333 76, 348 82, 363 98 Z" fill="${c.ink}"/>
        <path d="M365 93 C374 72, 384 68, 392 72 C382 79, 374 86, 367 97 Z" fill="${c.ink}"/>
        <path d="M366 98 C378 92, 387 96, 393 105 C383 102, 374 101, 366 103 Z" fill="${c.ink}"/>

        <!-- Stepped promenade parapet & limestone sheet-melt ground -->
        <path d="M126 254 L236 238 L314 222 L390 214 L390 300 L0 300 L0 272 Z" fill="${c.ink}"/>
        <path d="M0 268 L158 256 L278 238 L390 232 L390 300 L0 300 Z" fill="${c.sheet}"/>
      </g>
    </svg>`;
  }

  /* Desktop 1180x300 panoramic travel poster */
  return `<svg viewBox="0 0 1180 300" preserveAspectRatio="none" aria-hidden="true">
    <g filter="url(#gouache)">
      ${night
        ? `<path d="M760 44 L772 37 L784 41 L790 53 L786 67 L774 74 L762 72 L771 63 L773 52 Z" fill="${c.sunMoon}"/>`
        : `<path d="M708 158 L722 142 L742 138 L760 146 L768 164 L762 180 L704 179 Z" fill="${c.sunMoon}"/>`
      }

      <!-- Wide Mediterranean horizon band -->
      <path d="M470 206 L1180 198 L1180 262 L430 262 Z" fill="${c.sea}"/>
      <path d="M540 220 L615 219 L612 224 L538 224 Z M645 229 L728 228 L725 233 L642 233 Z M590 240 L652 239 L650 243 L588 243 Z" fill="${c.plateShift}"/>

      <!-- Harbour fishing boats -->
      <g transform="translate(2.5, -1.8)">
        <path d="M604 205 L626 174 L629 205 Z" fill="${c.plateShift}"/>
        <path d="M682 212 L697 190 L699 212 Z" fill="${c.plateShift}"/>
      </g>
      <path d="M592 206 L640 205 L633 215 L599 215 Z" fill="${c.ink}"/>
      <path d="M605 205 L626 175 L628 204 Z" fill="${c.accent}"/>
      <path d="M674 213 L708 212 L703 220 L679 220 Z" fill="${c.ink}"/>
      <path d="M683 212 L697 191 L698 211 Z" fill="${c.stoneBack}"/>

      <!-- Stepped Old Jaffa ridge & Ottoman roofs -->
      <path d="M770 206 L772 174 L818 173 L820 152 L878 152 L880 134 L995 134 L998 118 L1085 118 L1088 104 L1180 104 L1180 240 L762 232 Z" fill="${c.stoneBack}"/>
      <!-- Rooftop Dud Shemesh boilers -->
      <rect x="852" y="139" width="9" height="14" fill="${c.cream}"/>
      <path d="M863 141 L874 152 L870 153 L860 142 Z" fill="${c.ink}"/>
      <rect x="1032" y="104" width="9" height="14" fill="${c.cream}"/>
      <path d="M1043 106 L1054 118 L1050 119 L1040 107 Z" fill="${c.ink}"/>

      <!-- Misregistered plate on Jaffa Clock Tower -->
      <g transform="translate(-2.5, -2)">
        <path d="M912 222 L914 104 L922 100 L923 72 L938 50 L954 72 L955 100 L963 104 L965 222 Z" fill="${c.plateShift}"/>
      </g>
      <path d="M912 224 L914 104 L964 104 L966 224 Z" fill="${c.stoneMain}"/>
      <path d="M920 104 L921 73 L956 73 L957 104 Z" fill="${c.stoneMain}"/>
      <path d="M917 74 L938 46 L960 74 Z" fill="${c.accent}"/>
      <path d="M937 32 L940 32 L940 48 L937 48 Z" fill="${c.ink}"/>
      <path d="M909 103 L968 102 L968 108 L909 108 Z M909 149 L968 148 L968 153 L909 153 Z" fill="${c.ink}"/>
      <path d="M930 82 L939 79 L947 83 L949 91 L945 98 L936 100 L929 96 L928 88 Z" fill="${c.cream}"/>
      <path d="M938 83 L938 91 L944 93" fill="none" stroke="${c.ink}" stroke-width="2.2"/>
      <path d="M931 118 C931 110, 946 110, 946 118 L946 141 L931 141 Z" fill="${night ? c.lit : c.accent}"/>
      <rect x="932" y="162" width="13" height="22" fill="${night ? c.lit : c.ink}"/>

      <!-- Right courtyard stone facades, shutters & AC unit -->
      <path d="M964 228 L966 156 L1042 154 L1044 136 L1126 135 L1128 122 L1180 122 L1180 248 Z" fill="${c.stoneMain}"/>
      <rect x="994" y="170" width="11" height="17" fill="${night ? c.lit : c.ink}"/>
      <rect x="986" y="170" width="6" height="17" fill="${c.accent}"/>
      <rect x="1007" y="170" width="6" height="17" fill="${c.accent}"/>
      <rect x="1068" y="154" width="11" height="17" fill="${night ? c.lit : c.ink}"/>
      <rect x="1094" y="160" width="15" height="11" fill="${c.cream}"/>
      <rect x="1097" y="162" width="6" height="7" fill="${c.ink}"/>
    </g>

    <g filter="url(#linocut)">
      <path d="M878 122 Q1025 142 1180 106" fill="none" stroke="${c.ink}" stroke-width="1.8"/>
      <!-- Foreground coastal palms & promenade balustrade -->
      <path d="M1118 242 C1113 186, 1120 128, 1108 76 L1117 75 C1128 128, 1122 186, 1128 242 Z" fill="${c.ink}"/>
      <path d="M1112 78 C1084 62, 1054 72, 1040 88 C1065 80, 1088 79, 1111 85 Z" fill="${c.ink}"/>
      <path d="M1112 76 C1090 48, 1062 46, 1046 56 C1070 56, 1092 63, 1112 80 Z" fill="${c.ink}"/>
      <path d="M1115 75 C1128 50, 1148 45, 1166 52 C1148 59, 1132 68, 1118 80 Z" fill="${c.ink}"/>
      <path d="M1116 80 C1138 72, 1158 78, 1172 90 C1152 86, 1134 84, 1116 86 Z" fill="${c.ink}"/>

      <path d="M410 258 L745 236 L965 218 L1180 208 L1180 300 L0 300 L0 274 Z" fill="${c.ink}"/>
      <path d="M0 270 L510 256 L860 236 L1180 228 L1180 300 L0 300 Z" fill="${c.sheet}"/>
    </g>
  </svg>`;
}

/* --------------------------------------------------------------------------
   2. PLAN — White City Bauhaus Ribbon Balconies, Rolled Shutters & Bougainvillea
   Note: Bottom-start 140x190 zone kept 100% clear for the Guide photo!
   Accent: Bougainvillea Crimson (#B5344B day / #9E2E44 night)
   -------------------------------------------------------------------------- */
function svgPlan(mode, size) {
  const night = mode === 'night';
  const c = night ? {
    plasterMain: '#3D3129',
    plasterLight: '#59473A',
    undercut: '#141815',
    shutter: '#2A221C',
    boug: '#9E2E44',
    bougShift: '#C94A61',
    lit: '#E8A23A',
    ink: '#121714',
    sheet: '#1A1613'
  } : {
    plasterMain: '#E8C59B',
    plasterLight: '#F8F3EA',
    undercut: '#8A3311',
    shutter: '#B5481C',
    boug: '#B5344B',
    bougShift: '#D2602F',
    lit: '#1B2620',
    ink: '#1B2620',
    sheet: '#F8F3EA'
  };

  if (size === 'phone') {
    return `<svg viewBox="0 0 390 300" preserveAspectRatio="none" aria-hidden="true">
      <!-- Strictly right of x=212 so x=0..160 (Guide 140x190 + margin) is completely free -->
      <g filter="url(#gouache)">
        <!-- Misregistered warm plaster highlight plate -->
        <g transform="translate(-2.5, -2)">
          <path d="M236 254 L238 82 C238 72, 250 66, 268 66 L390 64 L390 254 Z" fill="${c.plasterLight}"/>
        </g>

        <!-- Main Bauhaus apartment volume -->
        <path d="M238 258 L240 82 C240 72, 252 67, 270 67 L390 65 L390 258 Z" fill="${c.plasterMain}"/>

        <!-- Iconic curved Bauhaus ribbon balcony #1 (upper) -->
        <path d="M222 122 C222 113, 236 109, 258 109 L390 108 L390 132 L254 133 C234 133, 222 129, 222 122 Z" fill="${c.plasterLight}"/>
        <path d="M225 131 L390 130 L390 139 L244 139 C231 139, 225 136, 225 131 Z" fill="${c.undercut}"/>
        <!-- Thin steel handrail -->
        <path d="M226 103 L390 102" fill="none" stroke="${c.ink}" stroke-width="1.8"/>

        <!-- Iconic curved Bauhaus ribbon balcony #2 (lower) -->
        <path d="M218 188 C218 179, 234 175, 256 175 L390 174 L390 198 L252 199 C232 199, 218 195, 218 188 Z" fill="${c.plasterLight}"/>
        <path d="M221 197 L390 196 L390 205 L242 205 C229 205, 221 202, 221 197 Z" fill="${c.undercut}"/>
        <path d="M222 169 L390 168" fill="none" stroke="${c.ink}" stroke-width="1.8"/>

        <!-- Recessed windows & rolled wooden Tris shutters -->
        <rect x="268" y="80" width="28" height="28" fill="${night ? c.lit : c.ink}"/>
        <path d="M268 80 L296 80 L296 92 L268 92 Z" fill="${c.shutter}"/>
        <path d="M268 84 L296 84 M268 88 L296 88" stroke="${c.ink}" stroke-width="1.3"/>

        <!-- Vertical stairwell thermometer window (classic Tel Aviv Bauhaus) -->
        <rect x="358" y="78" width="12" height="26" fill="${c.ink}"/>
        <rect x="358" y="143" width="12" height="26" fill="${night ? c.lit : c.ink}"/>

        <!-- Lower balcony doorway + shutter slats -->
        <rect x="272" y="144" width="30" height="30" fill="${night ? c.lit : c.ink}"/>
        <rect x="263" y="144" width="8" height="30" fill="${c.shutter}"/>
        <rect x="303" y="144" width="8" height="30" fill="${c.shutter}"/>

        <!-- Exterior wall AC unit + drip hose -->
        <rect x="322" y="148" width="20" height="14" fill="${c.plasterLight}"/>
        <circle cx="329" cy="155" r="4.5" fill="${c.ink}"/>
        <path d="M338 150 L340 150 L340 160 L338 160 Z" fill="${c.ink}"/>

        <!-- Terracotta balcony planter box -->
        <path d="M242 166 L264 166 L262 175 L244 175 Z" fill="${c.undercut}"/>
      </g>

      <!-- Bougainvillea cascade & Rothschild Ficus branch -->
      <g filter="url(#linocut)">
        <g transform="translate(2, -1.5)">
          <path d="M288 104 L318 98 L336 112 L326 138 L302 146 L284 126 Z" fill="${c.bougShift}"/>
        </g>
        <path d="M284 106 L314 96 L338 108 L332 134 L310 148 L292 138 L280 120 Z" fill="${c.boug}"/>
        <path d="M312 114 L320 112 L318 120 Z M296 124 L303 122 L301 129 Z" fill="${c.plasterLight}"/>

        <!-- Ficus canopy silhouette entering upper-end & bottom-end -->
        <path d="M342 52 L372 44 L390 48 L390 88 L364 84 L346 68 Z" fill="${c.ink}"/>
        <path d="M234 226 L268 214 L312 218 L354 206 L390 208 L390 266 L220 264 Z" fill="${c.ink}"/>

        <!-- Smooth ground plane melting into cream/night sheet -->
        <path d="M0 274 L196 266 L278 244 L390 236 L390 300 L0 300 Z" fill="${c.sheet}"/>
      </g>
    </svg>`;
  }

  /* Desktop 1180x300 Bauhaus boulevard corner */
  return `<svg viewBox="0 0 1180 300" preserveAspectRatio="none" aria-hidden="true">
    <g filter="url(#gouache)">
      <!-- Background second Bauhaus block -->
      <path d="M690 256 L692 118 C692 108, 704 104, 724 104 L856 103 L856 256 Z" fill="${c.undercut}"/>
      <path d="M678 156 C678 149, 690 146, 710 146 L856 145 L856 164 L696 165 C684 165, 678 161, 678 156 Z" fill="${c.plasterMain}"/>
      <rect x="734" y="118" width="26" height="26" fill="${night ? c.lit : c.ink}"/>

      <!-- Misregistered plaster plate on foreground corner building -->
      <g transform="translate(-3, -2)">
        <path d="M846 258 L848 68 C848 56, 864 50, 892 50 L1180 48 L1180 258 Z" fill="${c.plasterLight}"/>
      </g>
      <path d="M848 260 L850 68 C850 56, 866 51, 894 51 L1180 49 L1180 260 Z" fill="${c.plasterMain}"/>

      <!-- Curved ribbon balcony #1 -->
      <path d="M822 114 C822 104, 842 99, 874 99 L1180 97 L1180 124 L868 126 C838 126, 822 121, 822 114 Z" fill="${c.plasterLight}"/>
      <path d="M826 124 L1180 122 L1180 133 L856 134 C836 134, 826 130, 826 124 Z" fill="${c.undercut}"/>
      <path d="M828 92 L1180 90" fill="none" stroke="${c.ink}" stroke-width="2"/>

      <!-- Curved ribbon balcony #2 -->
      <path d="M816 186 C816 176, 838 171, 870 171 L1180 169 L1180 196 L864 198 C834 198, 816 193, 816 186 Z" fill="${c.plasterLight}"/>
      <path d="M820 196 L1180 194 L1180 205 L852 206 C832 206, 820 202, 820 196 Z" fill="${c.undercut}"/>
      <path d="M822 164 L1180 162" fill="none" stroke="${c.ink}" stroke-width="2"/>

      <!-- Windows, rolled Tris shutters & AC unit -->
      <rect x="892" y="66" width="38" height="32" fill="${night ? c.lit : c.ink}"/>
      <path d="M892 66 L930 66 L930 80 L892 80 Z" fill="${c.shutter}"/>
      <path d="M892 71 L930 71 M892 76 L930 76" stroke="${c.ink}" stroke-width="1.4"/>

      <rect x="1036" y="64" width="16" height="30" fill="${c.ink}"/>
      <rect x="1036" y="136" width="16" height="30" fill="${night ? c.lit : c.ink}"/>

      <rect x="896" y="138" width="40" height="32" fill="${night ? c.lit : c.ink}"/>
      <rect x="884" y="138" width="10" height="32" fill="${c.shutter}"/>
      <rect x="938" y="138" width="10" height="32" fill="${c.shutter}"/>

      <rect x="968" y="142" width="26" height="17" fill="${c.plasterLight}"/>
      <circle cx="977" cy="150.5" r="5.5" fill="${c.ink}"/>
      <rect x="1084" y="138" width="36" height="30" fill="${c.ink}"/>
      <rect x="850" y="160" width="28" height="10" fill="${c.undercut}"/>
    </g>

    <g filter="url(#linocut)">
      <!-- Crimson bougainvillea cascade -->
      <g transform="translate(2.5, -2)">
        <path d="M936 94 L978 86 L1008 104 L996 138 L962 148 L932 124 Z" fill="${c.bougShift}"/>
      </g>
      <path d="M930 96 L974 84 L1010 100 L1002 134 L970 150 L942 138 L924 116 Z" fill="${c.boug}"/>
      <path d="M968 108 L978 105 L975 115 Z M948 120 L958 118 L955 127 Z" fill="${c.plasterLight}"/>

      <!-- Rothschild Boulevard Ficus tree on far right & street wire -->
      <path d="M640 94 Q755 114 850 88" fill="none" stroke="${c.ink}" stroke-width="1.6"/>
      <path d="M1126 248 C1124 190, 1134 134, 1118 76 L1132 74 C1146 132, 1138 190, 1142 248 Z" fill="${c.ink}"/>
      <path d="M1076 58 L1124 38 L1180 42 L1180 98 L1118 96 L1082 78 Z" fill="${c.ink}"/>
      <path d="M668 242 L760 224 L890 218 L1045 204 L1180 206 L1180 268 L640 266 Z" fill="${c.ink}"/>

      <path d="M0 274 L610 264 L885 242 L1180 232 L1180 300 L0 300 Z" fill="${c.sheet}"/>
    </g>
  </svg>`;
}

/* --------------------------------------------------------------------------
   3. WALK — Old Jaffa Limestone Archway, Hanging Planters, Lantern & Laundry
   Accent: Olive Clay (#5A6E47 day / #485A39 night)
   -------------------------------------------------------------------------- */
function svgWalk(mode, size) {
  const night = mode === 'night';
  const c = night ? {
    archDark: '#131815',
    stone: '#3D291E',
    voussoir: '#563827',
    shift: '#7A4728',
    olive: '#485A39',
    laundry: '#D9CBB8',
    lantern: '#F0AE3E',
    sea: '#2B353E',
    sheet: '#1A1613'
  } : {
    archDark: '#1B2620',
    stone: '#8A3311',
    voussoir: '#C45725',
    shift: '#F8F3EA',
    olive: '#5A6E47',
    laundry: '#F8F3EA',
    lantern: '#F8F3EA',
    sea: '#D8903E',
    sheet: '#F8F3EA'
  };

  if (size === 'phone') {
    return `<svg viewBox="0 0 390 300" preserveAspectRatio="none" aria-hidden="true">
      <g filter="url(#gouache)">
        <!-- Distant sea sliver & stepped alley house inside the arch opening -->
        <path d="M236 212 L352 210 L352 252 L236 252 Z" fill="${c.sea}"/>
        <path d="M276 212 L278 158 L332 156 L334 212 Z" fill="${c.stone}"/>
        <rect x="294" y="170" width="11" height="16" fill="${night ? c.lantern : c.archDark}"/>
        <rect x="286" y="170" width="6" height="16" fill="${c.olive}"/>

        <!-- Misregistered highlight plate along the inner stone arch -->
        <g transform="translate(-2.4, 1.6)">
          <path d="M228 254 L230 128 C232 76, 326 68, 348 118 L350 254 L390 254 L390 42 L206 54 L204 254 Z" fill="${c.shift}"/>
        </g>

        <!-- Heavy Ottoman stone archway wing on right half -->
        <path d="M206 258 L208 62 L390 34 L390 258 L344 258 L342 126 C336 74, 240 76, 234 132 L232 258 Z" fill="${c.stone}"/>

        <!-- Individual carved stone voussoir blocks around arch ring -->
        <path d="M224 122 L238 124 L241 110 L228 106 Z" fill="${c.voussoir}"/>
        <path d="M234 99 L247 105 L256 94 L245 86 Z" fill="${c.voussoir}"/>
        <path d="M254 81 L264 90 L278 84 L272 73 Z" fill="${c.voussoir}"/>
        <path d="M281 71 L285 83 L301 83 L303 70 Z" fill="${c.voussoir}"/>
        <path d="M311 73 L308 85 L323 92 L331 81 Z" fill="${c.voussoir}"/>
        <path d="M336 89 L327 99 L336 113 L348 106 Z" fill="${c.voussoir}"/>

        <!-- Laundry line strung across the alley arch + 3 fluttering garments -->
        <path d="M234 124 Q288 136 342 118" fill="none" stroke="${c.archDark}" stroke-width="1.6"/>
        <path d="M252 128 L268 130 L266 154 L250 151 Z" fill="${c.laundry}"/>
        <path d="M276 131 L291 132 L293 150 L275 149 Z" fill="${ '#D2602F' }"/>
        <path d="M301 130 L315 127 L317 146 L302 148 Z" fill="${c.laundry}"/>

        <!-- Wrought-iron bracket & hexagonal Jaffa alley lantern -->
        <path d="M207 142 L185 142 L185 150 M207 152 Q194 144 191 142" fill="none" stroke="${c.archDark}" stroke-width="2.2"/>
        <path d="M177 150 L193 150 L190 170 L180 170 Z" fill="${c.lantern}"/>
        <path d="M175 150 L195 150 L185 144 Z M177 150 L193 150 L190 170 L180 170 Z" fill="none" stroke="${c.archDark}" stroke-width="2"/>
      </g>

      <!-- Hanging clay planters, trailing olive vines & stepped cobble melt -->
      <g filter="url(#linocut)">
        <!-- Hanging terracotta pot inside arch -->
        <path d="M322 92 L322 112 M314 112 L330 112 L327 124 L317 124 Z" fill="${ '#D2602F' }" stroke="${c.archDark}" stroke-width="1.5"/>
        <path d="M312 116 C304 126, 306 140, 312 148 C316 136, 318 126, 322 122 C326 132, 328 144, 334 150 C336 136, 334 122, 329 115 Z" fill="${c.olive}"/>

        <!-- Right foreground pillar shadow & wall planter -->
        <path d="M352 34 L390 30 L390 264 L348 264 Z" fill="${c.archDark}"/>
        <path d="M336 52 L364 46 L378 68 L354 78 L334 66 Z" fill="${c.olive}"/>

        <!-- Stepped alley cobbles melting into sheet -->
        <path d="M158 258 L234 242 L348 232 L390 228 L390 300 L0 300 L0 274 Z" fill="${c.archDark}"/>
        <path d="M0 270 L176 258 L292 242 L390 238 L390 300 L0 300 Z" fill="${c.sheet}"/>
      </g>
    </svg>`;
  }

  /* Desktop 1180x300 Old Jaffa double stone arch & alley stage */
  return `<svg viewBox="0 0 1180 300" preserveAspectRatio="none" aria-hidden="true">
    <g filter="url(#gouache)">
      <!-- Distant harbour sea & sunny Jaffa alley buildings -->
      <path d="M760 210 L1080 206 L1080 256 L760 256 Z" fill="${c.sea}"/>
      <path d="M832 210 L835 144 L924 142 L926 126 L1018 126 L1020 210 Z" fill="${c.stone}"/>
      <rect x="862" y="160" width="15" height="22" fill="${night ? c.lantern : c.archDark}"/>
      <rect x="850" y="160" width="9" height="22" fill="${c.olive}"/>
      <rect x="954" y="146" width="15" height="22" fill="${night ? c.lantern : c.archDark}"/>

      <!-- Misregistered arch plate -->
      <g transform="translate(-3, 1.8)">
        <path d="M744 258 L748 118 C754 54, 984 48, 1008 114 L1012 258 L1180 258 L1180 24 L708 42 L704 258 Z" fill="${c.shift}"/>
      </g>

      <!-- Heavy carved limestone arch spanning right side -->
      <path d="M706 260 L710 46 L1180 18 L1180 260 L1004 260 L1000 120 C988 54, 762 58, 752 124 L748 260 Z" fill="${c.stone}"/>

      <!-- Voussoir stone blocks -->
      <path d="M738 110 L756 113 L762 96 L744 90 Z" fill="${c.voussoir}"/>
      <path d="M754 82 L772 90 L788 76 L772 65 Z" fill="${c.voussoir}"/>
      <path d="M786 58 L798 71 L824 63 L815 48 Z" fill="${c.voussoir}"/>
      <path d="M834 45 L840 60 L874 58 L876 42 Z" fill="${c.voussoir}"/>
      <path d="M894 43 L892 59 L926 64 L934 48 Z" fill="${c.voussoir}"/>
      <path d="M948 54 L938 68 L966 82 L980 69 Z" fill="${c.voussoir}"/>
      <path d="M988 79 L974 90 L990 110 L1006 101 Z" fill="${c.voussoir}"/>

      <!-- Laundry line & fluttering shirts -->
      <path d="M754 118 Q878 136 998 110" fill="none" stroke="${c.archDark}" stroke-width="1.8"/>
      <path d="M792 124 L818 127 L814 158 L788 154 Z" fill="${c.laundry}"/>
      <path d="M834 128 L860 130 L863 154 L832 152 Z" fill="#D2602F"/>
      <path d="M878 129 L902 127 L905 152 L880 154 Z" fill="${c.laundry}"/>
      <path d="M920 125 L940 121 L943 143 L922 146 Z" fill="${c.olive}"/>

      <!-- Wrought-iron lantern protruding from outer left pier -->
      <path d="M708 136 L674 136 L674 146 M708 150 Q688 139 682 136" fill="none" stroke="${c.archDark}" stroke-width="2.4"/>
      <path d="M662 146 L686 146 L682 174 L666 174 Z" fill="${c.lantern}"/>
      <path d="M659 146 L689 146 L674 138 Z M662 146 L686 146 L682 174 L666 174 Z" fill="none" stroke="${c.archDark}" stroke-width="2.2"/>
    </g>

    <g filter="url(#linocut)">
      <!-- Hanging planters & trailing vines -->
      <path d="M962 78 L962 104 M950 104 L974 104 L970 120 L954 120 Z" fill="#D2602F" stroke="${c.archDark}" stroke-width="1.6"/>
      <path d="M946 110 C936 124, 938 142, 946 154 C952 138, 956 124, 962 118 C968 132, 972 148, 980 156 C982 138, 978 118, 972 108 Z" fill="${c.olive}"/>

      <!-- Deep shadow wing on right edge + wooden shuttered shop door -->
      <path d="M1076 20 L1180 16 L1180 266 L1070 266 Z" fill="${c.archDark}"/>
      <rect x="1024" y="156" width="32" height="68" fill="${c.olive}"/>
      <path d="M1040 156 L1040 224" stroke="${c.archDark}" stroke-width="2"/>
      <path d="M1042 36 L1094 26 L1122 58 L1084 74 L1040 56 Z" fill="${c.olive}"/>

      <path d="M520 260 L748 240 L1020 226 L1180 220 L1180 300 L0 300 L0 274 Z" fill="${c.archDark}"/>
      <path d="M0 270 L560 258 L890 240 L1180 234 L1180 300 L0 300 Z" fill="${c.sheet}"/>
    </g>
  </svg>`;
}

/* --------------------------------------------------------------------------
   4. WALKS — Shuk HaCarmel Striped Market Awnings, Crates & Utility Wires
   Accent: Market Canvas Teal (#38625E day / #2F5350 night)
   -------------------------------------------------------------------------- */
function svgWalks(mode, size) {
  const night = mode === 'night';
  const c = night ? {
    bldg: '#3A2A20',
    awningA: '#C95A2B',
    awningB: '#DED0BC',
    teal: '#2F5350',
    crate: '#694326',
    fruit: '#E07A35',
    lit: '#EEA83B',
    ink: '#121714',
    sheet: '#1A1613'
  } : {
    bldg: '#8A3311',
    awningA: '#D2602F',
    awningB: '#F8F3EA',
    teal: '#38625E',
    crate: '#D8903E',
    fruit: '#B53818',
    lit: '#1B2620',
    ink: '#1B2620',
    sheet: '#F8F3EA'
  };

  if (size === 'phone') {
    return `<svg viewBox="0 0 390 300" preserveAspectRatio="none" aria-hidden="true">
      <g filter="url(#gouache)">
        <!-- Upper market apartment facade + rooftop Dud Shemesh -->
        <path d="M254 220 L256 108 L334 106 L336 92 L390 92 L390 226 Z" fill="${c.bldg}"/>
        <rect x="276" y="122" width="16" height="20" fill="${night ? c.lit : c.ink}"/>
        <rect x="312" y="122" width="16" height="20" fill="${c.teal}"/>
        <rect x="352" y="110" width="18" height="22" fill="${night ? c.lit : c.ink}"/>
        <!-- Rooftop water heater + angled solar collector -->
        <rect x="294" y="91" width="8" height="15" fill="${c.awningB}"/>
        <path d="M304 94 L315 106 L311 107 L301 95 Z" fill="${c.ink}"/>

        <!-- Misregistered cream plate under market awnings -->
        <g transform="translate(-2.2, -1.8)">
          <path d="M196 182 L262 154 L390 146 L390 192 L196 196 Z" fill="${c.awningB}"/>
        </g>

        <!-- Striped Shuk HaCarmel pitched awnings -->
        <path d="M194 184 L232 162 L258 162 L222 186 Z" fill="${c.awningA}"/>
        <path d="M222 186 L258 162 L284 160 L252 187 Z" fill="${c.awningB}"/>
        <path d="M252 187 L284 160 L312 158 L284 188 Z" fill="${c.teal}"/>
        <path d="M284 188 L312 158 L342 154 L318 189 Z" fill="${c.awningA}"/>
        <path d="M318 189 L342 154 L390 150 L390 190 Z" fill="${c.awningB}"/>
        <!-- Scalloped canvas valence lip -->
        <path d="M194 184 L390 189 L390 196 L194 191 Z" fill="${c.ink}"/>

        <!-- Night market string bulbs under awning -->
        ${night ? `
          <circle cx="228" cy="196" r="3.2" fill="${c.lit}"/>
          <circle cx="268" cy="197" r="3.2" fill="${c.lit}"/>
          <circle cx="310" cy="198" r="3.2" fill="${c.lit}"/>
          <circle cx="352" cy="198" r="3.2" fill="${c.lit}"/>
        ` : ''}

        <!-- Stacked wooden produce crates & heaps of Jaffa oranges -->
        <path d="M224 222 L238 212 L254 214 L264 223 Z" fill="${c.awningA}"/>
        <path d="M268 220 L284 209 L302 211 L312 222 Z" fill="${c.fruit}"/>
        <path d="M318 218 L336 208 L356 210 L366 220 Z" fill="${c.teal}"/>

        <rect x="218" y="221" width="46" height="22" fill="${c.crate}" stroke="${c.ink}" stroke-width="1.6"/>
        <path d="M218 228 L264 228 M218 235 L264 235" stroke="${c.ink}" stroke-width="1.3"/>
        <rect x="268" y="219" width="46" height="24" fill="${c.crate}" stroke="${c.ink}" stroke-width="1.6"/>
        <path d="M268 227 L314 227 M268 234 L314 234" stroke="${c.ink}" stroke-width="1.3"/>
        <rect x="318" y="217" width="54" height="26" fill="${c.crate}" stroke="${c.ink}" stroke-width="1.6"/>
        <path d="M318 226 L372 226" stroke="${c.ink}" stroke-width="1.4"/>
      </g>

      <!-- Concrete Tel Aviv utility pole & crisscrossing market wires -->
      <g filter="url(#linocut)">
        <path d="M236 74 L242 74 L245 164 L237 164 Z" fill="${c.ink}"/>
        <path d="M229 82 L250 82 M231 92 L248 92" stroke="${c.ink}" stroke-width="2.2"/>
        <path d="M174 96 Q208 104 238 84 Q312 106 390 78" fill="none" stroke="${c.ink}" stroke-width="1.5"/>
        <path d="M239 92 Q314 118 390 96" fill="none" stroke="${c.ink}" stroke-width="1.3"/>

        <!-- Awning iron poles & foreground melt -->
        <path d="M206 190 L206 248 M296 192 L296 246" stroke="${c.ink}" stroke-width="2.4"/>
        <path d="M150 256 L224 240 L390 232 L390 300 L0 300 L0 274 Z" fill="${c.ink}"/>
        <path d="M0 270 L180 256 L305 242 L390 238 L390 300 L0 300 Z" fill="${c.sheet}"/>
      </g>
    </svg>`;
  }

  /* Desktop 1180x300 Carmel Market panorama */
  return `<svg viewBox="0 0 1180 300" preserveAspectRatio="none" aria-hidden="true">
    <g filter="url(#gouache)">
      <!-- Background Bauhaus & Kerem HaTeimanim roofs -->
      <path d="M742 228 L744 116 L856 114 L858 96 L992 95 L994 80 L1180 80 L1180 232 Z" fill="${c.bldg}"/>
      <rect x="782" y="132" width="22" height="24" fill="${night ? c.lit : c.ink}"/>
      <rect x="824" y="132" width="22" height="24" fill="${c.teal}"/>
      <rect x="904" y="114" width="24" height="26" fill="${night ? c.lit : c.ink}"/>
      <rect x="948" y="114" width="24" height="26" fill="${c.awningB}"/>
      <rect x="1054" y="98" width="26" height="28" fill="${night ? c.lit : c.ink}"/>

      <!-- Two rooftop Dud Shemesh solar heaters -->
      <rect x="802" y="97" width="10" height="17" fill="${c.awningB}"/>
      <path d="M814 100 L828 114 L823 115 L810 101 Z" fill="${c.ink}"/>
      <rect x="1024" y="62" width="10" height="18" fill="${c.awningB}"/>
      <path d="M1036 65 L1050 80 L1045 81 L1032 66 Z" fill="${c.ink}"/>

      <!-- Misregistered plate under market canopy -->
      <g transform="translate(-3, -2)">
        <path d="M642 186 L748 152 L1180 140 L1180 194 L642 198 Z" fill="${c.awningB}"/>
      </g>

      <!-- Long striped Shuk awnings -->
      <path d="M640 186 L696 158 L742 157 L688 187 Z" fill="${c.awningA}"/>
      <path d="M688 187 L742 157 L790 155 L740 188 Z" fill="${c.awningB}"/>
      <path d="M740 188 L790 155 L842 153 L796 189 Z" fill="${c.teal}"/>
      <path d="M796 189 L842 153 L896 151 L854 190 Z" fill="${c.awningA}"/>
      <path d="M854 190 L896 151 L952 149 L914 191 Z" fill="${c.awningB}"/>
      <path d="M914 191 L952 149 L1012 146 L978 192 Z" fill="${c.teal}"/>
      <path d="M978 192 L1012 146 L1082 143 L1054 192 Z" fill="${c.awningA}"/>
      <path d="M1054 192 L1082 143 L1180 140 L1180 193 Z" fill="${c.awningB}"/>
      <path d="M640 186 L1180 192 L1180 199 L640 193 Z" fill="${c.ink}"/>

      ${night ? `
        <circle cx="705" cy="200" r="3.8" fill="${c.lit}"/>
        <circle cx="785" cy="201" r="3.8" fill="${c.lit}"/>
        <circle cx="870" cy="202" r="3.8" fill="${c.lit}"/>
        <circle cx="960" cy="203" r="3.8" fill="${c.lit}"/>
        <circle cx="1055" cy="203" r="3.8" fill="${c.lit}"/>
      ` : ''}

      <!-- Stacked produce crates & hanging brass scale -->
      <path d="M822 198 L822 214 M814 214 L830 214 L826 220 L818 220 Z" fill="${c.crate}" stroke="${c.ink}" stroke-width="1.6"/>
      <path d="M694 224 L718 210 L744 212 L760 225 Z" fill="${c.awningA}"/>
      <path d="M774 222 L802 208 L830 210 L846 223 Z" fill="${c.fruit}"/>
      <path d="M864 220 L896 206 L928 208 L944 222 Z" fill="${c.teal}"/>
      <path d="M962 218 L998 204 L1036 206 L1054 220 Z" fill="${c.awningA}"/>

      <rect x="686" y="222" width="76" height="24" fill="${c.crate}" stroke="${c.ink}" stroke-width="1.8"/>
      <path d="M686 230 L762 230 M686 238 L762 238" stroke="${c.ink}" stroke-width="1.4"/>
      <rect x="770" y="220" width="80" height="26" fill="${c.crate}" stroke="${c.ink}" stroke-width="1.8"/>
      <path d="M770 229 L850 229 M770 237 L850 237" stroke="${c.ink}" stroke-width="1.4"/>
      <rect x="858" y="218" width="90" height="28" fill="${c.crate}" stroke="${c.ink}" stroke-width="1.8"/>
      <path d="M858 228 L948 228" stroke="${c.ink}" stroke-width="1.5"/>
      <rect x="956" y="216" width="108" height="28" fill="${c.crate}" stroke="${c.ink}" stroke-width="1.8"/>
      <path d="M956 226 L1064 226" stroke="${c.ink}" stroke-width="1.5"/>
    </g>

    <g filter="url(#linocut)">
      <!-- Concrete utility pole & tangled Shuk wires -->
      <path d="M708 62 L716 62 L720 162 L710 162 Z" fill="${c.ink}"/>
      <path d="M698 72 L726 72 M700 84 L724 84" stroke="${c.ink}" stroke-width="2.4"/>
      <path d="M560 88 Q638 102 712 72 Q890 104 1180 62" fill="none" stroke="${c.ink}" stroke-width="1.7"/>
      <path d="M714 84 Q910 118 1180 84" fill="none" stroke="${c.ink}" stroke-width="1.4"/>

      <path d="M664 192 L664 252 M854 194 L854 248 M1076 195 L1076 246" stroke="${c.ink}" stroke-width="2.6"/>
      <path d="M1118 52 L1180 46 L1180 256 L1106 256 Z" fill="${c.ink}"/>

      <path d="M490 258 L690 240 L1020 228 L1180 222 L1180 300 L0 300 L0 274 Z" fill="${c.ink}"/>
      <path d="M0 270 L550 256 L895 240 L1180 234 L1180 300 L0 300 Z" fill="${c.sheet}"/>
    </g>
  </svg>`;
}

/* --------------------------------------------------------------------------
   5. LOGIN — Habima Colonnade, Boulevard Espresso/Gazoz Kiosk & Sycamore
   Accent: Mediterranean Dusk Slate (#466878 day / #385563 night)
   -------------------------------------------------------------------------- */
function svgLogin(mode, size) {
  const night = mode === 'night';
  const c = night ? {
    glass: '#385563',
    pillar: '#D8C8B4',
    pillarShade: '#5C4433',
    roof: '#3C2B20',
    kiosk: '#C95A2B',
    lit: '#EEA83B',
    ink: '#121714',
    sheet: '#1A1613'
  } : {
    glass: '#466878',
    pillar: '#F8F3EA',
    pillarShade: '#B5481C',
    roof: '#8A3311',
    kiosk: '#D2602F',
    lit: '#D8903E',
    ink: '#1B2620',
    sheet: '#F8F3EA'
  };

  if (size === 'phone') {
    return `<svg viewBox="0 0 390 300" preserveAspectRatio="none" aria-hidden="true">
      <g filter="url(#gouache)">
        <!-- Habima Theatre modernist glass hall & overhanging roof slab -->
        <path d="M222 222 L224 114 L390 108 L390 224 Z" fill="${c.glass}"/>
        ${night ? `
          <rect x="240" y="132" width="32" height="72" fill="${c.lit}"/>
          <rect x="288" y="130" width="34" height="74" fill="${c.lit}"/>
        ` : ''}

        <!-- Misregistered cream roof fascia -->
        <g transform="translate(-2.2, -1.8)">
          <path d="M210 104 L390 98 L390 114 L210 118 Z" fill="${c.pillar}"/>
        </g>
        <path d="M210 106 L390 100 L390 116 L210 120 Z" fill="${c.roof}"/>

        <!-- Iconic tall Habima colonnade columns -->
        <path d="M228 118 L236 118 L236 222 L228 222 Z" fill="${c.pillar}"/>
        <path d="M236 118 L240 118 L240 222 L236 222 Z" fill="${c.pillarShade}"/>

        <path d="M258 117 L266 117 L266 222 L258 222 Z" fill="${c.pillar}"/>
        <path d="M266 117 L270 117 L270 222 L266 222 Z" fill="${c.pillarShade}"/>

        <path d="M288 116 L296 116 L296 222 L288 222 Z" fill="${c.pillar}"/>
        <path d="M296 116 L300 116 L300 222 L296 222 Z" fill="${c.pillarShade}"/>

        <path d="M318 115 L326 115 L326 222 L318 222 Z" fill="${c.pillar}"/>

        <!-- Historic hexagonal Tel Aviv Boulevard Gazoz / Espresso Kiosk in right foreground -->
        <path d="M332 232 L334 166 L378 165 L380 232 Z" fill="${c.kiosk}"/>
        <path d="M324 167 L356 148 L388 166 Z" fill="${c.pillar}"/>
        <path d="M324 167 L388 166 L388 172 L324 173 Z" fill="${c.ink}"/>
        <rect x="342" y="176" width="26" height="22" fill="${night ? c.lit : c.ink}"/>
        <path d="M338 198 L372 198 L372 203 L338 203 Z" fill="${c.pillar}"/>
      </g>

      <!-- Two tiny boulevard walkers + long cast shadows + sycamore canopy -->
      <g filter="url(#linocut)">
        <!-- Walker silhouettes welcoming user on plaza -->
        <circle cx="206" cy="214" r="3.4" fill="${c.ink}"/>
        <path d="M206 218 L203 234 L199 245 M205 229 L211 244" stroke="${c.ink}" stroke-width="2.4" stroke-linecap="round"/>
        <circle cx="219" cy="216" r="3.1" fill="${c.ink}"/>
        <path d="M219 220 L217 234 L214 245 M218 230 L223 244" stroke="${c.ink}" stroke-width="2.2" stroke-linecap="round"/>

        <!-- Sycamore bough framing upper-right corner -->
        <path d="M336 46 L368 36 L390 40 L390 88 L358 82 L338 64 Z" fill="${c.ink}"/>
        <path d="M366 80 L390 76 L390 108 L374 102 Z" fill="${c.ink}"/>

        <!-- Sunken plaza steps & smooth sheet melt -->
        <path d="M148 256 L224 238 L390 226 L390 300 L0 300 L0 274 Z" fill="${c.ink}"/>
        <path d="M0 270 L176 256 L302 240 L390 236 L390 300 L0 300 Z" fill="${c.sheet}"/>
      </g>
    </svg>`;
  }

  /* Desktop 1180x300 Habima Square, Sunken Pergola & Boulevard Kiosk */
  return `<svg viewBox="0 0 1180 300" preserveAspectRatio="none" aria-hidden="true">
    <g filter="url(#gouache)">
      <!-- Sunken garden pergola frame on mid-right -->
      <path d="M648 228 L650 168 L748 166 L748 174 L656 176 L656 228 Z" fill="${c.roof}"/>
      <path d="M698 174 L704 174 L704 228 L698 228 Z" fill="${c.roof}"/>

      <!-- Wide Habima colonnade & glass auditorium -->
      <path d="M758 228 L760 102 L1068 96 L1070 228 Z" fill="${c.glass}"/>
      ${night ? `
        <rect x="786" y="122" width="54" height="86" fill="${c.lit}"/>
        <rect x="864" y="120" width="58" height="88" fill="${c.lit}"/>
        <rect x="946" y="118" width="54" height="90" fill="${c.lit}"/>
      ` : ''}

      <g transform="translate(-3, -2)">
        <path d="M740 90 L1086 84 L1086 102 L740 106 Z" fill="${c.pillar}"/>
      </g>
      <path d="M740 92 L1086 86 L1086 104 L740 108 Z" fill="${c.roof}"/>

      <!-- Tall limestone colonnade pillars -->
      ${[768, 812, 856, 900, 944, 988, 1032].map(x => `
        <path d="M${x} 106 L${x+10} 106 L${x+10} 228 L${x} 228 Z" fill="${c.pillar}"/>
        <path d="M${x+10} 106 L${x+15} 106 L${x+15} 228 L${x+10} 228 Z" fill="${c.pillarShade}"/>
      `).join('')}

      <!-- Classic Tel Aviv Boulevard Kiosk -->
      <path d="M1058 236 L1060 154 L1132 152 L1134 236 Z" fill="${c.kiosk}"/>
      <path d="M1046 155 L1096 130 L1146 154 Z" fill="${c.pillar}"/>
      <path d="M1046 155 L1146 154 L1146 161 L1046 162 Z" fill="${c.ink}"/>
      <rect x="1074" y="168" width="44" height="28" fill="${night ? c.lit : c.ink}"/>
      <path d="M1066 196 L1124 196 L1124 202 L1066 202 Z" fill="${c.pillar}"/>
    </g>

    <g filter="url(#linocut)">
      <!-- Walkers strolling across Habima Plaza -->
      <circle cx="676" cy="212" r="4" fill="${c.ink}"/>
      <path d="M676 217 L672 235 L667 248 M675 230 L682 247" stroke="${c.ink}" stroke-width="2.6" stroke-linecap="round"/>
      <circle cx="694" cy="215" r="3.6" fill="${c.ink}"/>
      <path d="M694 220 L691 236 L687 248 M693 231 L700 247" stroke="${c.ink}" stroke-width="2.4" stroke-linecap="round"/>

      <!-- Boulevard sycamore trunk & overhanging canopy on far right -->
      <path d="M1152 246 C1148 184, 1156 122, 1144 64 L1158 62 C1168 122, 1162 184, 1166 246 Z" fill="${c.ink}"/>
      <path d="M1082 42 L1138 24 L1180 28 L1180 94 L1124 88 L1086 66 Z" fill="${c.ink}"/>

      <path d="M480 258 L740 238 L1040 226 L1180 220 L1180 300 L0 300 L0 274 Z" fill="${c.ink}"/>
      <path d="M0 270 L550 256 L895 240 L1180 234 L1180 300 L0 300 Z" fill="${c.sheet}"/>
    </g>
  </svg>`;
}

/* ==========================================================================
   SCENE DEFINITIONS & BILINGUAL LEGIBILITY COPY
   ========================================================================== */
const SCENES = [
  {
    id: 'home',
    name: '1. Home — Jaffa Clock Tower, Harbour Boats & Promenade Palm',
    accentHex: '#4A6E5D',
    accentLabel: 'Verdigris Copper',
    render: svgHome,
    en: {
      chip: 'Habima · Tel Aviv',
      isHeroNum: true,
      num: '65',
      unit: 'min',
      sub: '4.1 km · Golden-hour walk to Jaffa Port',
      seam: 'Tonight’s suggested route · 4 stops'
    },
    he: {
      chip: 'הבימה · תל אביב',
      isHeroNum: true,
      num: '65',
      unit: 'דק׳',
      sub: '<bdi>4.1</bdi> ק״מ · הליכת שקיעה לנמל יפו',
      seam: 'המסלול המוצע להערב · <bdi>4</bdi> תחנות'
    }
  },
  {
    id: 'plan',
    name: '2. Plan — White City Bauhaus Balconies, Rolled Shutters & Bougainvillea',
    accentHex: '#B5344B',
    accentLabel: 'Bougainvillea Crimson',
    hasGuideZone: true,
    render: svgPlan,
    en: {
      chip: 'Habima · Tel Aviv',
      isHeroNum: false,
      title: 'Where shall we walk?',
      sub: 'AI walking companion · Israel',
      seam: 'Bottom-start 140×190 kept free for Guide cut-out'
    },
    he: {
      chip: 'הבימה · תל אביב',
      isHeroNum: false,
      title: 'לאן נצא ללכת?',
      sub: 'מלווה הליכה חכם · ישראל',
      seam: 'אזור 140×190 שמור לדמות המדריך'
    }
  },
  {
    id: 'walk',
    name: '3. Live Walk — Old Jaffa Stone Archway, Hanging Planters & Laundry Line',
    accentHex: '#5A6E47',
    accentLabel: 'Olive Clay',
    render: svgWalk,
    en: {
      chip: 'Stop 2 of 4 · 19:20',
      isHeroNum: true,
      num: '4',
      unit: 'min · 310 m',
      sub: 'Turn left onto Nahalat Binyamin',
      seam: 'Walk stops · 2.8 km left'
    },
    he: {
      chip: 'תחנה <bdi>2</bdi> מתוך <bdi>4</bdi> · <bdi>19:20</bdi>',
      isHeroNum: true,
      num: '4',
      unit: 'דק׳ · <bdi>310</bdi> מ׳',
      sub: 'פנו שמאלה אל נחלת בנימין',
      seam: 'תחנות המסלול · נותרו <bdi>2.8</bdi> ק״מ'
    }
  },
  {
    id: 'walks',
    name: '4. My Walks — Shuk HaCarmel Striped Awnings, Produce Crates & Wires',
    accentHex: '#38625E',
    accentLabel: 'Market Canvas Teal',
    render: svgWalks,
    en: {
      chip: 'Tel Aviv · Jaffa',
      isHeroNum: false,
      title: 'My walks & friends',
      sub: '12 walks · 48.4 km explored',
      seam: 'Saved (3) · Walked (8) · Friends'
    },
    he: {
      chip: 'תל אביב · יפו',
      isHeroNum: false,
      title: 'ההליכות שלי וחברים',
      sub: '<bdi>12</bdi> מסלולים · <bdi>48.4</bdi> ק״מ',
      seam: 'שמורים (<bdi>3</bdi>) · הושלמו (<bdi>8</bdi>) · חברים'
    }
  },
  {
    id: 'login',
    name: '5. Login — Habima Colonnade, Boulevard Espresso Kiosk & Walkers',
    accentHex: '#466878',
    accentLabel: 'Mediterranean Slate',
    render: svgLogin,
    en: {
      chip: 'Skip · Try first',
      isHeroNum: false,
      title: 'Sign in to Traike',
      sub: 'Save routes, live walks & favourite stops',
      seam: 'Email address & account'
    },
    he: {
      chip: 'דלגו · נסו קודם',
      isHeroNum: false,
      title: 'התחברות אל Traike',
      sub: 'שמירת מסלולים, ניווט חי ותחנות אהובות',
      seam: 'כתובת אימייל וחשבון'
    }
  }
];

let currentDir = 'ltr';

function buildHeaderCard(scene, mode, size) {
  const lang = currentDir === 'rtl' ? scene.he : scene.en;
  const w = size === 'phone' ? 390 : 1180;
  const headlineMarkup = lang.isHeroNum
    ? `<div class="hero-num"><bdi>${lang.num}</bdi><span class="hero-unit">${lang.unit}</span></div>`
    : `<div class="hero-title">${lang.title}</div>`;

  const guideZoneMarkup = scene.hasGuideZone
    ? `<div class="zone-guide zone-guide-char">Guide free zone<br>140 × 190</div>`
    : '';

  return `
    <div class="header-proof ${size} theme-${mode}" dir="${currentDir}">
      <div class="header-band">
        <div class="art-layer">
          ${scene.render(mode, size)}
        </div>
        ${paperOverlaySVG(w, 300)}

        <div class="zone-guide zone-text">Calm text zone (60% × 55%)</div>
        ${guideZoneMarkup}

        <div class="ui-overlay">
          <div class="top-row">
            <div class="brand-lockup">
              <svg class="brand-mark" width="24" height="24" aria-hidden="true">
                <use href="#icon-brand"/>
              </svg>
              <span>Traike</span>
            </div>
            <div class="loc-chip">
              <span class="now-ring" aria-hidden="true"></span>
              <span>${lang.chip}</span>
            </div>
          </div>
          <div class="copy-block">
            ${headlineMarkup}
            <div class="sub-line">${lang.sub}</div>
          </div>
        </div>
      </div>
      <div class="sheet-seam-proof">
        <span>${lang.seam}</span>
        <span>${mode === 'day' ? '#F8F3EA sheet melt' : '#1A1613 sheet melt'}</span>
      </div>
    </div>
  `;
}

function renderGallery() {
  const root = document.getElementById('gallery-root');
  root.innerHTML = SCENES.map(scene => `
    <section class="scene-section" id="scene-${scene.id}">
      <div class="scene-meta">
        <h2>${scene.name}</h2>
        <div class="palette-strip">
          <span class="swatch" style="background:#8A3311" title="Deep Rust #8A3311"></span>
          <span class="swatch" style="background:#D2602F" title="Leather #D2602F"></span>
          <span class="swatch" style="background:#D8903E" title="Amber #D8903E"></span>
          <span class="swatch" style="background:#F8F3EA" title="Cream #F8F3EA"></span>
          <span class="swatch" style="background:#1B2620" title="Pine Ink #1B2620"></span>
          <span class="swatch" style="background:${scene.accentHex}" title="${scene.accentLabel} ${scene.accentHex}"></span>
          <span>+ ${scene.accentLabel} (${scene.accentHex})</span>
        </div>
      </div>

      <div class="phone-pair">
        <div class="frame-col">
          <div class="frame-caption">Phone 390 × 300 · Day</div>
          ${buildHeaderCard(scene, 'day', 'phone')}
        </div>
        <div class="frame-col">
          <div class="frame-caption">Phone 390 × 300 · Night</div>
          ${buildHeaderCard(scene, 'night', 'phone')}
        </div>
      </div>

      <div class="desktop-stack">
        <div class="frame-col">
          <div class="frame-caption">Desktop 1180 × 300 · Day</div>
          ${buildHeaderCard(scene, 'day', 'desktop')}
        </div>
        <div class="frame-col">
          <div class="frame-caption">Desktop 1180 × 300 · Night</div>
          ${buildHeaderCard(scene, 'night', 'desktop')}
        </div>
      </div>
    </section>
  `).join('');
}

function setDir(dir) {
  currentDir = dir;
  document.getElementById('btn-ltr').classList.toggle('active', dir === 'ltr');
  document.getElementById('btn-rtl').classList.toggle('active', dir === 'rtl');
  renderGallery();
}

function toggleZones(show) {
  document.body.classList.toggle('show-zones', show);
  document.getElementById('btn-clean').classList.toggle('active', !show);
  document.getElementById('btn-zones').classList.toggle('active', show);
}

renderGallery();
</script>

<!--
  ============================================================================
  ROUND 10 SELF-CHECK
  ============================================================================
  - Does any picture still look like a smooth digital gradient scene?
    NO. Zero gradients exist on any illustrated shape (buildings, sea, arches,
    awnings, crates, trees, sun/moon, shutters, pillars). Every form is a 100%
    flat opaque gouache/linocut colour plate processed through feTurbulence +
    feDisplacementMap (#gouache and #linocut) for irregular hand-cut edges,
    paired with explicit 2–3px screen-print plate misregistration and a cold-
    press cotton paper tooth (#rag-tooth). Only the background sky and the
    bottom sheet-melt mask use smooth transitions.
  - Real Tel Aviv / Jaffa specificity:
    1. Home: Jaffa Ottoman Clock Tower with copper roof & clock hands, harbour
       boats, rooftop dud-shemesh solar boiler, gnarled coastal palm & wires.
    2. Plan: White City curved Bauhaus ribbon balconies, rolled wooden tris
       shutters, exterior AC condenser unit, crimson bougainvillea & ficus
       (with bottom-start 140x190 completely open for the Guide photo).
    3. Walk: Carved Old Jaffa kurkar stone archway with individual voussoirs,
       laundry line with shirts, wrought-iron street lantern & clay planters.
    4. Walks: Shuk HaCarmel striped canvas awnings, stacked slatted orange
       crates, hanging brass scale, concrete utility pole & tangled wires.
    5. Login: Habima Theatre tall colonnade, sunken pergola, hexagonal Tel Aviv
       boulevard espresso/gazoz kiosk, sycamore bough & strolling walkers.
  - Legibility, Melt & RTL:
    Top-start 60% x 55% stays calm sky in all 5 scenes; each 300px band is
    shown directly attached to a 32px strip of #F8F3EA (day) / #1A1613 (night)
    proving zero seam; RTL flips .art-layer via scaleX(-1) so the calm sky
    moves cleanly to the right behind Hebrew typography.
  ============================================================================
-->
</body>
</html>
```