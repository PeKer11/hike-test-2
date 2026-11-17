"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useState } from "react";

import { ModalSheet } from "@/components/ui/ModalSheet";
import { socialCopy, type SocialLang } from "@/lib/social/copy";
import { sendNearbyRequest, sendRequest, visibleChoices, type MeetChoice } from "@/lib/social/walk-requests";

const TIMES = [
  { min: 0, key: "timeNow" },
  { min: 15, key: "time15" },
  { min: 30, key: "time30" },
] as const;

/** Ask a friend to walk together: a public meeting place from the walker's own route, a time, and nothing typed. */
export function WalkTogetherSheet({
  open,
  onClose,
  lang,
  client,
  friend,
  choices,
  mapProvider,
  nearbyToken,
  onSent,
}: {
  /** A stranger walking nearby (phase 8): the request goes by their presence token, never their id. */
  nearbyToken?: string;
  open: boolean;
  onClose: () => void;
  lang: SocialLang;
  client: SupabaseClient;
  friend: { id: string; name: string };
  choices: MeetChoice[];
  /** On a Leaflet map, Google places are not offered (Maps Platform terms). */
  mapProvider: "google" | "leaflet";
  onSent: () => void;
}) {
  const t = socialCopy[lang];
  const shown = visibleChoices(choices, mapProvider);
  const [picked, setPicked] = useState(0);
  const [minutes, setMinutes] = useState<number>(15);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const send = async () => {
    const choice = shown[picked];
    if (!choice) return;
    setBusy(true);
    setFailed(false);
    const id = nearbyToken ? await sendNearbyRequest(client, nearbyToken, choice.place, minutes) : await sendRequest(client, friend.id, choice.place, minutes);
    setBusy(false);
    if (id) {
      onSent();
      onClose();
    } else setFailed(true);
  };

  return (
    <ModalSheet open={open} onClose={onClose} title={t.sheetTitle(friend.name)}>
      <div className="space-y-4 text-charcoal">
        <h2 dir="auto" className="font-display text-[24px] leading-7 text-forest">
          {t.sheetTitle(friend.name)}
        </h2>
        <div className="space-y-2">
          <span className="text-[15px] font-medium">{t.where}</span>
          {shown.length === 0 ? (
            <p className="text-[16px] text-charcoal/70">{t.noChoices}</p>
          ) : (
            <div role="radiogroup" aria-label={t.where} className="flex flex-col gap-2">
              {shown.map((c, i) => (
                <button
                  key={c.place.ref}
                  type="button"
                  role="radio"
                  aria-checked={picked === i}
                  onClick={() => setPicked(i)}
                  className={`min-h-12 rounded-2xl px-4 text-start text-[16px] font-medium ${picked === i ? "bg-terra/15 text-terra shadow-tk-soft" : "bg-charcoal/5"}`}
                >
                  <span dir="auto">{c.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-2">
          <span className="text-[15px] font-medium">{t.when}</span>
          <div role="radiogroup" aria-label={t.when} className="flex gap-2">
            {TIMES.map((x) => (
              <button
                key={x.min}
                type="button"
                role="radio"
                aria-checked={minutes === x.min}
                onClick={() => setMinutes(x.min)}
                className={`min-h-12 flex-1 rounded-full text-[16px] font-medium ${minutes === x.min ? "bg-terra/15 text-terra shadow-tk-soft" : "bg-charcoal/5"}`}
              >
                {t[x.key]}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[15px] text-charcoal/70">{t.safetyLine}</p>
        {failed ? (
          <p role="alert" className="text-[15px] font-medium text-terra">
            {t.requestNotSent}
          </p>
        ) : null}
        <button type="button" disabled={busy || shown.length === 0} onClick={() => void send()} className="min-h-14 w-full rounded-full bg-terra text-[17px] font-semibold text-on-accent shadow-tk-soft disabled:opacity-60">
          {t.sendRequest}
        </button>
      </div>
    </ModalSheet>
  );
}
