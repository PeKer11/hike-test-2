export interface WalkAlertAction {
  label: string;
  onClick: () => void;
  /** The one button that does the thing; everything else is a quiet option. */
  primary?: boolean;
}

export interface WalkAlert {
  /** Changes when the card is about something new, so React re-mounts it. */
  id: string;
  tone: "alert" | "info";
  icon?: string;
  title: string;
  /** A place name (user-edited map data): shown with dir="auto" under the title. */
  subject?: string;
  body?: string;
  /** One extra line under the body ("While you're here: …"); place names, so dir="auto". */
  note?: string;
  actions: WalkAlertAction[];
}

/**
 * The one card that may sit above the stats bar during a walk. A single slot, not
 * a stack: a walker looking at a phone on the move can take in one question at a
 * time, so the caller decides which of off-route, a pace question or a pace offer
 * wins and hands over just that.
 */
export function WalkAlertCard({ alert }: { alert: WalkAlert }) {
  const accent =
    alert.tone === "alert" ? "border-red-500/70" : "border-forest/25";

  return (
    <div
      role="alert"
      className={`pointer-events-auto rounded-2xl border-s-4 ${accent} bg-cream/95 p-3 text-forest shadow-[0_4px_20px_rgba(30,61,47,0.12)] backdrop-blur`}
    >
      <div className="flex items-start gap-2">
        {alert.icon ? (
          <span aria-hidden className="text-lg leading-none">
            {alert.icon}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug">{alert.title}</p>
          {alert.subject ? (
            <p dir="auto" className="mt-0.5 truncate text-sm text-forest">
              {alert.subject}
            </p>
          ) : null}
          {alert.body ? (
            <p className="mt-0.5 text-xs leading-snug text-charcoal/70">
              {alert.body}
            </p>
          ) : null}
          {alert.note ? (
            <p dir="auto" className="mt-1 text-xs leading-snug text-forest">
              {alert.note}
            </p>
          ) : null}
        </div>
      </div>
      {alert.actions.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {alert.actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              className={
                action.primary
                  ? "flex-1 rounded-lg bg-terra px-3 py-2 text-xs font-semibold text-white transition hover:bg-terra/90"
                  : "flex-1 rounded-lg border border-forest/25 px-3 py-2 text-xs font-semibold text-forest transition hover:bg-forest/10"
              }
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
