"use client";

import { useEffect, useState } from "react";

import { START_LOCATION_EVENT, loadSavedStart } from "@/lib/start-location";

const DEFAULT_LABEL = { en: "My location", he: "המיקום שלי" } as const;

/** "הבימה, תל אביב-יפו, ישראל" reads as "הבימה · תל אביב-יפו": the first two parts, as the mockup's "Habima · Tel Aviv". */
function shortLabel(label: string): string {
  const parts = label.split(",").map((p) => p.trim()).filter(Boolean);
  return parts.slice(0, 2).join(" · ");
}

/** The name of the walk's start: the place the walker picked, else "My location". Read on the client only. */
export function useStartLabel(lang: "he" | "en"): string {
  const [saved, setSaved] = useState<string | null>(null);
  useEffect(() => {
    const read = () => {
      const s = loadSavedStart();
      setSaved(s && s.label !== "My last location" ? shortLabel(s.label) : null);
    };
    read();
    window.addEventListener(START_LOCATION_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(START_LOCATION_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);
  return saved ?? DEFAULT_LABEL[lang];
}

/** Round 13 location control, option B (champagne, no flares): shows where the walk starts; a tap changes it. */
export function LocationChip({ lang, onClick, label }: { lang: "he" | "en"; onClick: () => void; label?: string }) {
  const start = useStartLabel(lang);
  return (
    <button
      type="button"
      onClick={onClick}
      dir={lang === "he" ? "rtl" : "ltr"}
      className="tk-champagne flex h-9 min-w-0 max-w-[64%] items-center gap-2 py-[5px] pe-[15px] ps-3 text-[16px] leading-none tracking-[0.02em]"
    >
      <span aria-hidden className="tk-champagne-ring" />
      <span className="min-w-0 truncate">{label ?? start}</span>
    </button>
  );
}
