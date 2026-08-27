"use client";

import { useId, useState, type ChangeEvent, type ReactNode } from "react";

import type {
  DeviationResponseMode,
  PaceResponseMode,
  WalkSettings,
} from "@/lib/types/walk-settings";

// The two directions read as one setting with two halves, so they render as a
// pair rather than as two unrelated rows scattered through the panel.
const PACE_SETTINGS: { key: "slowPaceMode" | "fastPaceMode"; label: string }[] = [
  { key: "slowPaceMode", label: "When I fall behind" },
  { key: "fastPaceMode", label: "When I'm ahead" },
];

const PACE_MODE_LABELS: { value: PaceResponseMode; text: string }[] = [
  { value: "auto", text: "Reshape the walk" },
  { value: "ask", text: "Ask me first" },
  { value: "off", text: "Leave it alone" },
];

// Same three answers as the pace rows, worded for the situation they answer:
// off route, "reshape the walk" would read as an offer to change the plan when
// what is actually on offer is redrawing the same plan to reach the walker.
const DEVIATION_MODE_LABELS: { value: DeviationResponseMode; text: string }[] = [
  { value: "auto", text: "Redraw from here" },
  { value: "ask", text: "Ask me first" },
  { value: "off", text: "Leave it alone" },
];

const SELECT_CLASS =
  "rounded-md border border-charcoal/15 bg-white px-2 py-1 text-sm text-forest outline-none ring-terra transition focus:ring-2";
const CHECKBOX_CLASS =
  "h-4 w-4 rounded border-charcoal/15 text-terra focus:ring-terra";
const ROW_CLASS =
  "flex items-center justify-between gap-3 text-sm text-charcoal/80";

/**
 * One named group of settings.
 *
 * Each heading names the situation the group answers rather than the machinery
 * behind it — the walker is deciding what happens when they fall behind, not
 * configuring a pace checker. The first group carries no rule above it; every
 * later one does, which is how the panel already separated its two headed
 * groups before the rest of the controls got headings of their own.
 */
function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="space-y-2 border-t border-charcoal/10 pt-3 first:border-t-0 first:pt-0"
    >
      <h3 id={headingId} className="text-sm font-medium text-charcoal/80">
        {title}
      </h3>
      {children}
    </section>
  );
}

interface WalkSettingsPanelProps {
  settings: WalkSettings;
  onChange: (s: Partial<WalkSettings>) => void;
}

export function WalkSettingsPanel({
  settings,
  onChange,
}: WalkSettingsPanelProps) {
  /**
   * Closed to start with, for the same reason the Recent requests scrollback
   * is: these are set-once answers, while everything above them in the panel —
   * where you are, how long you have, what you feel like seeing — is filled in
   * afresh for every walk. Left open, seven controls and their explanations sit
   * between the walker and the Build My Walk button on every single visit.
   */
  const [isOpen, setIsOpen] = useState(false);
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
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full cursor-pointer items-center justify-between text-sm font-medium text-charcoal/80 hover:text-forest"
      >
        <span>Walk settings</span>
        <span aria-hidden="true">{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && (
        <div className="space-y-4">
          {/* Ordering inside every group: what decides whether we act at all
              comes first, then what shapes how we act, then the tuning that
              only matters once something is switched on. */}
          <SettingsSection title="If my pace drifts">
            {PACE_SETTINGS.map(({ key, label }) => (
              <label key={key} className={ROW_CLASS}>
                <span>{label}</span>
                <select
                  value={settings[key]}
                  onChange={(event) =>
                    onChange({ [key]: event.target.value as PaceResponseMode })
                  }
                  className={SELECT_CLASS}
                >
                  {PACE_MODE_LABELS.map(({ value, text }) => (
                    <option key={value} value={value}>
                      {text}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            {/* Moved in here from the bottom of the panel, where it sat under
                no heading at all and read as though it belonged to the
                off-route group directly above it. It has only ever been about
                pace. */}
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
          </SettingsSection>

          <SettingsSection title="If I go off route">
            <label className={ROW_CLASS}>
              <span>When I&apos;ve strayed from the path</span>
              <select
                value={settings.deviationMode}
                onChange={(event) =>
                  onChange({
                    deviationMode: event.target.value as DeviationResponseMode,
                  })
                }
                className={SELECT_CLASS}
              >
                {DEVIATION_MODE_LABELS.map(({ value, text }) => (
                  <option key={value} value={value}>
                    {text}
                  </option>
                ))}
              </select>
            </label>
          </SettingsSection>

          {/* Its own group rather than a fourth row under "If my pace drifts",
              where it has sat since it was built alongside the pace work.
              `buildDeviationRebuildRequest` reads the same flag through the
              shared `buildMidWalkRebuildRequest`, so it answers what happens
              after *any* mid-walk rebuild — filing it under pace told the
              walker it only applied to one of the two ways of getting one. */}
          <SettingsSection title="When we reshape your walk">
            <label className={ROW_CLASS}>
              <span>Start the new walk for me</span>
              <input
                type="checkbox"
                checked={settings.autoResumeAfterRebuild}
                onChange={(event) =>
                  onChange({ autoResumeAfterRebuild: event.target.checked })
                }
                className={CHECKBOX_CLASS}
              />
            </label>
            <p className="text-xs text-charcoal/60">
              {settings.autoResumeAfterRebuild
                ? "On — once we reshape your walk, tracking picks straight up on the new route."
                : "Off — we'll show you the reshaped walk and wait for you to press Start Walk."}
            </p>
          </SettingsSection>

          {/* The two toggles that outlive the walk. Preference learning leads
              because it is the one that quietly changes what gets built;
              keeping the requests only shows the walker their own words back. */}
          <SettingsSection title="What we remember between walks">
            <div className="space-y-1">
              <label className={ROW_CLASS}>
                <span>Remember my preferences</span>
                <input
                  type="checkbox"
                  checked={settings.preferenceLearningEnabled}
                  onChange={(event) =>
                    onChange({ preferenceLearningEnabled: event.target.checked })
                  }
                  className={CHECKBOX_CLASS}
                />
              </label>
              <p className="text-xs text-charcoal/60">
                {settings.preferenceLearningEnabled
                  ? "On — what you say you like and how you rate your walks shapes the walks we build for you next."
                  : "Off — Traike won't learn your preferences, so future walks may feel less personalized."}
              </p>
            </div>

            <div className="space-y-1">
              <label className={ROW_CLASS}>
                <span>Keep my recent requests</span>
                <input
                  type="checkbox"
                  checked={settings.historyPersistenceEnabled}
                  onChange={(event) =>
                    onChange({ historyPersistenceEnabled: event.target.checked })
                  }
                  className={CHECKBOX_CLASS}
                />
              </label>
              <p className="text-xs text-charcoal/60">
                {settings.historyPersistenceEnabled
                  ? "On — the last few things you typed stay in the Recent requests list next time you open Traike. Clear them any time from that list."
                  : "Off — your requests are forgotten when you close the tab."}
              </p>
            </div>
          </SettingsSection>
        </div>
      )}
    </section>
  );
}
