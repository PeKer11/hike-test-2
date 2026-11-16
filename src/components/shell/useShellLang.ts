"use client";

import type { WalkSettings } from "@/lib/types/walk-settings";

/** Hebrew or English for the shell's own words: the walker's setting, else the browser's language. */
export function shellLang(settings: WalkSettings | null): "he" | "en" {
  const chosen = settings?.uiLanguage;
  if (chosen === "he" || chosen === "en") return chosen;
  if (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("he")) return "he";
  return "en";
}
