"use client";

import { BandMeta, BandTitle, ScreenBand } from "@/components/shell/ScreenBand";
import { LocationChip } from "@/components/shell/LocationChip";
import type { WalksSummary } from "@/lib/hooks/useWalksSummary";

const COPY = {
  en: { title: "My walks & friends", walks: (n: number) => `${n} ${n === 1 ? "walk" : "walks"}`, km: "km" },
  he: { title: "המסלולים שלי וחברים", walks: (n: number) => `${n} הליכות`, km: "ק״מ" },
} as const;

/** The top of Walks and Friends (round 13): the Jaffa sunset, "My walks & friends", and the walked count with kilometres. */
export function WalksBand({ lang, summary, art = "walks", actions }: { lang: "he" | "en"; summary: WalksSummary | null; art?: "walks" | "friends"; actions?: React.ReactNode }) {
  const t = COPY[lang];
  return (
    <ScreenBand
      art={art}
      tall
      actions={
        <>
          {actions}
          <LocationChip lang={lang} onClick={() => window.history.pushState(null, "", "/app?view=plan")} />
        </>
      }
    >
      <BandTitle className="mt-[14px]">{t.title}</BandTitle>
      {summary && summary.walked > 0 ? (
        <BandMeta>
          <bdi>{t.walks(summary.walked)}</bdi> · <bdi>{summary.km.toFixed(1)}</bdi> {t.km}
        </BandMeta>
      ) : null}
    </ScreenBand>
  );
}
