"use client";

/** Reload the page: a phone browser has no easy reload once the app is added to the home screen. */
export function RefreshButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      aria-label="Refresh"
      className="flex h-11 items-center gap-1.5 rounded-full border border-charcoal/10 bg-paper/95 px-3 text-[13px] font-medium text-charcoal/80 shadow-sm"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M20 12a8 8 0 1 1-2.6-5.9" />
        <path d="M20 4v5h-5" />
      </svg>
      Refresh
    </button>
  );
}
