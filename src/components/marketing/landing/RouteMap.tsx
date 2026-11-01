/* Stand-in trail map drawn as SVG (phase 1). Phase 2 swaps the paper for
   generated map plates; the route and pins stay live SVG so they never blur.
   `slice` makes the art cover any container the way object-fit: cover does. */

type Variant = "landscape" | "portrait";
type Look = "after" | "before";

const ART = {
  landscape: {
    w: 1200,
    h: 800,
    route:
      "M150 650 C 260 560 330 430 470 430 C 620 430 640 560 780 520 C 920 480 930 300 1040 230",
    pins: [
      [150, 650],
      [780, 520],
      [1040, 230],
    ],
    loop: "M190 600 C 300 700 520 720 640 640 C 760 560 700 380 560 340 C 420 300 250 360 190 600",
    lake: "M820 120 C 930 90 1040 130 1010 200 C 980 270 860 270 800 220 C 760 180 770 140 820 120Z",
    woods: [
      "M120 120 C 220 80 330 110 340 190 C 350 270 230 300 150 260 C 90 230 80 150 120 120Z",
      "M900 560 C 990 520 1100 560 1110 650 C 1120 730 1000 760 930 720 C 870 690 850 590 900 560Z",
    ],
  },
  portrait: {
    w: 600,
    h: 1100,
    route:
      "M110 960 C 170 820 120 700 260 640 C 400 580 420 470 330 380 C 250 300 330 200 440 170",
    pins: [
      [110, 960],
      [260, 640],
      [440, 170],
    ],
    loop: "M130 900 C 240 1000 440 990 480 860 C 520 740 380 700 300 640 C 220 580 160 700 130 900",
    lake: "M380 760 C 470 740 560 790 540 860 C 520 930 420 940 370 900 C 330 860 330 780 380 760Z",
    woods: [
      "M60 120 C 150 70 250 100 260 180 C 270 260 170 300 100 260 C 40 230 20 160 60 120Z",
      "M360 980 C 440 950 540 990 550 1060 C 555 1110 440 1110 380 1080 C 330 1050 320 1000 360 980Z",
    ],
  },
} as const;

export function RouteMap({
  variant = "landscape",
  look = "after",
  className,
}: {
  variant?: Variant;
  look?: Look;
  className?: string;
}) {
  const a = ART[variant];
  const grey = look === "before";
  const pinW = variant === "portrait" ? 64 : 74;

  return (
    <svg
      viewBox={`0 0 ${a.w} ${a.h}`}
      preserveAspectRatio="xMidYMid slice"
      className={className}
      role="img"
      aria-label={grey ? "A fixed tour route" : "A walk route built for you"}
      style={grey ? { filter: "grayscale(1) brightness(1.04)" } : undefined}
    >
      <rect width={a.w} height={a.h} fill="#f3ead9" />
      {/* soft contour rings */}
      <g fill="none" stroke="#d8c8a2" strokeWidth="2" opacity="0.7">
        {[0.15, 0.32, 0.5, 0.68, 0.86].map((t) => (
          <ellipse
            key={t}
            cx={a.w * 0.52}
            cy={a.h * 0.48}
            rx={a.w * (0.1 + t * 0.55)}
            ry={a.h * (0.08 + t * 0.5)}
            transform={`rotate(-12 ${a.w / 2} ${a.h / 2})`}
          />
        ))}
      </g>
      {a.woods.map((d) => (
        <path key={d} d={d} fill="#9fb691" opacity="0.8" />
      ))}
      <path d={a.lake} fill="#a9cbd6" />

      {grey ? (
        <path
          d={a.loop}
          fill="none"
          stroke="#8a8a8a"
          strokeWidth="6"
          strokeDasharray="14 12"
          strokeLinecap="round"
        />
      ) : (
        <>
          <path d={a.route} fill="none" stroke="#fbf8f4" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />
          <path d={a.route} fill="none" stroke="#c15f3c" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}

      {a.pins.map(([x, y]) => (
        <image
          key={`${x}-${y}`}
          href="/images/traike/3d/pin.png"
          x={x - pinW / 2}
          y={y - pinW * 0.95}
          width={pinW}
          height={pinW}
        />
      ))}
    </svg>
  );
}
