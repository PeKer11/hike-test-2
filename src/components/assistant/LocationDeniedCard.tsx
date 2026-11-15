"use client";

import { useState } from "react";

import { currentLocateLang, locateCopy } from "@/lib/geo/locate-copy";

/** Shown when the browser has blocked location: one calm card, two ways forward. */
export function LocationDeniedCard({ onSearch }: { onSearch: () => void }) {
  const [showHow, setShowHow] = useState(false);
  const t = locateCopy[currentLocateLang()];
  return (
    <div role="status" data-testid="location-denied" className="mt-2 rounded-[10px] bg-paper px-3 py-2 shadow-tk-soft">
      <p className="text-[14px] font-semibold text-tk-body">{t.deniedTitle}</p>
      <div className="mt-1.5 flex gap-2">
        <button
          type="button"
          onClick={onSearch}
          className="min-h-9 rounded-full bg-tk-send px-3 text-[13px] font-semibold text-on-accent"
        >
          {t.search}
        </button>
        <button
          type="button"
          onClick={() => setShowHow((v) => !v)}
          aria-expanded={showHow}
          className="min-h-9 rounded-full px-3 text-[13px] font-semibold text-tk-wordmark hover:bg-tk-send/10"
        >
          {t.how}
        </button>
      </div>
      {showHow ? (
        <ul className="mt-1.5 space-y-1 text-[13px] text-tk-body" dir="auto">
          <li>{t.howIos}</li>
          <li>{t.howAndroid}</li>
        </ul>
      ) : null}
    </div>
  );
}
