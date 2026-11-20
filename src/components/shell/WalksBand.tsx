"use client";

import { useEffect, useState } from "react";

import { BandStat, BandTitle, ScreenBand } from "@/components/shell/ScreenBand";
import { withWalkClient } from "@/lib/walks/walk-history";

const COPY = {
  en: { title: "Walks", done: "walks done" },
  he: { title: "הליכות", done: "הליכות שהושלמו" },
} as const;

/** The top of the Walks screen: the Jaffa sunset, the title, and the walked count as a designed number. */
export function WalksBand({ lang, signedIn }: { lang: "he" | "en"; signedIn: boolean }) {
  const t = COPY[lang];
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    void withWalkClient(async (client, userId) => (await import("@/lib/walks/saved-walks")).countMyWalkedWalks(client, userId)).then((n) => {
      if (live && typeof n === "number") setCount(n);
    });
    return () => {
      live = false;
    };
  }, [signedIn]);

  return (
    <ScreenBand art="walks">
      <BandTitle className="mt-5">{t.title}</BandTitle>
      {count !== null ? <BandStat value={count} label={t.done} /> : null}
    </ScreenBand>
  );
}
