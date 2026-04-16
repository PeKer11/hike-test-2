"use client";

import { useCallback, useState } from "react";

import {
  clampPaceCheckInterval,
  DEFAULT_WALK_SETTINGS,
  type WalkSettings,
} from "@/lib/types/walk-settings";

const WALK_SETTINGS_STORAGE_KEY = "walk-settings";

function sanitizeSettings(
  candidate: Partial<WalkSettings> | null | undefined,
): WalkSettings {
  return {
    paceCheckEnabled:
      typeof candidate?.paceCheckEnabled === "boolean"
        ? candidate.paceCheckEnabled
        : DEFAULT_WALK_SETTINGS.paceCheckEnabled,
    paceCheckIntervalMs: clampPaceCheckInterval(
      typeof candidate?.paceCheckIntervalMs === "number"
        ? candidate.paceCheckIntervalMs
        : DEFAULT_WALK_SETTINGS.paceCheckIntervalMs,
    ),
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

    const parsed = JSON.parse(raw) as Partial<WalkSettings>;
    return sanitizeSettings(parsed);
  } catch {
    return DEFAULT_WALK_SETTINGS;
  }
}

export function useWalkSettings(): {
  settings: WalkSettings;
  setSettings: (partial: Partial<WalkSettings>) => void;
} {
  const [settings, setSettingsState] = useState<WalkSettings>(() =>
    readStoredSettings(),
  );

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
