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
    <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      {isRecording ? (
        <div className="flex items-center gap-2 text-sm text-slate-700">
          <span
            className="h-2 w-2 animate-pulse rounded-full bg-emerald-500"
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
            className="inline-flex h-9 flex-1 items-center justify-center rounded-md bg-emerald-600 px-3 text-sm font-medium text-white transition hover:bg-emerald-500"
          >
            GPX
          </button>
          {onDownloadCsv ? (
            <button
              type="button"
              onClick={onDownloadCsv}
              className="inline-flex h-9 flex-1 items-center justify-center rounded-md border border-emerald-600 px-3 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50"
            >
              CSV
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
