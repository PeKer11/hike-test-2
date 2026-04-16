import type { ChangeEvent } from "react";

import type { WalkSettings } from "@/lib/types/walk-settings";

interface WalkSettingsPanelProps {
  settings: WalkSettings;
  onChange: (s: Partial<WalkSettings>) => void;
}

export function WalkSettingsPanel({
  settings,
  onChange,
}: WalkSettingsPanelProps) {
  const intervalSeconds = Math.round(settings.paceCheckIntervalMs / 1000);

  const handleIntervalChange = (event: ChangeEvent<HTMLInputElement>) => {
    const seconds = Number(event.target.value);

    if (Number.isNaN(seconds)) {
      return;
    }

    onChange({ paceCheckIntervalMs: seconds * 1000 });
  };

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
        <span>Auto re-route on slow pace</span>
        <input
          type="checkbox"
          checked={settings.paceCheckEnabled}
          onChange={(event) => onChange({ paceCheckEnabled: event.target.checked })}
          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
        />
      </label>

      <label className="space-y-1 text-sm text-slate-700">
        <span className="block">Check interval (min 30s)</span>
        <input
          type="number"
          min={30}
          value={intervalSeconds}
          onChange={handleIntervalChange}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 outline-none ring-emerald-500 transition focus:ring-2 sm:text-sm"
        />
      </label>
    </section>
  );
}
