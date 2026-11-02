"use client";

import { useEffect, useState } from "react";

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

/**
 * While the local choice is unset, asks the server for the account's saved one and applies it, so the
 * consent screen shows once per account, not once per browser. Returns true once that check is done.
 */
export function useServerConsent(loaded: boolean, consent: LearningConsent, apply: (granted: boolean) => void): boolean {
  const [checked, setChecked] = useState(false);
  const needed = loaded && consent === "unset";
  useEffect(() => {
    if (!needed) return;
    let active = true;
    void fetch("/api/consent")
      .then((r) => (r.ok ? (r.json() as Promise<{ consent?: string }>) : null))
      .then((body) => {
        if (!active) return;
        if (body?.consent === "granted" || body?.consent === "declined") apply(body.consent === "granted");
        setChecked(true);
      })
      .catch(() => active && setChecked(true));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needed]);
  return checked || !needed;
}
