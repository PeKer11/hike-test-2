"use client";

import { useEffect } from "react";

import type { LearningConsent } from "@/lib/types/walk-settings";

/**
 * Mirrors the walker's learning choice to the server (`/api/consent`), where the AI routes check it.
 * "granted" needs both the consent and the learning switch on; an unset choice sends nothing.
 */
export function useConsentSync(enabled: boolean, consent: LearningConsent, learningOn: boolean): void {
  const effective = consent === "unset" ? null : consent === "granted" && learningOn ? "granted" : "declined";
  useEffect(() => {
    if (!enabled || effective === null) return;
    void fetch("/api/consent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ consent: effective }),
    }).catch(() => undefined);
  }, [enabled, effective]);
}
