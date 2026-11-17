"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/social/Avatar";
import { BlockReportSheet } from "@/components/social/BlockReportSheet";
import { ProfileEditSheet } from "@/components/social/ProfileEditSheet";
import { useSocialClient } from "@/lib/hooks/useSocialClient";
import type { PlannerBridge } from "@/lib/shell/planner-bridge";
import { socialCopy, type SocialLang } from "@/lib/social/copy";
import {
  getMyProfile, getProfileCard, getProfileWalks, requestFriendById,
  type ProfileCard, type ProfileWalk, type SocialProfile,
} from "@/lib/social/profiles";
import { resolvePlaces } from "@/lib/walks/friend-plan";
import type { SavedStop } from "@/lib/walks/saved-walks";

const CARD = "rounded-tk-card bg-paper p-4 shadow-tk-card";

const dayLabel = (iso: string, lang: SocialLang) => new Date(`${iso}T12:00:00`).toLocaleDateString(lang === "he" ? "he-IL" : "en", { day: "numeric", month: "short" });

/** A profile (me, a friend, or a public one). Another person's data arrives only through the database projections. */
export function ProfileView({
  userId: target,
  lang,
  bridge,
  onBack,
}: {
  userId: string;
  lang: SocialLang;
  bridge: PlannerBridge;
  onBack: () => void;
}) {
  const t = socialCopy[lang];
  const session = useSocialClient(true);
  const [card, setCard] = useState<ProfileCard | null | undefined>(undefined);
  const [walks, setWalks] = useState<ProfileWalk[]>([]);
  const [mine, setMine] = useState<SocialProfile | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [sheet, setSheet] = useState<"edit" | "report" | "block" | null>(null);
  const [menu, setMenu] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!session) return;
    let live = true;
    void (async () => {
      const [c, w, me] = await Promise.all([
        getProfileCard(session.client, target),
        getProfileWalks(session.client, target),
        target === session.userId ? getMyProfile(session.client, session.userId) : Promise.resolve(null),
      ]);
      if (!live) return;
      setCard(c);
      setWalks(c ? w : []);
      setMine(me && me.status === "ok" ? me.profile : null);
    })();
    return () => {
      live = false;
    };
  }, [session, target, version]);

  const toggleWalk = (w: ProfileWalk) => {
    const next = open === w.id ? null : w.id;
    setOpen(next);
    const ids = w.stops.flatMap((s) => (s.placeId && !names.has(s.placeId) ? [s.placeId] : []));
    if (next && ids.length > 0) {
      void resolvePlaces(ids).then((found) =>
        setNames((cur) => {
          const m = new Map(cur);
          for (const [id, p] of found) m.set(id, p.name);
          return m;
        }),
      );
    }
  };

  const planWalk = async (w: ProfileWalk) => {
    // Only stops that can be planned: named ones, and Google ones (resolved again by the planner).
    const stops: SavedStop[] = w.stops.flatMap((s): SavedStop[] =>
      s.placeId
        ? [{ name: "", category: s.category, lat: 0, lng: 0, placeId: s.placeId }]
        : s.name && s.lat !== undefined && s.lng !== undefined
          ? [{ name: s.name, category: s.category, lat: s.lat, lng: s.lng }]
          : [],
    );
    bridge.actions?.planSharedWalk({ title: w.areaLabel ?? card?.displayName ?? "", stops });
  };

  if (!session || card === undefined) {
    return (
      <div className="space-y-3 p-4" aria-busy>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 rounded-2xl bg-forest/5 motion-safe:animate-pulse" />
        ))}
      </div>
    );
  }

  const back = (
    <button type="button" onClick={onBack} className="min-h-11 text-[15px] font-semibold text-terra">
      {t.back}
    </button>
  );

  if (card === null) {
    return (
      <div className="space-y-3 pt-6">
        {back}
        <section className={`${CARD} space-y-1`}>
          <h2 className="text-[20px] font-semibold text-tk-ink">{t.private}</h2>
          <p className="text-[16px] text-charcoal/70">{t.privateLine}</p>
        </section>
      </div>
    );
  }

  const isMe = card.relation === "me";
  const hidden = (w: ProfileWalk) => w.stops.filter((s) => !s.placeId && !s.name).length;

  return (
    <div className="space-y-4 pb-6">
      <div className="relative -mx-4 h-[200px] overflow-hidden lg:mx-0 lg:rounded-tk-card">
        <Image src="/images/meadow-hiker.jpg" alt="" fill sizes="(min-width: 1024px) 720px, 100vw" aria-hidden className="object-cover" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-cream/30 to-cream" />
        <div className="absolute start-4 top-[max(12px,env(safe-area-inset-top))]">{back}</div>
        {!isMe ? (
          <div className="absolute end-4 top-[max(12px,env(safe-area-inset-top))]">
            <button type="button" aria-label={t.more} aria-expanded={menu} onClick={() => setMenu((m) => !m)} className="flex h-11 w-11 items-center justify-center rounded-full bg-paper text-[20px] shadow-tk-soft">
              ⋯
            </button>
          </div>
        ) : null}
      {menu ? (
          <div role="menu" className={`${CARD} absolute end-4 top-[64px] z-20 flex flex-col`}>
            <button role="menuitem" type="button" className="min-h-12 text-start text-[16px] font-medium" onClick={() => { setMenu(false); setSheet("block"); }}>
              {t.block}
            </button>
            <button role="menuitem" type="button" className="min-h-12 text-start text-[16px] font-medium" onClick={() => { setMenu(false); setSheet("report"); }}>
              {t.report}
            </button>
          </div>
        ) : null}
      </div>
      <div className="relative z-10 -mt-14 flex items-end gap-3 px-1">
        <Avatar id={card.avatar} size={96} seed={target} />
        <div className="min-w-0 pb-2">
          <h1 dir="auto" className="truncate font-display text-[28px] leading-[34px] text-forest">
            {card.displayName}
          </h1>
          {card.memberSince ? (
            <p className="text-[15px] text-charcoal/70">
              {t.memberSince} {new Date(`${card.memberSince}T12:00:00`).toLocaleDateString(lang === "he" ? "he-IL" : "en", { month: "long", year: "numeric" })}
            </p>
          ) : null}
        </div>
      </div>

      <section className={`${CARD} grid grid-cols-3 gap-2 text-center`} aria-label={t.profile}>
        {[
          [String(card.walkCount), t.walksStat],
          [String(card.kmTotal), t.kmStat],
          [card.topAreas[0] ?? "–", t.areaStat],
        ].map(([n, label]) => (
          <div key={label} className="min-w-0">
            <div dir="auto" className="truncate text-[32px] font-light leading-10 tabular-nums text-tk-ink">
              {n}
            </div>
            <div className="text-[15px] text-charcoal/70">{label}</div>
          </div>
        ))}
      </section>

      {card.tasteTags.length > 0 ? (
        <p className="flex flex-wrap gap-2">
          {card.tasteTags.map((tag) => (
            <span key={tag} className="rounded-full bg-forest/10 px-3 py-1 text-[15px] text-forest">
              {tag}
            </span>
          ))}
        </p>
      ) : null}
      {card.topAreas.length > 0 ? (
        <p className="text-[16px] text-charcoal/80">
          {t.likeToWalk}: <span dir="auto">{card.topAreas.join(" · ")}</span>
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {isMe ? (
          <button type="button" onClick={() => setSheet("edit")} className="min-h-12 rounded-full bg-terra px-6 text-[16px] font-semibold text-on-accent shadow-tk-soft">
            {t.edit}
          </button>
        ) : card.friendState === "none" ? (
          <button
            type="button"
            onClick={() => void requestFriendById(session.client, target).then((ok) => { setNote(ok ? t.sent : t.notSent); setVersion((v) => v + 1); })}
            className="min-h-12 rounded-full bg-terra px-6 text-[16px] font-semibold text-on-accent shadow-tk-soft"
          >
            {t.addFriend}
          </button>
        ) : card.friendState === "pending_out" ? (
          <span className="min-h-12 content-center text-[16px] text-charcoal/70">{t.pending}</span>
        ) : card.friendState === "friends" ? (
          <span className="min-h-12 content-center text-[16px] font-medium text-forest">{t.friendsNow}</span>
        ) : null}
      </div>
      {note ? <p role="status" className="text-[15px] text-forest">{note}</p> : null}
      {isMe ? <p className="text-[15px] text-charcoal/70">{t.howOthersLine}</p> : null}

      <h2 className="pt-2 text-[20px] font-semibold text-tk-ink">{t.recentWalks}</h2>
      {walks.length === 0 ? (
        <p className="text-[16px] text-charcoal/70">{t.noWalks}</p>
      ) : (
        <ul className="space-y-3">
          {walks.map((w) => {
            const extra = hidden(w);
            return (
              <li key={w.id} className={CARD}>
                <button type="button" aria-expanded={open === w.id} onClick={() => toggleWalk(w)} className="flex min-h-12 w-full items-center justify-between gap-3 text-start">
                  <span className="min-w-0">
                    <span dir="auto" className="block truncate text-[18px] font-semibold text-tk-ink">
                      {w.areaLabel ?? dayLabel(w.walkedOn, lang)}
                    </span>
                    <span className="block text-[15px] text-charcoal/70">
                      {dayLabel(w.walkedOn, lang)}
                      {w.distanceM !== null ? ` · ${(w.distanceM / 1000).toFixed(1)} ${t.kmStat}` : ""}
                      {w.totalMin !== null ? ` · ${Math.round(w.totalMin)} ${lang === "he" ? "דק׳" : "min"}` : ""}
                    </span>
                  </span>
                  <span aria-hidden className="text-charcoal/50">{open === w.id ? "▴" : "▾"}</span>
                </button>
                {open === w.id ? (
                  <div className="mt-2 space-y-2 text-[16px]">
                    <ol className="space-y-1">
                      {w.stops.flatMap((s, i) => {
                        const label = s.placeId ? names.get(s.placeId) : s.name;
                        return label ? [<li key={i} dir="auto">{label}</li>] : [];
                      })}
                    </ol>
                    {extra > 0 ? <p className="text-[15px] text-charcoal/70">{t.stopsMore(extra)}</p> : null}
                    {!isMe ? (
                      <button type="button" onClick={() => void planWalk(w)} className="min-h-12 rounded-full bg-terra px-6 text-[16px] font-semibold text-on-accent shadow-tk-soft">
                        {t.walkThis}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {sheet === "edit" ? (
        <ProfileEditSheet open onClose={() => setSheet(null)} lang={lang} client={session.client} userId={session.userId} initial={mine} onSaved={() => setVersion((v) => v + 1)} onDeleted={onBack} />
      ) : null}
      {sheet === "report" || sheet === "block" ? (
        <BlockReportSheet
          open
          onClose={() => setSheet(null)}
          lang={lang}
          client={session.client}
          target={target}
          targetName={card.displayName}
          mode={sheet}
          onDone={(r) => { setNote(r === "reported" ? t.reported : t.blocked); onBack(); }}
        />
      ) : null}
    </div>
  );
}
