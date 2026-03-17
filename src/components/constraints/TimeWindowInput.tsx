"use client";

import type { TimeWindow } from "@/lib/types";

interface TimeWindowInputProps {
  value?: TimeWindow;
  onChange: (value?: TimeWindow) => void;
}

export function TimeWindowInput({ value, onChange }: TimeWindowInputProps) {
  return (
    <div className="space-y-2">
      <div className="text-sm text-slate-600">Default time window</div>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="time"
          value={value?.start ?? ""}
          onChange={(event) =>
            onChange({
              start: event.target.value,
              end: value?.end ?? event.target.value,
            })
          }
          className="rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none"
        />
        <input
          type="time"
          value={value?.end ?? ""}
          onChange={(event) =>
            onChange({
              start: value?.start ?? event.target.value,
              end: event.target.value,
            })
          }
          className="rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none"
        />
      </div>
      <button
        type="button"
        onClick={() => onChange(undefined)}
        className="text-xs text-slate-500 underline underline-offset-2"
      >
        Clear default window
      </button>
    </div>
  );
}
