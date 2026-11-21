"use client";

import { Segmented } from "@/components/shell/Segmented";
import type { WalksSummary } from "@/lib/hooks/useWalksSummary";

export type WalksTabId = "saved" | "walked" | "friends";

const COPY = {
  en: { saved: "Saved", walked: "Walked", friends: "Friends", label: "Filter walks" },
  he: { saved: "שמורים", walked: "הושלמו", friends: "חברים", label: "סינון מסלולים" },
} as const;

/** Saved / Walked / Friends (round 13): the one row under the Walks band, with counts once they are known. */
export function WalksTabs({ lang, value, summary, onChange }: { lang: "he" | "en"; value: WalksTabId; summary: WalksSummary | null; onChange: (id: WalksTabId) => void }) {
  const t = COPY[lang];
  const n = (count: number | undefined) => (count === undefined ? "" : ` (${count})`);
  return (
    <div className="border-b border-tk-hair px-4 py-3">
      <Segmented
        label={t.label}
        value={value}
        onChange={onChange}
        items={[
          { id: "saved", label: `${t.saved}${n(summary?.saved)}` },
          { id: "walked", label: `${t.walked}${n(summary?.walked)}` },
          { id: "friends", label: `${t.friends}${n(summary?.friends)}` },
        ]}
      />
    </div>
  );
}
