"use client";

import { useCallback, useEffect, useState } from "react";

import {
  clampPaceCheckInterval,
  DEFAULT_WALK_SETTINGS,
  toDeviationResponseMode,
  toPaceResponseMode,
  type WalkSettings,
} from "@/lib/types/walk-settings";

const WALK_SETTINGS_STORAGE_KEY = "walk-settings";

/**
 * A stored blob is not necessarily one this version wrote — the key has been
 * in localStorage since before the pace modes were split out of a single
 * `paceCheckEnabled` boolean, so the parse is deliberately untyped and every
 * field is re-derived rather than trusted. `toPaceResponseMode` is where the
 * old flag is honoured.
 */
function sanitizeSettings(
  candidate: (Partial<WalkSettings> & { paceCheckEnabled?: unknown }) | null | undefined,
): WalkSettings {
  return {
    fastPaceMode: toPaceResponseMode(
      candidate?.fastPaceMode,
      candidate?.paceCheckEnabled,
    ),
    slowPaceMode: toPaceResponseMode(
      candidate?.slowPaceMode,
      candidate?.paceCheckEnabled,
    ),
    deviationMode: toDeviationResponseMode(candidate?.deviationMode),
    // A blob written before this flag existed has no opinion on it, and the
    // behaviour it was written under was "resume automatically" — so a missing
    // field has to fill in as true, not false.
    autoResumeAfterRebuild:
      typeof candidate?.autoResumeAfterRebuild === "boolean"
        ? candidate.autoResumeAfterRebuild
        : DEFAULT_WALK_SETTINGS.autoResumeAfterRebuild,
    paceCheckIntervalMs: clampPaceCheckInterval(
      typeof candidate?.paceCheckIntervalMs === "number"
        ? candidate.paceCheckIntervalMs
        : DEFAULT_WALK_SETTINGS.paceCheckIntervalMs,
    ),
    preferenceLearningEnabled:
      typeof candidate?.preferenceLearningEnabled === "boolean"
        ? candidate.preferenceLearningEnabled
        : DEFAULT_WALK_SETTINGS.preferenceLearningEnabled,
    // A blob written before this flag existed predates persisted history
    // altogether, so there is nothing stored that a missing field could be an
    // opt-out from — it fills in as the default like a brand-new walker's.
    historyPersistenceEnabled:
      typeof candidate?.historyPersistenceEnabled === "boolean"
        ? candidate.historyPersistenceEnabled
        : DEFAULT_WALK_SETTINGS.historyPersistenceEnabled,
  };
}

function readStoredSettings(): WalkSettings {
  if (typeof window === "undefined") {
    return DEFAULT_WALK_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(WALK_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_WALK_SETTINGS;
    }

    const parsed = JSON.parse(raw) as Partial<WalkSettings> & {
      paceCheckEnabled?: unknown;
    };
    return sanitizeSettings(parsed);
  } catch {
    return DEFAULT_WALK_SETTINGS;
  }
}

export function useWalkSettings(): {
  settings: WalkSettings;
  setSettings: (partial: Partial<WalkSettings>) => void;
} {
  // The server has no localStorage, so it can only ever render the defaults.
  // Reading the stored blob during the first client render would therefore make
  // hydration disagree with the server-rendered markup — and the settings panel
  // renders the stored values as *text* ("On — …" / "Off — …"), which is the
  // mismatch React throws on rather than silently patches. So the first render
  // matches the server, and the stored settings land immediately after mount.
  const [settings, setSettingsState] = useState<WalkSettings>(
    DEFAULT_WALK_SETTINGS,
  );

  useEffect(() => {
    const stored = readStoredSettings();
    setSettingsState((current) =>
      // A walker who changed a setting before this effect ran owns the value;
      // don't stomp it with what was on disk at mount.
      current === DEFAULT_WALK_SETTINGS ? stored : current,
    );
  }, []);

  const setSettings = useCallback((partial: Partial<WalkSettings>) => {
    setSettingsState((current) => {
      const next = sanitizeSettings({
        ...current,
        ...partial,
      });

      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          WALK_SETTINGS_STORAGE_KEY,
          JSON.stringify(next),
        );
      }

      return next;
    });
  }, []);

  return { settings, setSettings };
}
