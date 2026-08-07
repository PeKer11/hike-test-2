/**
 * DESIGN EXPLORATION — not production, not linked from any nav.
 *
 * A dark, card-based reimagining of the Active Walk screen, borrowing the visual
 * language of a smart-home control app: hero photo card on top, device-style
 * control cards below, warm amber accent on near-black, bottom tab bar with a
 * floating action button. All data here is mock.
 */

const walk = {
  routeName: "Neve Tzedek Loop",
  city: "Tel Aviv",
  progressPct: 62,
  nextStop: "Suzanne Dellal Centre",
  nextStopMinutes: 7,
  distanceRemainingKm: 1.8,
  distanceWalkedKm: 2.9,
  elapsed: "38:12",
  paceMinPerKm: 13.4,
  targetPaceMinPerKm: 15,
  stopsDone: 4,
  stopsTotal: 7,
};

const AMBER = "#f0a04b";

function ChevronLeft() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M15 5 8 12l7 7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Dots() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

/** Stylised map card: a gradient "city" plate with the walked/remaining route drawn on it. */
function RoutePlate() {
  return (
    <svg viewBox="0 0 400 260" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="plate" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2c3a33" />
          <stop offset="55%" stopColor="#1d2822" />
          <stop offset="100%" stopColor="#141a17" />
        </linearGradient>
        <linearGradient id="walked" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#f6c177" />
          <stop offset="100%" stopColor={AMBER} />
        </linearGradient>
      </defs>
      <rect width="400" height="260" fill="url(#plate)" />
      {/* faint street grid */}
      <g stroke="#ffffff" strokeOpacity="0.05" strokeWidth="1">
        {[40, 100, 160, 220, 280, 340].map((x) => (
          <line key={x} x1={x} y1="0" x2={x - 30} y2="260" />
        ))}
        {[50, 110, 170, 230].map((y) => (
          <line key={y} x1="0" y1={y} x2="400" y2={y + 18} />
        ))}
      </g>
      {/* remaining leg */}
      <path
        d="M232 128 C270 150 300 120 322 78"
        stroke="#ffffff"
        strokeOpacity="0.28"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="2 10"
        fill="none"
      />
      {/* walked leg */}
      <path
        d="M62 208 C96 168 108 196 148 172 C186 150 196 152 232 128"
        stroke="url(#walked)"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="62" cy="208" r="6" fill="#ffffff" fillOpacity="0.5" />
      <circle cx="322" cy="78" r="6" fill="#ffffff" fillOpacity="0.35" />
      {/* current position */}
      <circle cx="232" cy="128" r="16" fill={AMBER} fillOpacity="0.18" />
      <circle cx="232" cy="128" r="7" fill={AMBER} stroke="#141a17" strokeWidth="3" />
    </svg>
  );
}

function StatCard({
  label,
  value,
  unit,
  detail,
  accent = false,
}: {
  label: string;
  value: string;
  unit?: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl p-5 ${
        accent ? "bg-[#f0a04b] text-[#1a1207]" : "bg-[#1c1a17] text-white"
      }`}
    >
      <p
        className={`text-xs font-medium tracking-wide uppercase ${
          accent ? "text-[#1a1207]/60" : "text-white/40"
        }`}
      >
        {label}
      </p>
      <p className="mt-6 text-3xl font-semibold tabular-nums">
        {value}
        {unit ? (
          <span
            className={`ml-1 text-base font-normal ${
              accent ? "text-[#1a1207]/60" : "text-white/40"
            }`}
          >
            {unit}
          </span>
        ) : null}
      </p>
      <p className={`mt-1 text-sm ${accent ? "text-[#1a1207]/70" : "text-white/45"}`}>
        {detail}
      </p>
    </div>
  );
}

/** Slider-style control card, the walking analogue of the reference's light dimmer. */
function PaceCard() {
  const fill = Math.round((walk.targetPaceMinPerKm / 22) * 100);
  return (
    <div className="rounded-3xl bg-[#1c1a17] p-5">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-medium tracking-wide text-white/40 uppercase">
          Target pace
        </p>
        <p className="text-sm text-white/45">
          you&apos;re {(walk.targetPaceMinPerKm - walk.paceMinPerKm).toFixed(1)} min/km
          ahead
        </p>
      </div>
      <div className="mt-5 h-14 overflow-hidden rounded-2xl bg-[#262320]">
        <div
          className="flex h-full items-center justify-between px-4"
          style={{
            width: `${fill}%`,
            background: `linear-gradient(90deg, #f6c177, ${AMBER})`,
          }}
        >
          <span className="text-sm font-semibold text-[#1a1207]">
            {walk.targetPaceMinPerKm} min/km
          </span>
          <span className="h-6 w-1 rounded-full bg-[#1a1207]/30" />
        </div>
      </div>
      <div className="mt-3 flex justify-between text-xs text-white/30">
        <span>brisk</span>
        <span>strolling</span>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  detail,
  on,
}: {
  label: string;
  detail: string;
  on: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-3xl bg-[#1c1a17] px-5 py-4">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="mt-0.5 text-xs text-white/40">{detail}</p>
      </div>
      <span
        className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 ${
          on ? "justify-end bg-[#f0a04b]" : "justify-start bg-[#332f2a]"
        }`}
      >
        <span className="h-5 w-5 rounded-full bg-white" />
      </span>
    </div>
  );
}

const TABS = ["Walk", "Map", "Stops", "You"];

export default function ActiveWalkPreviewPage() {
  return (
    <main className="min-h-screen bg-[#100e0c] text-white">
      <div className="mx-auto w-full max-w-md px-5 pt-6 pb-32">
        <header className="flex items-center justify-between text-white/70">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1c1a17]"
            aria-label="Back"
          >
            <ChevronLeft />
          </button>
          <div className="text-center">
            <p className="text-xs tracking-wide text-white/35 uppercase">
              {walk.city}
            </p>
            <p className="text-sm font-medium text-white">Active walk</p>
          </div>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1c1a17]"
            aria-label="More"
          >
            <Dots />
          </button>
        </header>

        {/* Hero card — the reference's bedroom photo, here the live route */}
        <section className="mt-6 overflow-hidden rounded-[2rem] bg-[#1c1a17]">
          <div className="relative h-56">
            <RoutePlate />
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#141a17] to-transparent" />
            <span className="absolute top-4 left-4 rounded-full bg-black/40 px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur-sm">
              {walk.stopsDone} of {walk.stopsTotal} stops
            </span>
          </div>
          <div className="px-5 pt-4 pb-5">
            <h1 className="text-xl font-semibold">{walk.routeName}</h1>
            <p className="mt-1 text-sm text-white/45">
              Next: {walk.nextStop} · {walk.nextStopMinutes} min
            </p>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#2a2622]">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${walk.progressPct}%`,
                  background: `linear-gradient(90deg, #f6c177, ${AMBER})`,
                }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-white/40">
              <span>{walk.progressPct}% complete</span>
              <span>{walk.distanceWalkedKm} km walked</span>
            </div>
          </div>
        </section>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <StatCard
            label="Remaining"
            value={walk.distanceRemainingKm.toFixed(1)}
            unit="km"
            detail="≈ 24 min at your pace"
          />
          <StatCard
            label="Elapsed"
            value={walk.elapsed}
            detail="started 09:14"
          />
          <StatCard
            label="Pace"
            value={walk.paceMinPerKm.toFixed(1)}
            unit="min/km"
            detail="faster than usual"
            accent
          />
          <StatCard
            label="Next stop"
            value={String(walk.nextStopMinutes)}
            unit="min"
            detail={walk.nextStop}
          />
        </div>

        <div className="mt-4">
          <PaceCard />
        </div>

        <div className="mt-4 space-y-3">
          <ToggleRow
            label="Voice guidance"
            detail="Spoken cues at each turn"
            on
          />
          <ToggleRow
            label="Off-route alerts"
            detail="Nudge me if I drift 60 m"
            on
          />
          <ToggleRow
            label="Discover nearby"
            detail="Suggest unplanned stops"
            on={false}
          />
        </div>
      </div>

      {/* Bottom tab bar with floating action button */}
      <nav className="fixed inset-x-0 bottom-0">
        <div className="mx-auto max-w-md px-5 pb-6">
          <div className="relative flex items-center justify-between rounded-full bg-[#1c1a17] px-7 py-4">
            {TABS.map((tab, i) => (
              <span
                key={tab}
                className={`text-xs ${
                  i === 0 ? "font-semibold text-[#f0a04b]" : "text-white/40"
                } ${i === 1 ? "mr-12" : ""}`}
              >
                {tab}
              </span>
            ))}
            <button
              type="button"
              className="absolute -top-6 left-1/2 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-[#f0a04b] text-2xl text-[#1a1207] shadow-lg shadow-black/50"
              aria-label="Pause walk"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
                <rect x="7" y="5" width="4" height="14" rx="1.5" />
                <rect x="13" y="5" width="4" height="14" rx="1.5" />
              </svg>
            </button>
          </div>
        </div>
      </nav>
    </main>
  );
}
