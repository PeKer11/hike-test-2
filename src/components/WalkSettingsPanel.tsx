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
    <section className="space-y-4 rounded-[10px] border border-charcoal/10 bg-cream/60 p-3">
      <label className="flex items-center justify-between gap-3 text-sm text-charcoal/80">
        <span>Reshape the walk if I fall behind</span>
        <input
          type="checkbox"
          checked={settings.paceCheckEnabled}
          onChange={(event) => onChange({ paceCheckEnabled: event.target.checked })}
          className="h-4 w-4 rounded border-charcoal/15 text-terra focus:ring-terra"
        />
      </label>

      <label className="space-y-1 text-sm text-charcoal/80">
        <span className="block">How often we check your pace (seconds)</span>
        <input
          type="number"
          min={30}
          value={intervalSeconds}
          onChange={handleIntervalChange}
          className="w-full rounded-md border border-charcoal/15 px-3 py-2 text-base text-forest outline-none ring-terra transition focus:ring-2 sm:text-sm"
        />
      </label>

      <div className="space-y-1 border-t border-charcoal/10 pt-3">
        <label className="flex items-center justify-between gap-3 text-sm text-charcoal/80">
          <span>Remember my preferences</span>
          <input
            type="checkbox"
            checked={settings.preferenceLearningEnabled}
            onChange={(event) =>
              onChange({ preferenceLearningEnabled: event.target.checked })
            }
            className="h-4 w-4 rounded border-charcoal/15 text-terra focus:ring-terra"
          />
        </label>
        <p className="text-xs text-charcoal/60">
          {settings.preferenceLearningEnabled
            ? "On — what you say you like and how you rate your walks shapes the walks we build for you next."
            : "Off — Traike won't learn your preferences, so future walks may feel less personalized."}
        </p>
      </div>
    </section>
  );
}
