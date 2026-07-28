import { Card } from "@/components/ui";
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
    <section className="space-y-2 rounded-lg border border-charcoal/10 p-3">
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
    <Card className="space-y-3">
      <div>
        <h2 className="font-display text-base font-bold text-forest">Trail Briefing</h2>
        <p className="text-xs text-charcoal/60">
          Route context, timing guidance, and safety confidence.
        </p>
      </div>

      {isLoading && (
        <p className="rounded-md bg-cream/70 p-3 text-sm text-charcoal/60">
          Building route briefing...
        </p>
      )}

      {error && !isLoading && (
        <div className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
      )}

      {!report && !isLoading && !error && (
        <p className="rounded-md bg-cream/70 p-3 text-sm text-charcoal/60">
          Select or calculate a route to see the trail briefing.
        </p>
      )}

      {report && !isLoading && (
        <div className="space-y-3">
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

          <section className="space-y-2 rounded-lg border border-charcoal/10 p-3">
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
    </Card>
  );
}
