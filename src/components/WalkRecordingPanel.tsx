"use client";

interface WalkRecordingPanelProps {
  isRecording: boolean;
  pointCount: number;
  onDownload: () => void;
  onDownloadCsv?: () => void;
}

export function WalkRecordingPanel({
  isRecording,
  pointCount,
  onDownload,
  onDownloadCsv,
}: WalkRecordingPanelProps) {
  if (!isRecording && pointCount === 0) {
    return null;
  }

  const plural = pointCount === 1 ? "" : "s";

  return (
    <section className="space-y-2 rounded-lg border border-charcoal/10 bg-white p-3 shadow-sm">
      {isRecording ? (
        <div className="flex items-center gap-2 text-sm text-charcoal/80">
          <span
            className="h-2 w-2 animate-pulse rounded-full bg-terra"
            aria-hidden="true"
          />
          <span>
            Recording · {pointCount} point{plural} captured
          </span>
        </div>
      ) : null}

      {pointCount > 0 ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onDownload}
            className="inline-flex h-9 flex-1 items-center justify-center rounded-md bg-terra px-3 text-sm font-medium text-white transition hover:bg-terra/90"
          >
            GPX
          </button>
          {onDownloadCsv ? (
            <button
              type="button"
              onClick={onDownloadCsv}
              className="inline-flex h-9 flex-1 items-center justify-center rounded-md border border-terra px-3 text-sm font-medium text-terra transition hover:bg-terra/10"
            >
              CSV
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
