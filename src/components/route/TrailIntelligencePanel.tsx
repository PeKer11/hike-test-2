import type {
  TrailBriefingItem,
  TrailBriefingLevel,
  TrailIntelligenceReport,
} from "@/lib/types";

interface TrailIntelligencePanelProps {
  report: TrailIntelligenceReport | null;
  isLoading: boolean;
  error?: string | null;
}

const levelClasses: Record<TrailBriefingLevel, string> = {
  go: "bg-forest/10 text-forest border-forest/20",
  caution: "bg-amber-50 text-amber-700 border-amber-200",
  "no-go": "bg-rose-50 text-rose-700 border-rose-200",
};

function ItemSection({ item }: { item: TrailBriefingItem }) {
  return (
    <section className="space-y-2 rounded-[6px] border border-tk-line bg-[#fffdf9] p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-forest">{item.title}</h3>
        <span className="rounded-full bg-cream px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-charcoal/70">
          {item.sourceStatus}
        </span>
      </div>
      {item.level && (
        <div
          className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${levelClasses[item.level]}`}
        >
          {item.level}
        </div>
      )}
      <p className="text-sm text-charcoal/80">{item.summary}</p>
      <ul className="space-y-1 text-xs text-charcoal/70">
        {item.details.map((detail) => (
          <li key={detail}>{detail}</li>
        ))}
      </ul>
    </section>
  );
}

export function TrailIntelligencePanel({
  report,
  isLoading,
  error,
}: TrailIntelligencePanelProps) {
  return (
    <section data-mock="trail" className="relative rounded-tk-card bg-tk-card px-[17px] pb-[18px] pt-[14px] shadow-tk-card">
      {/* eslint-disable @next/next/no-img-element */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-tk-card">
        <div className="absolute -right-[10px] -top-[10px] h-[90px] w-[190px] bg-[radial-gradient(closest-side,rgba(231,210,176,0.55),rgba(231,210,176,0))]" />
        <img src="/images/traike/folded-map.svg" alt="" className="absolute right-[34px] top-[6px] w-[120px] -rotate-[8deg] opacity-[0.12]" />
      </div>
      <img src="/images/traike/olive-leaves.svg" alt="" aria-hidden className="pointer-events-none absolute right-[44px] top-[2px] w-[44px] -rotate-[25deg]" />
      <img src="/images/traike/olive-leaves.svg" alt="" aria-hidden className="pointer-events-none absolute -right-[8px] top-[52px] w-[30px] rotate-[95deg]" />
      <img data-mock="compass" src="/images/traike/compass.svg" alt="" aria-hidden className="pointer-events-none absolute -right-[12px] -top-[3px] z-10 h-[70px] w-[70px] @4xl:-right-[10px] @4xl:h-[60px] @4xl:w-[60px] @6xl:-right-[12px] @6xl:h-[70px] @6xl:w-[70px]" />
      {/* eslint-enable @next/next/no-img-element */}
      <div className="relative pr-[58px]">
        <h2 className="font-display text-[20.3px] font-[650] leading-none tracking-[-0.015em] text-tk-ink @4xl:text-[18px] @6xl:text-[20.3px]">Trail Briefing</h2>
        <p className="mt-[4px] text-[12.2px] leading-[16px] text-[#363941]">
          Route context, timing guidance, and safety confidence.
        </p>
      </div>

      {isLoading && (
        <div className="relative mt-[11px] flex min-h-[51px] items-center rounded-[6px] border border-tk-line bg-tk-well py-[8px] ps-[12px] pe-[11px]">
          <p className="text-[13.6px] leading-[18px] text-tk-body">Building route briefing...</p>
        </div>
      )}

      {error && !isLoading && (
        <div className="relative mt-[11px] rounded-[6px] bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
      )}

      {!report && !isLoading && !error && (
        <div data-mock="trail-inner" className="relative mt-[11px] flex min-h-[51px] items-center justify-between gap-3 rounded-[6px] border border-tk-line bg-tk-well py-[8px] ps-[12px] pe-[11px]">
          <p className="text-[13.6px] leading-[18px] text-tk-body">Select or calculate a route to see the trail briefing.</p>
          <svg aria-hidden viewBox="0 0 24 24" className="h-[21px] w-[21px] shrink-0 text-tk-sage" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round">
            <path d="M9 4 3 6.5V20l6-2.5 6 2.5 6-2.5V4l-6 2.5L9 4Z" />
            <path d="M9 4v13.5M15 6.5V20" />
          </svg>
        </div>
      )}

      {report && !isLoading && (
        <div className="relative mt-[11px] space-y-2">
          <div className={`rounded-lg border p-3 ${levelClasses[report.recommendation.level]}`}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">{report.recommendation.title}</h3>
              <span className="text-[11px] uppercase tracking-wide">
                {report.regionLabel}
              </span>
            </div>
            <p className="mt-1 text-sm">{report.recommendation.summary}</p>
            <ul className="mt-2 space-y-1 text-xs">
              {report.recommendation.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>

          <ItemSection item={report.routeSummary} />
          <ItemSection item={report.bestTime} />
          <ItemSection item={report.currentConditions} />
          <ItemSection item={report.safety} />

          <section className="space-y-2 rounded-[6px] border border-tk-line bg-[#fffdf9] p-3">
            <h3 className="text-sm font-semibold text-forest">Source coverage</h3>
            <ul className="space-y-2 text-xs text-charcoal/70">
              {report.sourceNotes.map((note) => (
                <li key={note.source} className="rounded-md bg-cream/70 p-2">
                  <div className="font-medium text-charcoal/80">
                    {note.source} <span className="text-charcoal/40">({note.status})</span>
                  </div>
                  <div>{note.summary}</div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </section>
  );
}
