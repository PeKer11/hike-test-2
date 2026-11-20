"use client";

import { useEffect, useState } from "react";

import { socialCopy, type SocialLang } from "@/lib/social/copy";
import { tasteEnabled } from "@/lib/social/flag";
import { saveProfile, type SocialProfile } from "@/lib/social/profiles";
import { deleteTaste, fetchTaste, generateTaste, type TasteStatus, type TasteView } from "@/lib/social/taste";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BTN, BTN_ALT_SM } from "@/components/ui/panel-style";

const CARD = "space-y-3 rounded-tk-card bg-paper p-4 shadow-tk-card";
const PRIMARY = BTN;

/** Me: "My taste" (opt-in, off by default). The prose stays private; only the fixed tags can reach the profile, and only on request. */
export function TasteCard({ lang, profile, client, onProfileChanged }: { lang: SocialLang; profile: SocialProfile; client: SupabaseClient; onProfileChanged: () => void }) {
  const t = socialCopy[lang];
  const [state, setState] = useState<{ available: boolean; taste: TasteView | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<TasteStatus | "saved" | null>(null);

  useEffect(() => {
    if (!tasteEnabled()) return;
    let live = true;
    void fetchTaste().then((r) => live && setState(r));
    return () => {
      live = false;
    };
  }, []);

  if (!tasteEnabled() || !state?.available) return null;
  const taste = state.taste;

  const make = async () => {
    setBusy(true);
    setMessage(null);
    const r = await generateTaste(lang);
    setBusy(false);
    if (r.taste) setState({ available: true, taste: r.taste });
    setMessage(r.status === "ok" ? "saved" : r.status);
  };

  const toggleShow = async () => {
    await saveProfile(client, { displayName: profile.displayName, avatar: profile.avatar, visibility: profile.visibility, showHistory: profile.showHistory, showTaste: !profile.showTaste, presenceAudience: profile.presenceAudience, adult: true });
    onProfileChanged();
  };

  const notes: Partial<Record<TasteStatus, string>> = {
    consent: t.tasteConsent,
    not_enough_walks: t.tasteNotEnough,
    resting: t.tasteResting,
    unavailable: t.tasteUnavailable,
    cooldown: t.tasteCooldown,
  };

  return (
    <section className={CARD} aria-label={t.tasteTitle}>
      <h2 className="text-[18px] font-semibold text-tk-ink">{t.tasteTitle}</h2>
      {taste ? (
        <>
          <ul className="space-y-1 text-[16px] leading-6">
            {taste.bullets.map((b) => (
              <li key={b} dir="auto">
                {b}
              </li>
            ))}
          </ul>
          {taste.tags.length > 0 ? (
            <p className="flex flex-wrap gap-2">
              {taste.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-forest/10 px-3 py-1 text-[15px] text-forest">
                  {t.tasteTags[tag as keyof typeof t.tasteTags] ?? tag}
                </span>
              ))}
            </p>
          ) : null}
          <label className="flex min-h-11 items-center gap-3 text-[16px]">
            <input type="checkbox" checked={profile.showTaste} onChange={() => void toggleShow()} className="h-5 w-5 accent-[var(--tk-terra)]" />
            {t.tasteShow}
          </label>
          <p className="text-[15px] text-charcoal/70">{t.tasteLine}</p>
        </>
      ) : (
        <p className="text-[16px] text-charcoal/70">{t.tasteIntro}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => void make()} className={PRIMARY}>
          {taste ? t.tasteRefresh : t.tasteCreate}
        </button>
        {taste ? (
          <button
            type="button"
            className={BTN_ALT_SM}
            onClick={() => void deleteTaste().then((ok) => { if (ok) { setState({ available: true, taste: null }); if (profile.showTaste) void toggleShow(); } })}
          >
            {t.tasteDelete}
          </button>
        ) : null}
      </div>
      {message && message !== "saved" && notes[message] ? (
        <p role="status" className="text-[15px] text-charcoal/80">
          {notes[message]}
        </p>
      ) : null}
    </section>
  );
}
