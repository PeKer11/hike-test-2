"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useState } from "react";

import { Avatar } from "@/components/social/Avatar";
import { Segmented } from "@/components/shell/Segmented";
import { NearbyConsentSheet } from "@/components/social/NearbyConsentSheet";
import { ModalSheet } from "@/components/ui/ModalSheet";
import { AVATARS, type AvatarId } from "@/lib/social/avatars";
import { profileErrorCopy, socialCopy, type SocialLang } from "@/lib/social/copy";
import { nearbyEnabled, presenceEnabled } from "@/lib/social/flag";
import { deleteMyProfile, saveProfile, type PresenceAudience, type SocialProfile, type Visibility } from "@/lib/social/profiles";
import { BTN } from "@/components/ui/panel-style";

const FIELD = "min-h-12 w-full rounded-2xl bg-charcoal/5 px-4 text-[16px] text-charcoal outline-none focus:bg-charcoal/10";

/** Create or edit the social profile. The 18+ box (unticked) is asked only when creating. */
export function ProfileEditSheet({
  open,
  onClose,
  lang,
  client,
  userId,
  initial,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  lang: SocialLang;
  client: SupabaseClient;
  userId: string;
  initial: SocialProfile | null;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const t = socialCopy[lang];
  const [name, setName] = useState(initial?.displayName ?? "");
  const [avatar, setAvatar] = useState<AvatarId>(initial?.avatar ?? "backpack");
  const [visibility, setVisibility] = useState<Visibility>(initial?.visibility ?? "private");
  const [showHistory, setShowHistory] = useState(initial?.showHistory ?? true);
  const [presence, setPresence] = useState<PresenceAudience>(initial?.presenceAudience ?? "off");
  const [adult, setAdult] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [consent, setConsent] = useState(false);

  const save = async () => {
    setBusy(true);
    setError(null);
    const code = await saveProfile(client, {
      displayName: name,
      avatar,
      visibility,
      showHistory,
      showTaste: initial?.showTaste ?? false,
      presenceAudience: presence,
      adult,
    });
    setBusy(false);
    if (code === "ok") {
      onSaved();
      onClose();
    } else setError(profileErrorCopy[lang][code]);
  };

  const line = visibility === "private" ? t.vPrivateLine : visibility === "friends" ? t.vFriendsLine : t.vPublicLine;
  const vItems = [
    { id: "private" as const, label: t.vPrivate },
    { id: "friends" as const, label: t.vFriends },
    { id: "public" as const, label: t.vPublic },
  ];
  const pItems = [
    { id: "off" as const, label: lang === "he" ? "כבוי" : "Off" },
    { id: "friends" as const, label: t.vFriends },
    ...(nearbyEnabled() ? [{ id: "public" as const, label: lang === "he" ? "כולם בסביבה" : "Nearby" }] : []),
  ];

  return (
    <ModalSheet open={open} onClose={onClose} title={t.editTitle}>
      <div className="space-y-4 text-charcoal">
        <h2 className="font-display text-[24px] leading-7 text-forest">{t.editTitle}</h2>
        <label className="block space-y-1">
          <span className="text-[15px] font-medium">{t.name}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder={t.namePlaceholder} className={FIELD} autoComplete="off" />
        </label>
        <div role="radiogroup" aria-label={t.avatar} className="grid grid-cols-6 gap-1.5">
          {AVATARS.map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={avatar === a}
              aria-label={a}
              onClick={() => setAvatar(a)}
              className={`flex items-center justify-center rounded-2xl py-1.5 ${avatar === a ? "bg-terra/15 shadow-tk-soft" : "bg-charcoal/5"}`}
            >
              <Avatar id={a} size={40} seed={a} />
            </button>
          ))}
        </div>
        <div className="space-y-2">
          <span className="text-[15px] font-medium">{t.visibility}</span>
          <Segmented items={vItems} value={visibility} onChange={setVisibility} label={t.visibility} />
          <p className="text-[15px] text-charcoal/70">{line}</p>
        </div>
        {visibility !== "private" ? (
          <label className="flex min-h-11 items-center gap-3 text-[16px]">
            <input type="checkbox" checked={showHistory} onChange={(e) => setShowHistory(e.target.checked)} className="h-5 w-5 accent-[var(--tk-terra)]" />
            {t.showHistory}
          </label>
        ) : null}
        {presenceEnabled() ? (
          <div className="space-y-2">
            <span className="text-[15px] font-medium">{lang === "he" ? "הולכים עכשיו" : "Walking now"}</span>
            <Segmented items={pItems} value={presence} onChange={(next) => (next === "public" && presence !== "public" ? setConsent(true) : setPresence(next))} label={lang === "he" ? "הולכים עכשיו" : "Walking now"} />
          </div>
        ) : null}
        {!initial ? (
          <label className="flex min-h-11 items-center gap-3 text-[16px]">
            <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} className="h-5 w-5 accent-[var(--tk-terra)]" />
            {t.adult}
          </label>
        ) : null}
        {error ? (
          <p role="alert" className="text-[15px] font-medium text-terra">
            {error}
          </p>
        ) : null}
        <button type="button" disabled={busy} onClick={() => void save()} className={`${BTN} w-full`}>
          {t.save}
        </button>
        {initial ? (
          confirmDelete ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-[15px]">{t.deleteConfirm}</span>
              <button
                type="button"
                className="min-h-11 rounded-full bg-terra/15 px-4 text-[15px] font-semibold text-terra"
                onClick={() =>
                  void deleteMyProfile(client, userId).then((ok) => {
                    if (ok) {
                      onDeleted();
                      onClose();
                    } else setError(profileErrorCopy[lang].error);
                  })
                }
              >
                {t.deleteProfile}
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className="min-h-11 w-full text-[15px] font-semibold text-charcoal/70">
              {t.deleteProfile}
            </button>
          )
        ) : null}
      </div>
      <NearbyConsentSheet open={consent} onClose={() => setConsent(false)} onConfirm={() => { setPresence("public"); setConsent(false); }} lang={lang} />
    </ModalSheet>
  );
}
