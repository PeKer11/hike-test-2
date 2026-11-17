"use client";

import { useCallback, useEffect, useState } from "react";

import { Avatar } from "@/components/social/Avatar";
import { ProfileEditSheet } from "@/components/social/ProfileEditSheet";
import { useSocialClient } from "@/lib/hooks/useSocialClient";
import { socialCopy, type SocialLang } from "@/lib/social/copy";
import { socialProfilesEnabled } from "@/lib/social/flag";
import { getMyProfile, listMyBlocks, unblockUser, type BlockedUser, type MyProfile } from "@/lib/social/profiles";

const CARD = "space-y-3 rounded-tk-card bg-paper p-4 shadow-tk-card";

/** Me: the social profile card and the privacy card (visibility, blocked people). Renders nothing until profiles are on and applied. */
export function SocialMeCards({ lang, signedIn }: { lang: SocialLang; signedIn: boolean }) {
  const t = socialCopy[lang];
  const enabled = signedIn && socialProfilesEnabled();
  const session = useSocialClient(enabled);
  const [mine, setMine] = useState<MyProfile>({ status: "unavailable" });
  const [blocks, setBlocks] = useState<BlockedUser[]>([]);
  const [edit, setEdit] = useState(false);

  const refresh = useCallback(async () => {
    if (!session) return;
    const [p, b] = await Promise.all([getMyProfile(session.client, session.userId), listMyBlocks(session.client)]);
    setMine(p);
    setBlocks(b);
  }, [session]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!enabled || !session || mine.status === "unavailable") return null;

  const vLabel = mine.status === "ok" ? { private: t.vPrivate, friends: t.vFriends, public: t.vPublic }[mine.profile.visibility] : "";

  return (
    <>
      <section className={CARD} aria-label={t.meProfile}>
        {mine.status === "ok" ? (
          <div className="flex items-center gap-3">
            <Avatar id={mine.profile.avatar} size={56} seed={session.userId} />
            <div className="min-w-0 flex-1">
              <p dir="auto" className="truncate text-[18px] font-semibold text-tk-ink">{mine.profile.displayName}</p>
              <span className="mt-1 inline-block rounded-full bg-forest/10 px-3 py-0.5 text-[15px] text-forest">{vLabel}</span>
            </div>
            <button type="button" onClick={() => setEdit(true)} className="min-h-11 rounded-full bg-charcoal/5 px-4 text-[15px] font-semibold">
              {t.edit}
            </button>
          </div>
        ) : (
          <>
            <p className="text-[16px] text-tk-ink">{t.meNoProfile}</p>
            <button type="button" onClick={() => setEdit(true)} className="min-h-12 rounded-full bg-terra px-6 text-[16px] font-semibold text-on-accent shadow-tk-soft">
              {t.createCta}
            </button>
          </>
        )}
      </section>

      {blocks.length > 0 ? (
      <section className={CARD} aria-label={t.meAudience}>
        <h2 className="text-[18px] font-semibold text-tk-ink">{t.meBlocked}</h2>
        {(
          <ul>
            {blocks.map((b) => (
              <li key={b.userId} className="flex min-h-12 items-center gap-3">
                <Avatar id={b.avatar} size={40} seed={b.userId} />
                <span dir="auto" className="min-w-0 flex-1 truncate text-[16px]">{b.displayName ?? "…"}</span>
                <button type="button" onClick={() => void unblockUser(session.client, session.userId, b.userId).then(refresh)} className="min-h-11 rounded-full bg-charcoal/5 px-4 text-[15px] font-semibold">
                  {t.unblock}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      ) : null}

      {edit ? (
        <ProfileEditSheet
          open
          onClose={() => setEdit(false)}
          lang={lang}
          client={session.client}
          userId={session.userId}
          initial={mine.status === "ok" ? mine.profile : null}
          onSaved={() => void refresh()}
          onDeleted={() => void refresh()}
        />
      ) : null}
    </>
  );
}
