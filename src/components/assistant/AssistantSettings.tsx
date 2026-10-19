"use client";

import { useCallback, useEffect, useState } from "react";

import type { AssistantDefaults, TasteLevel } from "@/lib/assistant/defaults";

const STORAGE_KEY = "traike.assistantDefaults.v1";

export const PACE_PRESETS: Array<{ label: string; value: number }> = [
  { label: "Very slow", value: 25 },
  { label: "Slow", value: 20 },
  { label: "Normal", value: 15 },
  { label: "Brisk", value: 12 },
  { label: "Fast", value: 10 },
];

const KINDS: Array<{ key: string; label: string }> = [
  { key: "landmark", label: "Landmarks" },
  { key: "museum", label: "Museums" },
  { key: "park", label: "Parks" },
  { key: "food", label: "Food & Cafes" },
  { key: "viewpoint", label: "Viewpoints" },
  { key: "religious", label: "Religious sites" },
  { key: "nature", label: "Nature" },
  { key: "entertainment", label: "Entertainment" },
  { key: "shopping", label: "Shopping" },
];

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

const NUMBER_ROWS: Array<{ key: NumericKey; label: string; unit: string }> = [
  { key: "timeMinutes", label: "Time available", unit: "min" },
  { key: "radiusKm", label: "Search radius from you", unit: "km" },
  { key: "endDistanceKm", label: "End at most this far from the start", unit: "km" },
  { key: "maxWalkKm", label: "Max walking distance", unit: "km" },
];

function chip(active: boolean): string {
  return `rounded-full border px-2 py-1 text-xs ${
    active ? "border-terra bg-terra text-white" : "border-charcoal/15"
  }`;
}

export function AssistantSettings({
  defaults,
  onChange,
}: {
  defaults: AssistantDefaults;
  onChange: (patch: Partial<AssistantDefaults>) => void;
}) {
  const tastes = defaults.tastes ?? {};
  const setTaste = (kind: string, level: TasteLevel | null) => {
    const next = { ...tastes };
    if (level) next[kind] = level;
    else delete next[kind];
    onChange({ tastes: next });
  };

  return (
    <div className="space-y-3 rounded-xl border border-charcoal/10 bg-white p-3">
      <p className="text-xs text-charcoal/60">
        Used when you do not say otherwise. Leave a box empty for no limit.
      </p>
      {NUMBER_ROWS.map((row) => (
        <label key={row.key} className="flex items-center justify-between gap-2 text-xs font-medium text-charcoal/80">
          <span>
            {row.label} ({row.unit})
          </span>
          <input
            type="number"
            min={1}
            inputMode="decimal"
            placeholder="No limit"
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
        <p className="text-xs font-medium text-charcoal/80">Walking pace</p>
        <div className="flex flex-wrap items-center gap-1">
          {PACE_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              className={chip(defaults.paceMinPerKm === p.value)}
              onClick={() => onChange({ paceMinPerKm: p.value })}
            >
              {p.label} ({p.value} min/km)
            </button>
          ))}
          <button type="button" className={chip(defaults.paceMinPerKm === undefined)} onClick={() => onChange({ paceMinPerKm: undefined })}>
            Not sure
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium text-charcoal/80">What I like (for &ldquo;surprise me&rdquo;)</p>
        {KINDS.map((k) => (
          <div key={k.key} className="flex items-center justify-between gap-2">
            <span className="text-xs text-charcoal/80">{k.label}</span>
            <div className="flex gap-1">
              <button type="button" className={chip(tastes[k.key] === "less")} onClick={() => setTaste(k.key, "less")}>
                Less
              </button>
              <button type="button" className={chip(tastes[k.key] === undefined)} onClick={() => setTaste(k.key, null)}>
                Normal
              </button>
              <button type="button" className={chip(tastes[k.key] === "more")} onClick={() => setTaste(k.key, "more")}>
                More
              </button>
            </div>
          </div>
        ))}
        <p className="text-xs text-charcoal/50">
          A soft lean, not a filter: I still mix in other kinds and learn from the walks you take.
        </p>
      </div>
    </div>
  );
}
