<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Traike — Illustrated Header Suite (Day &amp; Night)</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@500;600;700&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: #DFD9CE;
    color: #1F1B18;
    font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    padding: 36px 24px 64px;
  }

  .page-header {
    max-width: 820px;
    margin: 0 auto 32px;
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    border-bottom: 1px solid rgba(31,27,24,0.14);
    padding-bottom: 14px;
  }

  .page-header h1 {
    font-family: 'Fraunces', Georgia, serif;
    font-size: 22px;
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  .page-header span {
    font-size: 13px;
    color: #635B52;
  }

  .grid {
    max-width: 820px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: repeat(2, 390px);
    gap: 28px 40px;
    justify-content: center;
  }

  @media (max-width: 850px) {
    .grid { grid-template-columns: 390px; }
  }

  .card-wrap {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .card-label {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #5C5349;
    padding: 0 2px;
  }

  /* Exact 390x300 viewport + tiny cream sheet continuation to verify the melt */
  .phone-frame {
    width: 390px;
    background: #F3EFE6;
    border-radius: 22px;
    overflow: hidden;
    box-shadow: 0 14px 34px rgba(38, 24, 14, 0.16), 0 0 0 1px rgba(31, 27, 24, 0.12);
  }

  .hero-box {
    position: relative;
    width: 390px;
    height: 300px;
    overflow: hidden;
    background: #F3EFE6;
  }

  .hero-box svg {
    display: block;
    width: 390px;
    height: 300px;
  }

  .overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
  }

  .top-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .brand {
    font-family: 'Fraunces', Georgia, serif;
    color: #FFFDF9;
    font-size: 16px;
    font-weight: 700;
    letter-spacing: -0.01em;
    text-shadow: 0 1px 8px rgba(45, 16, 6, 0.35);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .pill {
    background: #F5F1E8;
    color: #1F1B18;
    font-size: 11px;
    font-weight: 600;
    padding: 5px 10px;
    border-radius: 99px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.14);
  }

  .copy {
    margin-top: 28px;
    color: #FFFDF9;
    text-shadow: 0 2px 14px rgba(42, 14, 5, 0.42);
  }

  .copy h2 {
    font-family: 'Fraunces', Georgia, serif;
    font-size: 27px;
    line-height: 1.08;
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  .copy .big-num {
    font-family: 'Fraunces', Georgia, serif;
    font-size: 52px;
    line-height: 0.95;
    font-weight: 600;
    letter-spacing: -0.03em;
  }

  .copy .big-num small {
    font-size: 19px;
    font-weight: 600;
    margin-left: 3px;
  }

  .copy p {
    margin-top: 6px;
    font-size: 12.5px;
    font-weight: 500;
    color: rgba(255, 250, 242, 0.94);
    max-width: 215px;
    line-height: 1.35;
  }

  .copy.centered {
    margin-top: auto;
    margin-bottom: 58px;
    text-align: center;
    align-items: center;
  }

  .copy.centered h2 {
    font-size: 23px;
  }

  .copy.walk-turn {
    margin-top: 34px;
  }

  .sheet-stub {
    height: 26px;
    background: #F3EFE6;
    padding: 0 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 10.5px;
    color: #7D7367;
    border-top: 1px solid rgba(31,27,24,0.06);
  }
</style>
</head>
<body>

<!-- Shared SVG Definitions (Gouache Texture & Botanicals) -->
<svg width="0" height="0" style="position:absolute">
  <defs>
    <!-- Subtle warm cotton-paper watercolor tooth -->
    <filter id="gouache-paper" x="0%" y="0%" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" seed="11" result="noise"/>
      <feColorMatrix type="matrix" values="
        0 0 0 0 0.95
        0 0 0 0 0.85
        0 0 0 0 0.72
        0 0 0 0.045 0" in="noise" result="warmGrain"/>
      <feComposite in="warmGrain" in2="SourceGraphic" operator="atop"/>
    </filter>

    <!-- Soft warm glow for lanterns and windows -->
    <radialGradient id="lantern-halo-day" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FFF4CC" stop-opacity="0.75"/>
      <stop offset="55%" stop-color="#F7A94B" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#E87A2E" stop-opacity="0"/>
    </radialGradient>

    <radialGradient id="lantern-halo-night" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FFE9A6" stop-opacity="0.92"/>
      <stop offset="40%" stop-color="#F59B3D" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#9E3F22" stop-opacity="0"/>
    </radialGradient>

    <!-- Day Sky Gradient -->
    <linearGradient id="sky-day" x1="0" y1="0" x2="0.15" y2="1">
      <stop offset="0%" stop-color="#8A2B0E"/>
      <stop offset="34%" stop-color="#BD451A"/>
      <stop offset="65%" stop-color="#E5843C"/>
      <stop offset="86%" stop-color="#F4C386"/>
      <stop offset="100%" stop-color="#F3EFE6"/>
    </linearGradient>

    <!-- Night Sky Gradient (Mediterranean Indigo-Plum to Warm Amber Lantern Mist to Cream Sheet) -->
    <linearGradient id="sky-night" x1="0" y1="0" x2="0.1" y2="1">
      <stop offset="0%" stop-color="#19162B"/>
      <stop offset="35%" stop-color="#33223D"/>
      <stop offset="64%" stop-color="#75362E"/>
      <stop offset="85%" stop-color="#C97F53"/>
      <stop offset="100%" stop-color="#F3EFE6"/>
    </linearGradient>

    <!-- Bottom Cream Sheet Melt Overlay -->
    <linearGradient id="cream-melt-day" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#F3EFE6" stop-opacity="0"/>
      <stop offset="48%" stop-color="#F3EFE6" stop-opacity="0.58"/>
      <stop offset="82%" stop-color="#F3EFE6" stop-opacity="0.94"/>
      <stop offset="100%" stop-color="#F3EFE6" stop-opacity="1"/>
    </linearGradient>

    <linearGradient id="cream-melt-night" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#D99B72" stop-opacity="0"/>
      <stop offset="42%" stop-color="#E7C2A3" stop-opacity="0.55"/>
      <stop offset="78%" stop-color="#F3EFE6" stop-opacity="0.93"/>
      <stop offset="100%" stop-color="#F3EFE6" stop-opacity="1"/>
    </linearGradient>

    <!-- Top-left readability veil -->
    <radialGradient id="text-guard-day" cx="18%" cy="22%" r="62%">
      <stop offset="0%" stop-color="#6E1E07" stop-opacity="0.46"/>
      <stop offset="65%" stop-color="#8F2E10" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#8F2E10" stop-opacity="0"/>
    </radialGradient>

    <radialGradient id="text-guard-night" cx="18%" cy="22%" r="62%">
      <stop offset="0%" stop-color="#110E20" stop-opacity="0.58"/>
      <stop offset="65%" stop-color="#1D1730" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#1D1730" stop-opacity="0"/>
    </radialGradient>

    <!-- Hand-drawn organic Bougainvillea Bract Cluster (NOT circles) -->
    <g id="bougainvillea-spray">
      <path d="M0,0 C8,-6 18,-4 23,2 C17,8 9,9 0,0 Z" fill="#C92A49"/>
      <path d="M12,-5 C21,-13 31,-9 35,-1 C26,5 17,4 12,-5 Z" fill="#E34B68"/>
      <path d="M-9,4 C-2,-4 8,-2 12,6 C4,12 -5,11 -9,4 Z" fill="#A61C38"/>
      <path d="M18,5 C26,0 36,3 39,11 C30,15 21,13 18,5 Z" fill="#C92A49"/>
      <path d="M4,9 C12,5 21,8 24,16 C15,19 7,17 4,9 Z" fill="#EB657E"/>
      <path d="M27,-4 C34,-10 43,-7 46,0 C39,5 31,3 27,-4 Z" fill="#F07D92"/>
      <!-- Tiny cream paper-flower stamens -->
      <path d="M14,2 L16,0 M28,6 L30,5 M8,11 L10,11" stroke="#FFF3D6" stroke-width="1.3" stroke-linecap="round"/>
    </g>

    <g id="bougainvillea-spray-night">
      <path d="M0,0 C8,-6 18,-4 23,2 C17,8 9,9 0,0 Z" fill="#7D1D3B"/>
      <path d="M12,-5 C21,-13 31,-9 35,-1 C26,5 17,4 12,-5 Z" fill="#9E2B4E"/>
      <path d="M-9,4 C-2,-4 8,-2 12,6 C4,12 -5,11 -9,4 Z" fill="#59122A"/>
      <path d="M18,5 C26,0 36,3 39,11 C30,15 21,13 18,5 Z" fill="#852040"/>
      <path d="M4,9 C12,5 21,8 24,16 C15,19 7,17 4,9 Z" fill="#B84062"/>
      <path d="M14,2 L16,0 M28,6 L30,5" stroke="#FFDFA6" stroke-width="1.1" stroke-linecap="round" opacity="0.7"/>
    </g>

    <!-- Date Palm Crown -->
    <g id="palm-crown-day">
      <path d="M0,0 C-14,-12 -34,-14 -48,-4 C-32,-5 -15,-2 0,3 Z" fill="#3B4229"/>
      <path d="M0,0 C-10,-19 -28,-27 -44,-23 C-27,-19 -12,-10 0,2 Z" fill="#4B5433"/>
      <path d="M0,0 C-2,-22 -12,-36 -25,-40 C-12,-30 -4,-15 1,1 Z" fill="#5D663E"/>
      <path d="M0,0 C10,-22 26,-33 43,-31 C27,-24 12,-12 0,2 Z" fill="#4E5735"/>
      <path d="M0,0 C18,-15 39,-16 54,-5 C36,-7 18,-4 0,3 Z" fill="#363D25"/>
      <path d="M0,0 C16,-4 33,3 42,15 C28,8 14,4 0,3 Z" fill="#2D331F"/>
      <path d="M0,0 C-15,-2 -30,6 -38,18 C-25,10 -12,5 0,3 Z" fill="#2D331F"/>
    </g>

    <g id="palm-crown-night">
      <path d="M0,0 C-14,-12 -34,-14 -48,-4 C-32,-5 -15,-2 0,3 Z" fill="#1D2026"/>
      <path d="M0,0 C-10,-19 -28,-27 -44,-23 C-27,-19 -12,-10 0,2 Z" fill="#252930"/>
      <path d="M0,0 C-2,-22 -12,-36 -25,-40 C-12,-30 -4,-15 1,1 Z" fill="#2F333B"/>
      <path d="M0,0 C10,-22 26,-33 43,-31 C27,-24 12,-12 0,2 Z" fill="#252930"/>
      <path d="M0,0 C18,-15 39,-16 54,-5 C36,-7 18,-4 0,3 Z" fill="#1A1C22"/>
      <path d="M0,0 C16,-4 33,3 42,15 C28,8 14,4 0,3 Z" fill="#16181D"/>
      <path d="M0,0 C-15,-2 -30,6 -38,18 C-25,10 -12,5 0,3 Z" fill="#16181D"/>
    </g>

    <!-- Swift / Mediterranean Bird -->
    <path id="swift" d="M0,0 C4,-4 9,-4 12,0 C15,-4 20,-4 24,0 C19,-1 15,0 12,3 C9,0 5,-1 0,0 Z"/>
  </defs>
</svg>

<header class="page-header">
  <h1>Traike — Tel Aviv &amp; Jaffa Illustrated Headers</h1>
  <span>390 × 300 px · Day &amp; Night Family</span>
</header>

<main class="grid">

  <!-- =========================================================
       1A. HOME — DAY (Old Jaffa Port, St. Peter's Spire & Arch)
       ========================================================= -->
  <div class="card-wrap">
    <div class="card-label"><span>01 · Home</span><span>Day · Golden Hour</span></div>
    <div class="phone-frame">
      <div class="hero-box">
        <svg viewBox="0 0 390 300" width="390" height="300" xmlns="http://www.w3.org/2000/svg">
          <rect width="390" height="300" fill="url(#sky-day)"/>

          <!-- Soft brushed clouds -->
          <path d="M40,148 C95,140 165,142 230,150 C185,156 95,156 40,148 Z" fill="#F7C98B" opacity="0.28"/>
          <path d="M150,112 C210,104 285,106 340,114 C290,119 205,118 150,112 Z" fill="#F2A65A" opacity="0.24"/>

          <!-- Setting Mediterranean Sun & Halo -->
          <circle cx="132" cy="184" r="46" fill="#FFE6A3" opacity="0.26"/>
          <circle cx="132" cy="186" r="23" fill="#FFF0BD" opacity="0.88"/>

          <!-- Distant Mediterranean Sea -->
          <path d="M0,192 L265,192 L265,258 L0,258 Z" fill="#D97B38" opacity="0.65"/>
          <path d="M0,192 C75,190 155,191 245,193 L245,232 L0,232 Z" fill="#E89A54" opacity="0.55"/>

          <!-- Sun Shimmer Paths on Water -->
          <g fill="#FFF3C4" opacity="0.78">
            <path d="M106,196 C124,195 144,195 158,196 C146,199 120,199 106,196 Z"/>
            <path d="M113,203 C128,202 142,202 152,203 C140,206 123,206 113,203 Z"/>
            <path d="M102,211 C122,210 146,210 163,212 C145,214 120,214 102,211 Z"/>
            <path d="M118,220 C130,219 143,219 151,221 C141,223 127,223 118,220 Z"/>
          </g>

          <!-- Old Jaffa Breakwater Reef -->
          <path d="M34,214 C62,211 92,212 114,215 L106,218 L30,217 Z" fill="#7A3319" opacity="0.7"/>

          <!-- Small Lateen Sailboat off Jaffa Port -->
          <g transform="translate(72, 203)">
            <path d="M0,6 L22,6 L18,10 L4,10 Z" fill="#592312"/>
            <path d="M11,6 L11,-11 L21,4 Z" fill="#FFF0CC" opacity="0.92"/>
            <path d="M10,6 L10,-8 L2,5 Z" fill="#F2C185" opacity="0.82"/>
          </g>

          <!-- Old Jaffa Stepped Kurkar Hill & Architecture -->
          <path d="M168,218 L184,188 L208,186 L216,168 L254,166 L278,144 L348,146 L390,160 L390,255 L155,255 Z" fill="#9E421E"/>

          <!-- St. Peter's Church Bell Tower (Iconic Jaffa silhouette + sunlit limestone face) -->
          <g transform="translate(268, 86)">
            <!-- Sunlit west facade -->
            <rect x="0" y="28" width="13" height="58" fill="#F5CA8C"/>
            <!-- Shaded east facade -->
            <rect x="13" y="28" width="11" height="58" fill="#8C3718"/>
            <!-- Belfry cornice -->
            <rect x="-2" y="26" width="28" height="3" fill="#FADBA8"/>
            <rect x="-2" y="48" width="28" height="2.5" fill="#FADBA8"/>
            <!-- Arched belfry windows -->
            <path d="M4,33 A3,3 0 0,1 10,33 L10,44 L4,44 Z" fill="#59200E"/>
            <path d="M16,33 A2.5,2.5 0 0,1 21,33 L21,44 L16,44 Z" fill="#47180A"/>
            <!-- Pointed Baroque-Franciscan Spire -->
            <path d="M0,26 L12,2 L13,26 Z" fill="#F7D59C"/>
            <path d="M12,2 L24,26 L13,26 Z" fill="#782B11"/>
            <path d="M12,-4 L12,3 M9.5,-1 L14.5,-1" stroke="#59200E" stroke-width="1.3" stroke-linecap="round"/>
          </g>

          <!-- Mahmoudiya Dome & Cascading Jaffa Limestone Houses -->
          <path d="M233,166 C233,154 249,154 249,166 Z" fill="#F2BE7E"/>
          <path d="M241,154 C246,154 249,159 249,166 L241,166 Z" fill="#8C3718"/>

          <!-- Sunlit West Walls of Jaffa Houses -->
          <g>
            <!-- House block 1 -->
            <rect x="212" y="168" width="18" height="24" fill="#F4C789"/>
            <rect x="230" y="168" width="16" height="24" fill="#853316"/>
            <!-- House block 2 -->
            <rect x="248" y="160" width="22" height="28" fill="#F7D399"/>
            <rect x="270" y="160" width="18" height="28" fill="#7D2E13"/>
            <!-- Lower port warehouses -->
            <rect x="182" y="188" width="26" height="22" fill="#EBB475"/>
            <rect x="208" y="188" width="24" height="22" fill="#7A2D13"/>
            <rect x="236" y="182" width="32" height="26" fill="#F2C385"/>
            <rect x="268" y="182" width="26" height="26" fill="#6E260E"/>
            <!-- Tiny arched windows -->
            <path d="M254,167 A2.5,2.5 0 0,1 259,167 L259,174 L254,174 Z" fill="#5E210D"/>
            <path d="M262,167 A2.5,2.5 0 0,1 267,167 L267,174 L262,174 Z" fill="#5E210D"/>
            <path d="M190,195 A3,3 0 0,1 196,195 L196,204 L190,204 Z" fill="#5E210D"/>
            <path d="M200,195 A3,3 0 0,1 206,195 L206,204 L200,204 Z" fill="#5E210D"/>
            <path d="M245,190 A3,3 0 0,1 251,190 L251,199 L245,199 Z" fill="#5E210D"/>
            <path d="M256,190 A3,3 0 0,1 262,190 L262,199 L256,199 Z" fill="#5E210D"/>
          </g>

          <!-- Harbor Sea Wall & Promenade Curve -->
          <path d="M142,222 C195,216 260,212 340,214 L340,234 L135,230 Z" fill="#D99457"/>
          <path d="M142,222 C195,216 260,212 340,214" stroke="#FFE3B0" stroke-width="1.4" fill="none" opacity="0.75"/>

          <!-- Slender Cypresses & Date Palm on the Bluff -->
          <path d="M302,178 C303,152 306,136 308,126 C310,136 313,152 314,178 Z" fill="#363F27"/>
          <path d="M316,182 C317,160 319,147 321,139 C323,147 325,160 326,182 Z" fill="#2B331F"/>
          <path d="M332,195 Q328,158 323,130" stroke="#4A2512" stroke-width="3.2" fill="none"/>
          <use href="#palm-crown-day" transform="translate(323,130) scale(0.72)"/>

          <!-- Foreground Right Kurkar Limestone Archway Framing the View -->
          <path d="M286,0 L390,0 L390,290 L352,290 L352,126 C352,66 320,24 286,0 Z" fill="#63230E"/>
          <!-- Sunlit inner archchamfer (warm limestone blocks) -->
          <path d="M286,0 C320,24 352,66 352,126 L352,275 L361,275 L361,124 C361,60 328,18 296,0 Z" fill="#E8A968"/>
          <!-- Individual stone voussoir joints on arch -->
          <g stroke="#7A2E14" stroke-width="1" opacity="0.55">
            <line x1="316" y1="24" x2="324" y2="18"/>
            <line x1="333" y1="48" x2="342" y2="43"/>
            <line x1="345" y1="76" x2="355" y2="73"/>
            <line x1="351" y1="106" x2="361" y2="105"/>
            <line x1="352" y1="138" x2="361" y2="138"/>
            <line x1="352" y1="170" x2="361" y2="170"/>
          </g>

          <!-- Foreground Winding Promenade Parapet Leading Toward Jaffa -->
          <path d="M0,256 C95,244 215,232 390,224 L390,300 L0,300 Z" fill="#C9854B"/>
          <path d="M0,256 C95,244 215,232 360,225" stroke="#FCE2B6" stroke-width="2" fill="none" opacity="0.8"/>

          <!-- Cascading Bougainvillea & Olive Twigs from Foreground Arch -->
          <path d="M295,6 C310,26 328,34 348,42" stroke="#3D2616" stroke-width="2" fill="none"/>
          <use href="#bougainvillea-spray" transform="translate(302, 12) rotate(18) scale(0.95)"/>
          <use href="#bougainvillea-spray" transform="translate(334, 34) rotate(35) scale(0.85)"/>
          <use href="#bougainvillea-spray" transform="translate(344, 68) rotate(65) scale(0.75)"/>

          <!-- Two wheeling swifts -->
          <use href="#swift" transform="translate(212, 92) scale(0.55) rotate(-8)" fill="#591E0B" opacity="0.75"/>
          <use href="#swift" transform="translate(232, 82) scale(0.42) rotate(6)" fill="#591E0B" opacity="0.65"/>

          <!-- Readability & Cream Sheet Melt -->
          <rect width="390" height="220" fill="url(#text-guard-day)"/>
          <rect y="222" width="390" height="78" fill="url(#cream-melt-day)"/>
          <rect width="390" height="300" filter="url(#gouache-paper)" opacity="0.7"/>
        </svg>

        <div class="overlay">
          <div class="top-bar">
            <div class="brand">🗝 Traike</div>
            <div class="pill">◎ Habima · Tel Aviv</div>
          </div>
          <div class="copy">
            <div class="big-num">65<small>min</small></div>
            <p>4.1 km · 4 stops<br>Golden-hour walk to Jaffa Port</p>
          </div>
        </div>
      </div>
      <div class="sheet-stub"><span>Tonight’s suggested route</span><span>120 m away</span></div>
    </div>
  </div>

  <!-- =========================================================
       1B. HOME — NIGHT (Old Jaffa Port by Crescent Moon & Harbor Glow)
       ========================================================= -->
  <div class="card-wrap">
    <div class="card-label"><span>01 · Home</span><span>Night · Harbor Lights</span></div>
    <div class="phone-frame">
      <div class="hero-box">
        <svg viewBox="0 0 390 300" width="390" height="300" xmlns="http://www.w3.org/2000/svg">
          <rect width="390" height="300" fill="url(#sky-night)"/>

          <!-- Crisp Stars & Crescent Moon -->
          <g fill="#FFF2CC">
            <circle cx="155" cy="52" r="1.1" opacity="0.8"/>
            <circle cx="204" cy="38" r="1.3" opacity="0.9"/>
            <circle cx="248" cy="64" r="1" opacity="0.65"/>
            <circle cx="118" cy="84" r="0.9" opacity="0.55"/>
            <circle cx="295" cy="46" r="1.1" opacity="0.75"/>
          </g>
          <!-- Crescent Moon -->
          <path d="M194,76 A14,14 0 1,1 180,94 A11,11 0 1,0 194,76 Z" fill="#FFEBB8"/>

          <!-- Night Mediterranean Sea -->
          <path d="M0,192 L265,192 L265,258 L0,258 Z" fill="#2A2038" opacity="0.85"/>

          <!-- Golden Harbor & Moon Reflections on Water -->
          <g fill="#FFCF7D" opacity="0.68">
            <path d="M174,197 C185,196 198,196 208,197 C198,199 183,199 174,197 Z"/>
            <path d="M168,205 C188,204 214,204 232,206 C212,208 185,208 168,205 Z"/>
            <path d="M182,213 C202,212 226,212 242,214 C224,216 198,216 182,213 Z"/>
            <path d="M112,202 C124,201 136,201 144,202 C135,204 121,204 112,202 Z"/>
          </g>

          <!-- Fishing Boat with Warm Mast Lantern -->
          <g transform="translate(92, 204)">
            <path d="M0,6 L22,6 L18,10 L4,10 Z" fill="#181322"/>
            <line x1="11" y1="6" x2="11" y2="-8" stroke="#2D2338" stroke-width="1.3"/>
            <circle cx="11" cy="-6" r="5" fill="url(#lantern-halo-night)"/>
            <circle cx="11" cy="-6" r="1.6" fill="#FFEAA6"/>
          </g>

          <!-- Old Jaffa Night Hill Silhouette -->
          <path d="M168,218 L184,188 L208,186 L216,168 L254,166 L278,144 L348,146 L390,160 L390,255 L155,255 Z" fill="#261B2E"/>

          <!-- Warm Uplight Glow on St. Peter's Spire -->
          <circle cx="280" cy="138" r="48" fill="url(#lantern-halo-night)" opacity="0.55"/>
          <g transform="translate(268, 86)">
            <rect x="0" y="28" width="13" height="58" fill="#9E6242"/>
            <rect x="13" y="28" width="11" height="58" fill="#2A1D33"/>
            <rect x="-2" y="26" width="28" height="3" fill="#C48156"/>
            <rect x="-2" y="48" width="28" height="2.5" fill="#C48156"/>
            <!-- Lit belfry arch -->
            <path d="M4,33 A3,3 0 0,1 10,33 L10,44 L4,44 Z" fill="#FFD984"/>
            <path d="M16,33 A2.5,2.5 0 0,1 21,33 L21,44 L16,44 Z" fill="#C78A44"/>
            <path d="M0,26 L12,2 L13,26 Z" fill="#B5734E"/>
            <path d="M12,2 L24,26 L13,26 Z" fill="#24182B"/>
            <path d="M12,-4 L12,3 M9.5,-1 L14.5,-1" stroke="#8C5940" stroke-width="1.3" stroke-linecap="round"/>
          </g>

          <!-- Ottoman Dome & Houses with Glowing Amber Windows -->
          <path d="M233,166 C233,154 249,154 249,166 Z" fill="#6E443B"/>
          <g>
            <rect x="212" y="168" width="18" height="24" fill="#4A2E38"/>
            <rect x="230" y="168" width="16" height="24" fill="#24182B"/>
            <rect x="248" y="160" width="22" height="28" fill="#59363D"/>
            <rect x="182" y="188" width="26" height="22" fill="#472D38"/>
            <rect x="236" y="182" width="32" height="26" fill="#52333B"/>
            <!-- Warm glowing Jaffa windows -->
            <g fill="#FFE08C">
              <rect x="218" y="174" width="4" height="6" rx="2"/>
              <rect x="254" y="167" width="4.5" height="7" rx="2.2"/>
              <rect x="262" y="167" width="4.5" height="7" rx="2.2"/>
              <rect x="191" y="195" width="5" height="7" rx="2.5"/>
              <rect x="246" y="190" width="5" height="8" rx="2.5"/>
              <rect x="257" y="190" width="5" height="8" rx="2.5"/>
            </g>
          </g>

          <!-- Harbor Quay Lanterns -->
          <path d="M142,222 C195,216 260,212 340,214 L340,234 L135,230 Z" fill="#4A2F35"/>
          <g fill="#FFE499">
            <circle cx="176" cy="218" r="1.8"/>
            <circle cx="204" cy="216" r="1.8"/>
            <circle cx="234" cy="214" r="1.8"/>
            <circle cx="266" cy="213" r="1.8"/>
          </g>

          <!-- Cypresses & Palm -->
          <path d="M302,178 C303,152 306,136 308,126 C310,136 313,152 314,178 Z" fill="#181A24"/>
          <path d="M332,195 Q328,158 323,130" stroke="#1A1521" stroke-width="3.2" fill="none"/>
          <use href="#palm-crown-night" transform="translate(323,130) scale(0.72)"/>

          <!-- Foreground Right Kurkar Archway Lit by Hanging Iron Lantern -->
          <path d="M286,0 L390,0 L390,290 L352,290 L352,126 C352,66 320,24 286,0 Z" fill="#1D1524"/>
          <path d="M286,0 C320,24 352,66 352,126 L352,275 L361,275 L361,124 C361,60 328,18 296,0 Z" fill="#8C533E"/>

          <!-- Wrought-Iron Wall Lantern on Arch -->
          <circle cx="332" cy="112" r="38" fill="url(#lantern-halo-night)"/>
          <path d="M352,102 C344,102 336,100 332,104 L332,108" stroke="#1A1421" stroke-width="1.8" fill="none"/>
          <path d="M327,108 L337,108 L335,120 L329,120 Z" fill="#FFEAA3" stroke="#1A1421" stroke-width="1.4"/>

          <!-- Foreground Promenade -->
          <path d="M0,256 C95,244 215,232 390,224 L390,300 L0,300 Z" fill="#7D5243"/>
          <path d="M0,256 C95,244 215,232 360,225" stroke="#E8B482" stroke-width="1.5" fill="none" opacity="0.55"/>

          <use href="#bougainvillea-spray-night" transform="translate(302, 12) rotate(18) scale(0.95)"/>
          <use href="#bougainvillea-spray-night" transform="translate(334, 34) rotate(35) scale(0.85)"/>

          <rect width="390" height="220" fill="url(#text-guard-night)"/>
          <rect y="218" width="390" height="82" fill="url(#cream-melt-night)"/>
          <rect width="390" height="300" filter="url(#gouache-paper)" opacity="0.65"/>
        </svg>

        <div class="overlay">
          <div class="top-bar">
            <div class="brand">🗝 Traike</div>
            <div class="pill">◎ Habima · Tel Aviv</div>
          </div>
          <div class="copy">
            <div class="big-num">65<small>min</small></div>
            <p>4.1 km · 4 stops<br>Evening walk to Jaffa Port</p>
          </div>
        </div>
      </div>
      <div class="sheet-stub"><span>Tonight’s suggested route</span><span>120 m away</span></div>
    </div>
  </div>


  <!-- =========================================================
       2A. PLAN — DAY (White City Bauhaus Corner & Bougainvillea)
       ========================================================= -->
  <div class="card-wrap">
    <div class="card-label"><span>02 · Plan</span><span>Day · White City &amp; Neve Tzedek</span></div>
    <div class="phone-frame">
      <div class="hero-box">
        <svg viewBox="0 0 390 300" width="390" height="300" xmlns="http://www.w3.org/2000/svg">
          <rect width="390" height="300" fill="url(#sky-day)"/>

          <!-- Warm Afternoon Sunbeams slanting across Tel Aviv rooftops -->
          <polygon points="90,0 220,0 340,260 180,260" fill="#FFD996" opacity="0.12"/>

          <!-- Background Neve Tzedek terracotta-roofed house -->
          <g transform="translate(152, 168)">
            <polygon points="0,24 38,6 78,24" fill="#B5411D"/>
            <polygon points="0,24 38,6 38,24" fill="#DE6231"/>
            <rect x="4" y="24" width="70" height="58" fill="#E8B379"/>
            <!-- Louvered green shutters -->
            <rect x="16" y="34" width="11" height="20" fill="#465738"/>
            <rect x="34" y="34" width="11" height="20" fill="#465738"/>
            <rect x="20" y="34" width="4" height="20" fill="#632610"/>
          </g>

          <!-- Iconic Tel Aviv 1930s Bauhaus Curved Corner Building (Right Focal Point) -->
          <g transform="translate(226, 62)">
            <!-- Main sunlit curved stucco volume -->
            <path d="M18,22 C18,12 46,8 84,8 L164,14 L164,210 L18,210 Z" fill="#FADCB0"/>
            <!-- Shaded side return wall -->
            <path d="M98,9 L164,14 L164,210 L98,210 Z" fill="#D9985F"/>
            <!-- Roofline parapet coping -->
            <path d="M18,22 C18,12 46,8 84,8 L164,14 L164,18 L84,12 C46,12 18,16 18,26 Z" fill="#FFF0D4"/>

            <!-- Signature Bauhaus Vertical "Thermometer" Stairwell Window Strip -->
            <rect x="80" y="24" width="11" height="145" rx="5.5" fill="#7D3218"/>
            <g stroke="#FADCB0" stroke-width="1.6">
              <line x1="80" y1="42" x2="91" y2="42"/>
              <line x1="80" y1="60" x2="91" y2="60"/>
              <line x1="80" y1="78" x2="91" y2="78"/>
              <line x1="80" y1="96" x2="91" y2="96"/>
              <line x1="80" y1="114" x2="91" y2="114"/>
              <line x1="80" y1="132" x2="91" y2="132"/>
            </g>

            <!-- Sweeping Curved Ribbon Balcony — Upper Floor -->
            <path d="M4,66 C4,58 34,55 68,56 L68,76 C34,75 4,78 4,84 Z" fill="#FFF1D6"/>
            <path d="M4,80 C4,75 34,72 68,73 L68,80 C34,79 4,82 4,87 Z" fill="#B86B35"/>
            <!-- Deep recessed balcony shadow & cedar shutters -->
            <path d="M14,40 C26,38 48,37 66,38 L66,56 C48,55 26,56 14,58 Z" fill="#7A3117"/>
            <rect x="34" y="40" width="12" height="16" fill="#4C5E3C"/>
            <rect x="50" y="40" width="12" height="16" fill="#3B4A2E"/>
            <!-- Thin tubular Bauhaus iron handrail -->
            <path d="M4,62 C4,54 34,51 68,52" stroke="#5E230E" stroke-width="1.2" fill="none"/>

            <!-- Sweeping Curved Ribbon Balcony — Middle Floor -->
            <path d="M4,122 C4,114 34,111 68,112 L68,132 C34,131 4,134 4,140 Z" fill="#FFF1D6"/>
            <path d="M4,136 C4,131 34,128 68,129 L68,136 C34,135 4,138 4,143 Z" fill="#B86B35"/>
            <path d="M14,96 C26,94 48,93 66,94 L66,112 C48,111 26,112 14,114 Z" fill="#7A3117"/>
            <rect x="28" y="96" width="12" height="16" fill="#4C5E3C"/>
            <rect x="44" y="96" width="12" height="16" fill="#3B4A2E"/>
            <path d="M4,118 C4,110 34,107 68,108" stroke="#5E230E" stroke-width="1.2" fill="none"/>

            <!-- Shaded East Wall Windows with Striped Canvas Awning -->
            <rect x="114" y="42" width="24" height="28" fill="#6E2B14"/>
            <polygon points="112,42 140,42 145,53 109,53" fill="#D94E28"/>
            <line x1="120" y1="42" x2="119" y2="53" stroke="#FFF0D4" stroke-width="2.2"/>
            <line x1="130" y1="42" x2="132" y2="53" stroke="#FFF0D4" stroke-width="2.2"/>

            <rect x="114" y="98" width="24" height="28" fill="#6E2B14"/>
            <!-- Potted Mediterranean balcony plants -->
            <path d="M14,62 C18,54 26,54 30,62 Z" fill="#465937"/>
            <path d="M52,118 C56,109 64,110 67,118 Z" fill="#465937"/>
          </g>

          <!-- Street-Level Ficus Canopy & Sidewalk Cafe Corner -->
          <g transform="translate(196, 198)">
            <path d="M0,30 C8,12 28,6 48,14 C62,4 86,8 96,26 C74,34 26,36 0,30 Z" fill="#3D4D2F"/>
            <path d="M18,26 C28,14 48,12 64,22 C48,28 30,29 18,26 Z" fill="#586B43"/>
            <!-- Striped Cafe Umbrella & Tiny Bistro Table -->
            <path d="M56,42 C68,32 88,32 100,42 Z" fill="#E86F38"/>
            <path d="M68,42 C74,34 82,34 88,42 Z" fill="#FFF0D4"/>
            <line x1="78" y1="42" x2="78" y2="58" stroke="#59220E" stroke-width="1.5"/>
          </g>

          <!-- Lush Overhanging Bougainvillea & Olive Bough Top-Right -->
          <path d="M265,0 C295,18 335,28 390,22 L390,0 Z" fill="#3B472B"/>
          <use href="#bougainvillea-spray" transform="translate(278, 12) rotate(12) scale(1.05)"/>
          <use href="#bougainvillea-spray" transform="translate(318, 18) rotate(24) scale(1.1)"/>
          <use href="#bougainvillea-spray" transform="translate(352, 34) rotate(42) scale(0.95)"/>

          <!-- Readability & Cream Sheet Melt -->
          <rect width="390" height="215" fill="url(#text-guard-day)"/>
          <rect y="216" width="390" height="84" fill="url(#cream-melt-day)"/>
          <rect width="390" height="300" filter="url(#gouache-paper)" opacity="0.7"/>
        </svg>

        <div class="overlay">
          <div class="top-bar">
            <div class="brand">🗝 Traike</div>
            <div class="pill">◎ Habima · Tel Aviv</div>
          </div>
          <div class="copy">
            <h2>Where shall we<br>walk?</h2>
            <p>AI walking companion · Israel</p>
          </div>
        </div>
      </div>
      <div class="sheet-stub"><span>Route vibe · Must-see · Food &amp; markets</span><span>Pick 1–3</span></div>
    </div>
  </div>

  <!-- =========================================================
       2B. PLAN — NIGHT (Lit Bauhaus Balconies & Evening Bistro)
       ========================================================= -->
  <div class="card-wrap">
    <div class="card-label"><span>02 · Plan</span><span>Night · Lit White City</span></div>
    <div class="phone-frame">
      <div class="hero-box">
        <svg viewBox="0 0 390 300" width="390" height="300" xmlns="http://www.w3.org/2000/svg">
          <rect width="390" height="300" fill="url(#sky-night)"/>

          <!-- Subtle night stars -->
          <circle cx="148" cy="44" r="1.1" fill="#FFF2CC" opacity="0.75"/>
          <circle cx="198" cy="62" r="1.3" fill="#FFF2CC" opacity="0.85"/>
          <circle cx="222" cy="32" r="0.9" fill="#FFF2CC" opacity="0.6"/>

          <!-- Neve Tzedek Roof Silhouette & Warm Window -->
          <g transform="translate(152, 168)">
            <polygon points="0,24 38,6 78,24" fill="#3B202C"/>
            <rect x="4" y="24" width="70" height="58" fill="#4A303D"/>
            <rect x="24" y="35" width="12" height="18" rx="1" fill="#FFE08C"/>
          </g>

          <!-- Bauhaus Curved Corner Building at Night -->
          <g transform="translate(226, 62)">
            <path d="M18,22 C18,12 46,8 84,8 L164,14 L164,210 L18,210 Z" fill="#6E4B52"/>
            <path d="M98,9 L164,14 L164,210 L98,210 Z" fill="#3B2738"/>
            <path d="M18,22 C18,12 46,8 84,8 L164,14 L164,18 L84,12 C46,12 18,16 18,26 Z" fill="#9E6E68"/>

            <!-- Glowing Golden Thermometer Stairwell Strip! -->
            <rect x="78" y="22" width="15" height="149" rx="7" fill="#FFB84D" opacity="0.25"/>
            <rect x="80" y="24" width="11" height="145" rx="5.5" fill="#FFE291"/>
            <g stroke="#593842" stroke-width="1.8">
              <line x1="80" y1="42" x2="91" y2="42"/>
              <line x1="80" y1="60" x2="91" y2="60"/>
              <line x1="80" y1="78" x2="91" y2="78"/>
              <line x1="80" y1="96" x2="91" y2="96"/>
              <line x1="80" y1="114" x2="91" y2="114"/>
              <line x1="80" y1="132" x2="91" y2="132"/>
            </g>

            <!-- Upper Balcony with Warm Interior Light Spilling Out -->
            <path d="M14,40 C26,38 48,37 66,38 L66,56 C48,55 26,56 14,58 Z" fill="#FFCF75"/>
            <rect x="34" y="40" width="10" height="16" fill="#2A332B"/>
            <rect x="52" y="40" width="10" height="16" fill="#2A332B"/>
            <path d="M4,66 C4,58 34,55 68,56 L68,76 C34,75 4,78 4,84 Z" fill="#8C605E"/>
            <path d="M4,80 C4,75 34,72 68,73 L68,80 C34,79 4,82 4,87 Z" fill="#472D38"/>
            <path d="M4,62 C4,54 34,51 68,52" stroke="#261924" stroke-width="1.2" fill="none"/>

            <!-- Middle Balcony Lit -->
            <path d="M14,96 C26,94 48,93 66,94 L66,112 C48,111 26,112 14,114 Z" fill="#FFE094"/>
            <rect x="24" y="96" width="11" height="16" fill="#2A332B"/>
            <path d="M4,122 C4,114 34,111 68,112 L68,132 C34,131 4,134 4,140 Z" fill="#8C605E"/>
            <path d="M4,136 C4,131 34,128 68,129 L68,136 C34,135 4,138 4,143 Z" fill="#472D38"/>
            <path d="M4,118 C4,110 34,107 68,108" stroke="#261924" stroke-width="1.2" fill="none"/>

            <!-- East Window Lit -->
            <rect x="114" y="42" width="24" height="28" fill="#FFD982"/>
            <polygon points="112,42 140,42 145,53 109,53" fill="#8C2F2B"/>
            <rect x="114" y="98" width="24" height="28" fill="#291B29"/>
          </g>

          <!-- Cafe String Lights & Evening Ficus -->
          <g transform="translate(196, 198)">
            <path d="M0,30 C8,12 28,6 48,14 C62,4 86,8 96,26 C74,34 26,36 0,30 Z" fill="#1F2626"/>
            <circle cx="72" cy="36" r="34" fill="url(#lantern-halo-night)"/>
            <path d="M35,28 Q68,36 105,26" stroke="#2A1E29" stroke-width="1" fill="none"/>
            <g fill="#FFEBA8">
              <circle cx="46" cy="30" r="1.8"/>
              <circle cx="60" cy="32" r="1.8"/>
              <circle cx="74" cy="32.5" r="1.8"/>
              <circle cx="88" cy="30.5" r="1.8"/>
            </g>
          </g>

          <!-- Night Bougainvillea Canopy -->
          <path d="M265,0 C295,18 335,28 390,22 L390,0 Z" fill="#1B2124"/>
          <use href="#bougainvillea-spray-night" transform="translate(278, 12) rotate(12) scale(1.05)"/>
          <use href="#bougainvillea-spray-night" transform="translate(318, 18) rotate(24) scale(1.1)"/>
          <use href="#bougainvillea-spray-night" transform="translate(352, 34) rotate(42) scale(0.95)"/>

          <rect width="390" height="215" fill="url(#text-guard-night)"/>
          <rect y="216" width="390" height="84" fill="url(#cream-melt-night)"/>
          <rect width="390" height="300" filter="url(#gouache-paper)" opacity="0.65"/>
        </svg>

        <div class="overlay">
          <div class="top-bar">
            <div class="brand">🗝 Traike</div>
            <div class="pill">◎ Habima · Tel Aviv</div>
          </div>
          <div class="copy">
            <h2>Where shall we<br>walk?</h2>
            <p>AI walking companion · Israel</p>
          </div>
        </div>
      </div>
      <div class="sheet-stub"><span>Route vibe · Must-see · Food &amp; markets</span><span>Pick 1–3</span></div>
    </div>
  </div>


  <!-- =========================================================
       3A. LIVE WALK — DAY (Nahalat Binyamin / Shaded Street Perspective)
       ========================================================= -->
  <div class="card-wrap">
    <div class="card-label"><span>03 · Live Walk</span><span>Day · Nahalat Binyamin</span></div>
    <div class="phone-frame">
      <div class="hero-box">
        <svg viewBox="0 0 390 300" width="390" height="300" xmlns="http://www.w3.org/2000/svg">
          <rect width="390" height="300" fill="url(#sky-day)"/>

          <!-- Sunlit Street Canyon Glow at the Turn Ahead -->
          <circle cx="218" cy="198" r="68" fill="#FFE6A3" opacity="0.45"/>

          <!-- Distant Cross-Street Eclectic Tel Aviv Facade -->
          <g transform="translate(166, 124)">
            <rect x="0" y="18" width="76" height="92" fill="#F2BE80"/>
            <!-- Tel Aviv Eclectic Crenellated Parapet -->
            <path d="M0,18 L18,18 L18,10 L38,6 L58,10 L58,18 L76,18 Z" fill="#F5CA90"/>
            <path d="M12,32 A6,6 0 0,1 24,32 L24,50 L12,50 Z" fill="#8C3919"/>
            <path d="M32,32 A6,6 0 0,1 44,32 L44,50 L32,50 Z" fill="#8C3919"/>
            <path d="M52,32 A6,6 0 0,1 64,32 L64,50 L52,50 Z" fill="#8C3919"/>
            <rect x="8" y="50" width="60" height="4" fill="#FFE5B8"/>
          </g>

          <!-- Perspective Limestone & Brick Arched Colonnade on Right (Nahalat Binyamin style) -->
          <g>
            <!-- Main receding wall -->
            <polygon points="242,108 390,34 390,262 242,226" fill="#C96D36"/>
            <!-- Sunlit pilasters & upper cornice -->
            <polygon points="242,108 390,34 390,46 242,115" fill="#FAD8A4"/>
            <polygon points="242,158 390,118 390,124 242,162" fill="#FAD8A4"/>

            <!-- Deep Shaded Ground-Floor Arcade Arches in Perspective -->
            <path d="M252,226 L252,182 C252,170 268,166 268,178 L268,230 Z" fill="#5E210D"/>
            <path d="M280,234 L280,174 C280,158 304,152 304,170 L304,240 Z" fill="#5E210D"/>
            <path d="M320,244 L320,162 C320,140 356,130 356,154 L356,254 Z" fill="#521B09"/>
            <!-- Sunlit inner arch rims -->
            <path d="M280,234 L280,174 C280,162 290,157 297,160" stroke="#F7CE92" stroke-width="2" fill="none"/>
            <path d="M320,244 L320,162 C320,146 336,137 348,141" stroke="#F7CE92" stroke-width="2.5" fill="none"/>

            <!-- Upper Shuttered Windows -->
            <polygon points="284,106 302,98 302,130 284,136" fill="#475736"/>
            <polygon points="326,86 352,74 352,114 326,123" fill="#475736"/>
            <polygon points="333,83 345,78 345,116 333,120" fill="#63230E"/>

            <!-- Classic Blue-and-Cream Enamel Tel Aviv Street Plaque on Corner Wall -->
            <polygon points="358,144 384,138 384,152 358,157" fill="#FFF3D9" stroke="#59220E" stroke-width="1"/>
            <line x1="362" y1="148" x2="380" y2="144" stroke="#2D4A63" stroke-width="2"/>
            <line x1="362" y1="152" x2="376" y2="149" stroke="#2D4A63" stroke-width="1.2"/>
          </g>

          <!-- Sun-Dappled Cobblestone Walkway Curving Left at the Corner Ahead -->
          <path d="M68,266 C128,242 178,224 218,218 L390,252 L390,300 L0,300 L0,276 Z" fill="#DFA268"/>
          <!-- Left-curving golden stone path highlight -->
          <path d="M115,268 C156,244 188,228 214,218 L244,222 C222,234 196,252 178,274 Z" fill="#FCE2B3" opacity="0.72"/>
          <!-- Tree leaf shadows across the pavement -->
          <path d="M210,238 C245,234 295,238 345,248 C305,254 245,250 210,238 Z" fill="#9E4B22" opacity="0.35"/>

          <!-- Overhanging Boulevard Ficus Tree & Wrought-Iron Streetlamp -->
          <path d="M165,0 C195,28 248,42 318,26 C295,48 252,54 212,42 C232,62 272,68 310,58 L335,0 Z" fill="#3B4A2C" opacity="0.92"/>
          <!-- Vintage Tel Aviv Boulevard Lamp Post -->
          <g transform="translate(234, 134)">
            <line x1="0" y1="12" x2="0" y2="92" stroke="#3D1E10" stroke-width="2.6"/>
            <path d="M0,22 C0,10 14,8 16,16" stroke="#3D1E10" stroke-width="2" fill="none"/>
            <circle cx="16" cy="21" r="14" fill="url(#lantern-halo-day)"/>
            <path d="M12,16 L20,16 L18,25 L14,25 Z" fill="#FFF3CC" stroke="#3D1E10" stroke-width="1.2"/>
          </g>

          <rect width="390" height="215" fill="url(#text-guard-day)"/>
          <rect y="218" width="390" height="82" fill="url(#cream-melt-day)"/>
          <rect width="390" height="300" filter="url(#gouache-paper)" opacity="0.7"/>
        </svg>

        <div class="overlay">
          <div class="top-bar">
            <div class="brand">🗝 Traike</div>
            <div class="pill">◎ Stop 2 of 4 · 19:20</div>
          </div>
          <div class="copy walk-turn">
            <div class="big-num">4<small>min · 310 m</small></div>
            <p>↰ Turn left onto Nahalat Binyamin</p>
          </div>
        </div>
      </div>
      <div class="sheet-stub"><span>Next · Carmel Market Alleys</span><span>2.8 km left</span></div>
    </div>
  </div>

  <!-- =========================================================
       3B. LIVE WALK — NIGHT (Lantern-Lit Nahalat Binyamin Alley)
       ========================================================= -->
  <div class="card-wrap">
    <div class="card-label"><span>03 · Live Walk</span><span>Night · Lantern Boulevard</span></div>
    <div class="phone-frame">
      <div class="hero-box">
        <svg viewBox="0 0 390 300" width="390" height="300" xmlns="http://www.w3.org/2000/svg">
          <rect width="390" height="300" fill="url(#sky-night)"/>

          <!-- Warm Golden Glow Coming Around the Left Turn Ahead -->
          <circle cx="215" cy="204" r="68" fill="url(#lantern-halo-night)" opacity="0.8"/>

          <!-- Distant Cross-Street Eclectic Building at Night -->
          <g transform="translate(166, 124)">
            <rect x="0" y="18" width="76" height="92" fill="#472E3B"/>
            <path d="M0,18 L18,18 L18,10 L38,6 L58,10 L58,18 L76,18 Z" fill="#593A47"/>
            <path d="M12,32 A6,6 0 0,1 24,32 L24,50 L12,50 Z" fill="#FFE08C"/>
            <path d="M32,32 A6,6 0 0,1 44,32 L44,50 L32,50 Z" fill="#2A1B29"/>
            <path d="M52,32 A6,6 0 0,1 64,32 L64,50 L52,50 Z" fill="#FFD470"/>
          </g>

          <!-- Night Arched Colonnade with Warm Shopfront Glow -->
          <g>
            <polygon points="242,108 390,34 390,262 242,226" fill="#3B2534"/>
            <polygon points="242,108 390,34 390,46 242,115" fill="#6E4952"/>
            <polygon points="242,158 390,118 390,124 242,162" fill="#6E4952"/>

            <!-- Lit Ground-Floor Wine Bar / Gallery Arches -->
            <path d="M252,226 L252,182 C252,170 268,166 268,178 L268,230 Z" fill="#E89C4A"/>
            <path d="M280,234 L280,174 C280,158 304,152 304,170 L304,240 Z" fill="#FFE094"/>
            <path d="M320,244 L320,162 C320,140 356,130 356,154 L356,254 Z" fill="#F5B85E"/>
            <!-- Mullion silhouettes inside lit arches -->
            <line x1="292" y1="158" x2="292" y2="236" stroke="#3B2534" stroke-width="1.6"/>
            <line x1="338" y1="140" x2="338" y2="250" stroke="#3B2534" stroke-width="2"/>

            <polygon points="284,106 302,98 302,130 284,136" fill="#232B29"/>
            <polygon points="326,86 352,74 352,114 326,123" fill="#232B29"/>
            <polygon points="358,144 384,138 384,152 358,157" fill="#E8CFA8"/>
            <line x1="362" y1="148" x2="380" y2="144" stroke="#233B52" stroke-width="2"/>
          </g>

          <!-- Lantern-Lit Cobblestones -->
          <path d="M68,266 C128,242 178,224 218,218 L390,252 L390,300 L0,300 L0,276 Z" fill="#6E4844"/>
          <path d="M115,268 C156,244 188,228 214,218 L244,222 C222,234 196,252 178,274 Z" fill="#E8AA6B" opacity="0.55"/>

          <!-- Ficus Silhouette & Glowing Boulevard Streetlamp -->
          <path d="M165,0 C195,28 248,42 318,26 C295,48 252,54 212,42 C232,62 272,68 310,58 L335,0 Z" fill="#181E24" opacity="0.95"/>
          <g transform="translate(234, 134)">
            <circle cx="16" cy="21" r="42" fill="url(#lantern-halo-night)"/>
            <line x1="0" y1="12" x2="0" y2="92" stroke="#18121E" stroke-width="2.6"/>
            <path d="M0,22 C0,10 14,8 16,16" stroke="#18121E" stroke-width="2" fill="none"/>
            <path d="M12,16 L20,16 L18,25 L14,25 Z" fill="#FFF2B8" stroke="#18121E" stroke-width="1.2"/>
          </g>

          <rect width="390" height="215" fill="url(#text-guard-night)"/>
          <rect y="218" width="390" height="82" fill="url(#cream-melt-night)"/>
          <rect width="390" height="300" filter="url(#gouache-paper)" opacity="0.65"/>
        </svg>

        <div class="overlay">
          <div class="top-bar">
            <div class="brand">🗝 Traike</div>
            <div class="pill">◎ Stop 2 of 4 · 21:15</div>
          </div>
          <div class="copy walk-turn">
            <div class="big-num">4<small>min · 310 m</small></div>
            <p>↰ Turn left onto Nahalat Binyamin</p>
          </div>
        </div>
      </div>
      <div class="sheet-stub"><span>Next · Carmel Market Alleys</span><span>2.8 km left</span></div>
    </div>
  </div>


  <!-- =========================================================
       4A. MY WALKS — DAY (Tayelet Coastal Promenade & Two Friends)
       ========================================================= -->
  <div class="card-wrap">
    <div class="card-label"><span>04 · My Walks</span><span>Day · Coastal Tayelet</span></div>
    <div class="phone-frame">
      <div class="hero-box">
        <svg viewBox="0 0 390 300" width="390" height="300" xmlns="http://www.w3.org/2000/svg">
          <rect width="390" height="300" fill="url(#sky-day)"/>

          <!-- Distant Carmel / Galilee-to-Jaffa Sweeping Horizon Clouds -->
          <path d="M180,136 C245,126 325,128 385,138 C330,143 235,142 180,136 Z" fill="#F9CF93" opacity="0.34"/>

          <!-- Distant Sunlit Headland Ridge (Jaffa / Bat Yam curve) -->
          <path d="M0,184 C65,182 115,175 158,176 C182,176 198,184 215,186 L0,188 Z" fill="#9E3F1C" opacity="0.78"/>

          <!-- Mediterranean Sea & Gentle Rolling Surf -->
          <path d="M0,185 L390,185 L390,256 L0,256 Z" fill="#CC6E33" opacity="0.68"/>
          <!-- Cream-gold foam lines curving into the bay -->
          <path d="M24,204 C92,202 165,208 238,222" stroke="#FFE9BD" stroke-width="1.6" stroke-linecap="round" fill="none" opacity="0.78"/>
          <path d="M58,216 C118,214 182,220 252,234" stroke="#FFE9BD" stroke-width="1.3" stroke-linecap="round" fill="none" opacity="0.62"/>

          <!-- Sandy Shoreline Curve -->
          <path d="M85,238 C165,228 245,216 390,198 L390,275 L85,275 Z" fill="#E5A265"/>

          <!-- Sweeping Tel Aviv Coastal Park Hill & Tayelet Promenade -->
          <path d="M140,262 C208,228 286,192 390,178 L390,285 L120,285 Z" fill="#4A5936"/>
          <path d="M155,264 C222,232 294,200 390,188 L390,285 L145,285 Z" fill="#D99255"/>

          <!-- Classic Sunlit Limestone Balustrade Along the Promenade -->
          <path d="M168,256 C230,224 298,196 390,184 L390,194 C298,206 230,234 168,264 Z" fill="#FADAB0"/>
          <path d="M168,256 C230,224 298,196 390,184" stroke="#FFF4DC" stroke-width="1.6" fill="none"/>

          <!-- Palm Trees Swaying in the Sea Breeze on Charles Clore Bluff -->
          <g>
            <path d="M336,192 Q330,152 322,122" stroke="#592611" stroke-width="3.2" fill="none"/>
            <use href="#palm-crown-day" transform="translate(322,122) scale(0.76) rotate(-6)"/>

            <path d="M366,188 Q364,142 358,106" stroke="#4D200E" stroke-width="3.6" fill="none"/>
            <use href="#palm-crown-day" transform="translate(358,106) scale(0.88) rotate(5)"/>

            <!-- Tamarisk / Coastal Pine Cushion -->
            <path d="M304,198 C312,184 332,182 344,192 C354,182 374,182 386,192 L304,198 Z" fill="#364227"/>
          </g>

          <!-- Two Expressive Walkers (Friends) Strolling Together on the Promenade -->
          <g transform="translate(264, 185)">
            <!-- Long golden-hour cast shadows -->
            <ellipse cx="12" cy="24" rx="10" ry="2" fill="#8C3D19" opacity="0.45"/>
            <ellipse cx="26" cy="22" rx="10" ry="2" fill="#8C3D19" opacity="0.45"/>
            <!-- Friend 1 (left, mid-stride with daypack) -->
            <circle cx="6" cy="4" r="2.7" fill="#4A1A0A"/>
            <path d="M5,7 L8,7 L9,15 L4,15 Z" fill="#FFF0D4"/>
            <path d="M8,8 C11,8 11,13 8,14 Z" fill="#C94A29"/>
            <path d="M5,15 L3,23 M8,15 L10,23" stroke="#4A1A0A" stroke-width="1.8" stroke-linecap="round"/>
            <!-- Friend 2 (right, sunhat & flowing jacket) -->
            <circle cx="19" cy="3" r="2.6" fill="#4A1A0A"/>
            <ellipse cx="19" cy="2.2" rx="4.8" ry="1.3" fill="#FAD79B"/>
            <path d="M17,6 L21,6 L23,15 L16,15 Z" fill="#E0533C"/>
            <path d="M18,15 L16,22 M20,15 L23,22" stroke="#4A1A0A" stroke-width="1.8" stroke-linecap="round"/>
          </g>

          <!-- Distant Sailboat & Sea Swifts -->
          <g transform="translate(128, 181)">
            <path d="M0,5 L14,5 L12,7.5 L2,7.5 Z" fill="#59220E"/>
            <path d="M7,5 L7,-6 L13,4 Z" fill="#FFF2D2"/>
          </g>
          <use href="#swift" transform="translate(242, 98) scale(0.52) rotate(-10)" fill="#591E0B" opacity="0.72"/>
          <use href="#swift" transform="translate(262, 88) scale(0.4) rotate(4)" fill="#591E0B" opacity="0.6"/>

          <rect width="390" height="210" fill="url(#text-guard-day)"/>
          <rect y="216" width="390" height="84" fill="url(#cream-melt-day)"/>
          <rect width="390" height="300" filter="url(#gouache-paper)" opacity="0.7"/>
        </svg>

        <div class="overlay">
          <div class="top-bar">
            <div class="brand">🗝 Traike</div>
            <div class="pill">◎ Tel Aviv · Jerusalem · Haifa</div>
          </div>
          <div class="copy">
            <h2>My walks &amp; friends</h2>
            <p>12 walks · 48.4 km explored</p>
          </div>
        </div>
      </div>
      <div class="sheet-stub"><span>Saved (3) · Walked (8) · Friends (0)</span><span>Jaffa Ridge</span></div>
    </div>
  </div>

  <!-- =========================================================
       4B. MY WALKS — NIGHT (Starlit Coastal Promenade & Necklace of Lights)
       ========================================================= -->
  <div class="card-wrap">
    <div class="card-label"><span>04 · My Walks</span><span>Night · Tayelet Necklace</span></div>
    <div class="phone-frame">
      <div class="hero-box">
        <svg viewBox="0 0 390 300" width="390" height="300" xmlns="http://www.w3.org/2000/svg">
          <rect width="390" height="300" fill="url(#sky-night)"/>

          <!-- Evening Stars -->
          <g fill="#FFF2CC">
            <circle cx="210" cy="48" r="1.2" opacity="0.85"/>
            <circle cx="268" cy="36" r="1" opacity="0.7"/>
            <circle cx="312" cy="58" r="1.3" opacity="0.85"/>
            <circle cx="164" cy="70" r="0.9" opacity="0.55"/>
          </g>

          <!-- Distant Headland with Necklace of Harbor Lights -->
          <path d="M0,184 C65,182 115,175 158,176 C182,176 198,184 215,186 L0,188 Z" fill="#23192E"/>
          <g fill="#FFE08C" opacity="0.85">
            <circle cx="88" cy="182" r="1.1"/>
            <circle cx="104" cy="180" r="1.2"/>
            <circle cx="122" cy="179" r="1.3"/>
            <circle cx="138" cy="178" r="1.1"/>
            <circle cx="154" cy="178" r="1.4"/>
            <circle cx="172" cy="180" r="1.1"/>
          </g>

          <!-- Night Sea & Shimmering Reflections -->
          <path d="M0,185 L390,185 L390,256 L0,256 Z" fill="#292038" opacity="0.88"/>
          <path d="M24,204 C92,202 165,208 238,222" stroke="#F7C98B" stroke-width="1.3" stroke-linecap="round" fill="none" opacity="0.45"/>
          <path d="M98,192 L176,192" stroke="#FFD984" stroke-width="1" stroke-dasharray="3 6" opacity="0.55"/>

          <!-- Night Beach & Promenade -->
          <path d="M85,238 C165,228 245,216 390,198 L390,275 L85,275 Z" fill="#593B42"/>
          <path d="M140,262 C208,228 286,192 390,178 L390,285 L120,285 Z" fill="#1F2429"/>
          <path d="M155,264 C222,232 294,200 390,188 L390,285 L145,285 Z" fill="#6E4A47"/>

          <!-- Promenade Balustrade & Warm Globe Lamps -->
          <path d="M168,256 C230,224 298,196 390,184 L390,194 C298,206 230,234 168,264 Z" fill="#9E6E62"/>
          <!-- Glowing Promenade Lamps -->
          <g>
            <circle cx="235" cy="212" r="22" fill="url(#lantern-halo-night)"/>
            <line x1="235" y1="212" x2="235" y2="226" stroke="#1A1524" stroke-width="1.6"/>
            <circle cx="235" cy="211" r="2.6" fill="#FFF0B8"/>

            <circle cx="298" cy="188" r="26" fill="url(#lantern-halo-night)"/>
            <line x1="298" y1="188" x2="298" y2="203" stroke="#1A1524" stroke-width="1.8"/>
            <circle cx="298" cy="187" r="2.8" fill="#FFF0B8"/>
          </g>

          <!-- Night Palms -->
          <path d="M336,192 Q330,152 322,122" stroke="#1A1521" stroke-width="3.2" fill="none"/>
          <use href="#palm-crown-night" transform="translate(322,122) scale(0.76) rotate(-6)"/>
          <path d="M366,188 Q364,142 358,106" stroke="#1A1521" stroke-width="3.6" fill="none"/>
          <use href="#palm-crown-night" transform="translate(358,106) scale(0.88) rotate(5)"/>

          <!-- Two Evening Walkers Under Lantern Glow -->
          <g transform="translate(264, 185)">
            <circle cx="6" cy="4" r="2.7" fill="#181221"/>
            <path d="M5,7 L8,7 L9,15 L4,15 Z" fill="#FFD996"/>
            <path d="M5,15 L3,23 M8,15 L10,23" stroke="#181221" stroke-width="1.8" stroke-linecap="round"/>
            <circle cx="19" cy="3" r="2.6" fill="#181221"/>
            <path d="M17,6 L21,6 L23,15 L16,15 Z" fill="#C95249"/>
            <path d="M18,15 L16,22 M20,15 L23,22" stroke="#181221" stroke-width="1.8" stroke-linecap="round"/>
          </g>

          <rect width="390" height="210" fill="url(#text-guard-night)"/>
          <rect y="216" width="390" height="84" fill="url(#cream-melt-night)"/>
          <rect width="390" height="300" filter="url(#gouache-paper)" opacity="0.65"/>
        </svg>

        <div class="overlay">
          <div class="top-bar">
            <div class="brand">🗝 Traike</div>
            <div class="pill">◎ Tel Aviv · Jerusalem · Haifa</div>
          </div>
          <div class="copy">
            <h2>My walks &amp; friends</h2>
            <p>12 walks · 48.4 km explored</p>
          </div>
        </div>
      </div>
      <div class="sheet-stub"><span>Saved (3) · Walked (8) · Friends (0)</span><span>Jaffa Ridge</span></div>
    </div>
  </div>


  <!-- =========================================================
       5A. SIGN-IN — DAY (Symmetrical Jaffa Stone Arch & Iron Lantern)
       ========================================================= -->
  <div class="card-wrap">
    <div class="card-label"><span>05 · Sign-in</span><span>Day · Jaffa Courtyard Arch</span></div>
    <div class="phone-frame">
      <div class="hero-box">
        <svg viewBox="0 0 390 300" width="390" height="300" xmlns="http://www.w3.org/2000/svg">
          <rect width="390" height="300" fill="url(#sky-day)"/>

          <!-- Soft Warm Glow Behind Center Lantern & Headline -->
          <circle cx="195" cy="138" r="95" fill="#7D2409" opacity="0.32"/>
          <circle cx="195" cy="222" r="78" fill="#FFE6A8" opacity="0.38"/>

          <!-- Low Distant Horizon Glimpse of Jaffa Roofs & Sea -->
          <path d="M40,228 L350,228 L350,265 L40,265 Z" fill="#E3934F" opacity="0.55"/>
          <path d="M52,230 L92,216 L128,218 L142,208 L166,222 L238,224 L262,210 L295,214 L338,228 Z" fill="#9E3F1C" opacity="0.72"/>
          <!-- Tiny distant spire & palm -->
          <path d="M268,212 L272,194 L276,212 Z" fill="#853114"/>
          <path d="M114,220 Q112,204 109,194" stroke="#6E2810" stroke-width="1.8" fill="none"/>
          <use href="#palm-crown-day" transform="translate(109,194) scale(0.38)"/>

          <!-- Framing Kurkar Limestone Archway (Left & Right Piers + Overhead Vault) -->
          <!-- Outer shaded stonework -->
          <path d="M0,0 L390,0 L390,285 L344,285 L344,136 C344,58 282,18 195,18 C108,18 46,58 46,136 L46,285 L0,285 Z" fill="#6B250E"/>
          <!-- Inner sunlit bevel of the stone arch -->
          <path d="M195,18 C282,18 344,58 344,136 L344,275 L353,275 L353,134 C353,50 288,9 195,9 C102,9 37,50 37,134 L37,275 L46,275 L46,136 C46,58 108,18 195,18 Z" fill="#EEA968"/>

          <!-- Hand-cut Keystone & Voussoir Masonry Lines -->
          <g stroke="#7A2D13" stroke-width="1" opacity="0.55">
            <line x1="186" y1="9" x2="188" y2="19"/>
            <line x1="204" y1="9" x2="202" y2="19"/>
            <line x1="142" y1="16" x2="146" y2="25"/>
            <line x1="248" y1="16" x2="244" y2="25"/>
            <line x1="98" y1="34" x2="105" y2="42"/>
            <line x1="292" y1="34" x2="285" y2="42"/>
            <line x1="62" y1="68" x2="71" y2="73"/>
            <line x1="328" y1="68" x2="319" y2="73"/>
          </g>

          <!-- Artisanal Wrought-Iron Jaffa Courtyard Lantern Suspended at Top Center -->
          <g transform="translate(195, 18)">
            <circle cx="0" cy="76" r="42" fill="url(#lantern-halo-day)"/>
            <!-- Iron chain & scrollwork bracket -->
            <line x1="0" y1="0" x2="0" y2="46" stroke="#3B1609" stroke-width="2"/>
            <path d="M-12,42 C-6,36 6,36 12,42" stroke="#3B1609" stroke-width="1.6" fill="none"/>
            <!-- Domed copper-iron cap -->
            <path d="M-15,54 C-12,44 12,44 15,54 Z" fill="#471B0B"/>
            <rect x="-17" y="54" width="34" height="3" rx="1.5" fill="#5E2410"/>
            <!-- Hexagonal warm glass lantern body -->
            <polygon points="-13,57 13,57 9,85 -9,85" fill="#FFF1C2" stroke="#471B0B" stroke-width="1.8"/>
            <line x1="-5" y1="57" x2="-3.5" y2="85" stroke="#471B0B" stroke-width="1.3"/>
            <line x1="5" y1="57" x2="3.5" y2="85" stroke="#471B0B" stroke-width="1.3"/>
            <!-- Warm inner flame -->
            <path d="M0,66 C3,71 3,77 0,79 C-3,77 -3,71 0,66 Z" fill="#FF9E2C"/>
            <!-- Finial base -->
            <path d="M-9,85 L9,85 L0,94 Z" fill="#471B0B"/>
          </g>

          <!-- Graceful Bougainvillea & Olive Branches Framing Upper Corners -->
          <use href="#bougainvillea-spray" transform="translate(42, 54) rotate(28) scale(0.92)"/>
          <use href="#bougainvillea-spray" transform="translate(28, 92) rotate(58) scale(0.76)"/>
          <use href="#bougainvillea-spray" transform="translate(314, 48) rotate(138) scale(0.92)"/>
          <use href="#bougainvillea-spray" transform="translate(342, 88) rotate(115) scale(0.76)"/>

          <rect y="216" width="390" height="84" fill="url(#cream-melt-day)"/>
          <rect width="390" height="300" filter="url(#gouache-paper)" opacity="0.7"/>
        </svg>

        <div class="overlay">
          <div class="top-bar">
            <div class="brand">🗝 Traike</div>
            <div class="pill">◎ Skip · Try first</div>
          </div>
          <div class="copy centered">
            <h2>Sign in to Traike</h2>
          </div>
        </div>
      </div>
      <div class="sheet-stub"><span>Walks built around you</span><span>Save &amp; sync</span></div>
    </div>
  </div>

  <!-- =========================================================
       5B. SIGN-IN — NIGHT (Glowing Courtyard Lantern & Starry Arch)
       ========================================================= -->
  <div class="card-wrap">
    <div class="card-label"><span>05 · Sign-in</span><span>Night · Glowing Lantern Arch</span></div>
    <div class="phone-frame">
      <div class="hero-box">
        <svg viewBox="0 0 390 300" width="390" height="300" xmlns="http://www.w3.org/2000/svg">
          <rect width="390" height="300" fill="url(#sky-night)"/>

          <!-- Night Stars Framed Inside the Arch -->
          <g fill="#FFF2CC">
            <circle cx="118" cy="78" r="1.1" opacity="0.8"/>
            <circle cx="276" cy="72" r="1.2" opacity="0.85"/>
            <circle cx="144" cy="112" r="0.9" opacity="0.6"/>
            <circle cx="252" cy="118" r="1" opacity="0.65"/>
          </g>

          <!-- Distant Night Roofs & Warm Windows -->
          <path d="M52,230 L92,216 L128,218 L142,208 L166,222 L238,224 L262,210 L295,214 L338,228 Z" fill="#2A1C30"/>
          <rect x="98" y="220" width="4" height="5" fill="#FFE08C" opacity="0.8"/>
          <rect x="278" y="218" width="4" height="5" fill="#FFE08C" opacity="0.8"/>

          <!-- Framing Archway Lit from Within by the Suspended Lantern -->
          <path d="M0,0 L390,0 L390,285 L344,285 L344,136 C344,58 282,18 195,18 C108,18 46,58 46,136 L46,285 L0,285 Z" fill="#1C1526"/>
          <path d="M195,18 C282,18 344,58 344,136 L344,275 L353,275 L353,134 C353,50 288,9 195,9 C102,9 37,50 37,134 L37,275 L46,275 L46,136 C46,58 108,18 195,18 Z" fill="#8C5642"/>

          <!-- Radiant Night Lantern Glow -->
          <g transform="translate(195, 18)">
            <circle cx="0" cy="76" r="68" fill="url(#lantern-halo-night)"/>
            <line x1="0" y1="0" x2="0" y2="46" stroke="#140F1C" stroke-width="2"/>
            <path d="M-12,42 C-6,36 6,36 12,42" stroke="#140F1C" stroke-width="1.6" fill="none"/>
            <path d="M-15,54 C-12,44 12,44 15,54 Z" fill="#1E1629"/>
            <rect x="-17" y="54" width="34" height="3" rx="1.5" fill="#2B1F38"/>
            <polygon points="-13,57 13,57 9,85 -9,85" fill="#FFF3BD" stroke="#1E1629" stroke-width="1.8"/>
            <line x1="-5" y1="57" x2="-3.5" y2="85" stroke="#1E1629" stroke-width="1.3"/>
            <line x1="5" y1="57" x2="3.5" y2="85" stroke="#1E1629" stroke-width="1.3"/>
            <path d="M0,65 C3.5,71 3.5,77 0,80 C-3.5,77 -3.5,71 0,65 Z" fill="#FFB038"/>
            <path d="M-9,85 L9,85 L0,94 Z" fill="#1E1629"/>
          </g>

          <use href="#bougainvillea-spray-night" transform="translate(42, 54) rotate(28) scale(0.92)"/>
          <use href="#bougainvillea-spray-night" transform="translate(314, 48) rotate(138) scale(0.92)"/>

          <rect y="216" width="390" height="84" fill="url(#cream-melt-night)"/>
          <rect width="390" height="300" filter="url(#gouache-paper)" opacity="0.65"/>
        </svg>

        <div class="overlay">
          <div class="top-bar">
            <div class="brand">🗝 Traike</div>
            <div class="pill">◎ Skip · Try first</div>
          </div>
          <div class="copy centered">
            <h2>Sign in to Traike</h2>
          </div>
        </div>
      </div>
      <div class="sheet-stub"><span>Walks built around you</span><span>Save &amp; sync</span></div>
    </div>
  </div>


  <!-- =========================================================
       6A. ME — DAY (Plain Painterly Sunset Harmonized with Family)
       ========================================================= -->
  <div class="card-wrap">
    <div class="card-label"><span>06 · Me</span><span>Day · Plain Sunset</span></div>
    <div class="phone-frame">
      <div class="hero-box">
        <svg viewBox="0 0 390 300" width="390" height="300" xmlns="http://www.w3.org/2000/svg">
          <rect width="390" height="300" fill="url(#sky-day)"/>
          <!-- Soft luminous horizon bloom & delicate gouache sky wash only -->
          <ellipse cx="235" cy="196" rx="165" ry="58" fill="#FFD996" opacity="0.28"/>
          <path d="M60,138 C145,128 255,130 345,140 C265,147 140,146 60,138 Z" fill="#F7C582" opacity="0.18"/>
          <rect y="214" width="390" height="86" fill="url(#cream-melt-day)"/>
          <rect width="390" height="300" filter="url(#gouache-paper)" opacity="0.7"/>
        </svg>

        <div class="overlay">
          <div class="top-bar">
            <div class="brand">🗝 Traike</div>
            <div class="pill">◎ Habima · Tel Aviv</div>
          </div>
          <div class="copy">
            <h2>Yael Mizrahi</h2>
            <p>yael@traike.app · 12 walks</p>
          </div>
        </div>
      </div>
      <div class="sheet-stub"><span>Walking preferences</span><span>Day · EN</span></div>
    </div>
  </div>

  <!-- =========================================================
       6B. ME — NIGHT (Plain Painterly Dusk Harmonized with Family)
       ========================================================= -->
  <div class="card-wrap">
    <div class="card-label"><span>06 · Me</span><span>Night · Plain Dusk</span></div>
    <div class="phone-frame">
      <div class="hero-box">
        <svg viewBox="0 0 390 300" width="390" height="300" xmlns="http://www.w3.org/2000/svg">
          <rect width="390" height="300" fill="url(#sky-night)"/>
          <ellipse cx="235" cy="202" rx="165" ry="56" fill="#E89A61" opacity="0.22"/>
          <circle cx="282" cy="64" r="1" fill="#FFF2CC" opacity="0.65"/>
          <circle cx="326" cy="86" r="1.2" fill="#FFF2CC" opacity="0.7"/>
          <rect y="214" width="390" height="86" fill="url(#cream-melt-night)"/>
          <rect width="390" height="300" filter="url(#gouache-paper)" opacity="0.65"/>
        </svg>

        <div class="overlay">
          <div class="top-bar">
            <div class="brand">🗝 Traike</div>
            <div class="pill">◎ Habima · Tel Aviv</div>
          </div>
          <div class="copy">
            <h2>Yael Mizrahi</h2>
            <p>yael@traike.app · 12 walks</p>
          </div>
        </div>
      </div>
      <div class="sheet-stub"><span>Walking preferences</span><span>Night · EN</span></div>
    </div>
  </div>

</main>

</body>
</html>