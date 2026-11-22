"use client";

import { useCallback, useEffect, useState } from "react";

import type { AssistantDefaults, TasteLevel } from "@/lib/assistant/defaults";
import { chipCell } from "@/components/ui/panel-style";

const STORAGE_KEY = "traike.assistantDefaults.v1";

export type AssistantLang = "en" | "he";

export const PACE_PRESETS: Array<{ label: string; value: number }> = [
  { label: "Very slow", value: 25 },
  { label: "Slow", value: 20 },
  { label: "Normal", value: 15 },
  { label: "Brisk", value: 12 },
  { label: "Fast", value: 10 },
];

const PACE_HE: Record<number, string> = { 25: "איטי מאוד", 20: "איטי", 15: "רגיל", 12: "מהיר", 10: "מהיר מאוד" };

/**
 * A pace preset's name, with its value when asked. The pace is shown in ONE unit everywhere (minutes per kilometre, the
 * unit it is stored and typed in); a speed in km/h only ever describes how fast someone is moving right now.
 */
export function paceLabel(p: { label: string; value: number }, lang: AssistantLang, withValue: boolean): string {
  const name = lang === "he" ? (PACE_HE[p.value] ?? p.label) : p.label;
  return withValue ? `${name} (${p.value} ${lang === "he" ? "דק׳/ק״מ" : "min/km"})` : name;
}

const KINDS: Array<{ key: string; label: string; he: string }> = [
  { key: "landmark", label: "Landmarks", he: "אתרים" },
  { key: "museum", label: "Museums", he: "מוזיאונים" },
  { key: "park", label: "Parks", he: "פארקים" },
  { key: "food", label: "Food & Cafes", he: "אוכל ובתי קפה" },
  { key: "viewpoint", label: "Viewpoints", he: "תצפיות" },
  { key: "religious", label: "Religious sites", he: "אתרים דתיים" },
  { key: "nature", label: "Nature", he: "טבע" },
  { key: "entertainment", label: "Entertainment", he: "בילוי" },
  { key: "shopping", label: "Shopping", he: "קניות" },
];

const COPY = {
  en: { hint: "Used when you do not say otherwise. Leave a box empty for no limit.", noLimit: "No limit", pace: "Walking pace", notSure: "Not sure", like: "What I like (for “surprise me”)", less: "Less", normal: "Normal", more: "More", soft: "A soft lean, not a filter: I still mix in other kinds and learn from the walks you take." },
  he: { hint: "בשימוש כשלא אומרים אחרת. תיבה ריקה היא ללא הגבלה.", noLimit: "ללא הגבלה", pace: "קצב הליכה", notSure: "לא בטוח", like: "מה אני אוהב (ל״הפתיעו אותי״)", less: "פחות", normal: "רגיל", more: "יותר", soft: "נטייה עדינה, לא מסנן: אני עדיין משלב סוגים אחרים ולומד מההליכות שלכם." },
} as const;

/** Standing answers kept in this browser; the chat sends them with every message. */
export function useAssistantDefaults() {
  const [defaults, setDefaultsState] = useState<AssistantDefaults>({});

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setDefaultsState(JSON.parse(raw) as AssistantDefaults);
    } catch {
      // Private mode or blocked storage: start from nothing set.
    }
  }, []);

  const setDefaults = useCallback((patch: Partial<AssistantDefaults>) => {
    setDefaultsState((current) => {
      const next = { ...current, ...patch };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Not saved; still applies for this visit.
      }
      return next;
    });
  }, []);

  return { defaults, setDefaults };
}

type NumericKey = "timeMinutes" | "radiusKm" | "endDistanceKm" | "maxWalkKm";

const NUMBER_ROWS: Array<{ key: NumericKey; label: string; he: string; unit: "min" | "km" }> = [
  { key: "timeMinutes", label: "Time available", he: "זמן פנוי", unit: "min" },
  { key: "radiusKm", label: "Search radius from you", he: "רדיוס חיפוש ממך", unit: "km" },
  { key: "endDistanceKm", label: "End at most this far from the start", he: "לסיים עד מרחק זה מההתחלה", unit: "km" },
  { key: "maxWalkKm", label: "Max walking distance", he: "מרחק הליכה מרבי", unit: "km" },
];
const UNIT_HE = { min: "דק׳", km: "ק״מ" } as const;

function chip(active: boolean): string {
  return chipCell(active);
}

export function AssistantSettings({
  defaults,
  onChange,
  lang = "en",
}: {
  defaults: AssistantDefaults;
  onChange: (patch: Partial<AssistantDefaults>) => void;
  lang?: AssistantLang;
}) {
  const t = COPY[lang];
  const he = lang === "he";
  const tastes = defaults.tastes ?? {};
  const setTaste = (kind: string, level: TasteLevel | null) => {
    const next = { ...tastes };
    if (level) next[kind] = level;
    else delete next[kind];
    onChange({ tastes: next });
  };

  return (
    <div className="space-y-3 rounded-xl border border-charcoal/10 bg-paper p-3">
      <p className="text-xs text-charcoal/60">
        {t.hint}
      </p>
      {NUMBER_ROWS.map((row) => (
        <label key={row.key} className="flex items-center justify-between gap-2 text-xs font-medium text-charcoal/80">
          <span>
            {he ? row.he : row.label} ({he ? UNIT_HE[row.unit] : row.unit})
          </span>
          <input
            type="number"
            min={1}
            inputMode="decimal"
            placeholder={t.noLimit}
            value={defaults[row.key] ?? ""}
            onChange={(e) => {
              const n = Number(e.target.value);
              onChange({ [row.key]: n > 0 ? n : undefined });
            }}
            className="w-24 rounded-md border border-charcoal/15 px-2 py-1 text-sm"
          />
        </label>
      ))}

      <div className="space-y-1">
        <p className="text-xs font-medium text-charcoal/80">{t.pace}</p>
        <div className="flex flex-wrap items-center gap-1">
          {PACE_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              className={chip(defaults.paceMinPerKm === p.value)}
              onClick={() => onChange({ paceMinPerKm: p.value })}
            >
              {paceLabel(p, lang, true)}
            </button>
          ))}
          <button type="button" className={chip(defaults.paceMinPerKm === undefined)} onClick={() => onChange({ paceMinPerKm: undefined })}>
            {t.notSure}
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium text-charcoal/80">{t.like}</p>
        {KINDS.map((k) => (
          <div key={k.key} className="flex items-center justify-between gap-2">
            <span className="text-xs text-charcoal/80">{he ? k.he : k.label}</span>
            <div className="flex gap-1">
              <button type="button" className={chip(tastes[k.key] === "less")} onClick={() => setTaste(k.key, "less")}>
                {t.less}
              </button>
              <button type="button" className={chip(tastes[k.key] === undefined)} onClick={() => setTaste(k.key, null)}>
                {t.normal}
              </button>
              <button type="button" className={chip(tastes[k.key] === "more")} onClick={() => setTaste(k.key, "more")}>
                {t.more}
              </button>
            </div>
          </div>
        ))}
        <p className="text-xs text-charcoal/50">
          {t.soft}
        </p>
      </div>
    </div>
  );
}
