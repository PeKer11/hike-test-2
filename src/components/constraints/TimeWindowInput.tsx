"use client";

import type { TimeWindow } from "@/lib/types";

interface TimeWindowInputProps {
  value?: TimeWindow;
  onChange: (value?: TimeWindow) => void;
}

export function TimeWindowInput({ value, onChange }: TimeWindowInputProps) {
  return (
    <div className="space-y-2">
      <div className="text-sm text-charcoal/70">Default time window</div>
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
          className="rounded-md border border-charcoal/15 px-2 py-1 text-sm focus:border-terra focus:outline-none"
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
          className="rounded-md border border-charcoal/15 px-2 py-1 text-sm focus:border-terra focus:outline-none"
        />
      </div>
      <button
        type="button"
        onClick={() => onChange(undefined)}
        className="text-xs text-charcoal/60 underline underline-offset-2"
      >
        Clear default window
      </button>
    </div>
  );
}
