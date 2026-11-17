"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Avatar } from "@/components/social/Avatar";
import { BlockReportSheet } from "@/components/social/BlockReportSheet";
import { FriendRow } from "@/components/social/FriendRow";
import { MeetCard, RequestCard } from "@/components/social/RequestCard";
import { WalkTogetherSheet } from "@/components/social/WalkTogetherSheet";
import { ProfileEditSheet } from "@/components/social/ProfileEditSheet";
import { ProfileView } from "@/components/social/ProfileView";
import { ScreenHeader } from "@/components/shell/ScreenHeader";
import { meetLabel, useMeetNames } from "@/lib/hooks/useMeetNames";
import { useSocialClient } from "@/lib/hooks/useSocialClient";
import type { PlannerBridge } from "@/lib/shell/planner-bridge";
import { socialCopy, type SocialLang } from "@/lib/social/copy";
import { nearbyEnabled, presenceEnabled, socialProfilesEnabled } from "@/lib/social/flag";
import { distanceCopy, fetchWalkingNow, sinceCopy, type WalkingNowRow } from "@/lib/social/presence";
import { getMyProfile, saveProfile, type MyProfile, type PresenceAudience } from "@/lib/social/profiles";
import { cancelRequest, mapProviderNow, respondToRequest, setRequestNote, type MeetChoice, type WalkRequest } from "@/lib/social/walk-requests";
import {
  acceptFriend, getMyFriendCode, listFriends, listFriendsWalks, removeFriendship, requestFriend,
  type FriendRow as Friend, type FriendWalk,
} from "@/lib/walks/friends";

const CARD = "rounded-tk-card bg-paper p-4 shadow-tk-card";
const PRIMARY = "min-h-12 rounded-full bg-terra px-6 text-[16px] font-semibold text-on-accent shadow-tk-soft";
const SOFT = "min-h-11 rounded-full bg-charcoal/5 px-4 text-[15px] font-semibold text-charcoal";

const go = (search: string) => window.history.pushState(null, "", `/app?view=social${search}`);

/**
 * Social: friends, requests, the friends' routes feed, invite, and (when profiles are on and applied) the walker's own
 * profile and other people's profiles. Without profiles it is exactly today's friends features.
 */
export function SocialView({
  lang,
  bridge,
  signedIn,
  profileId,
  nearbyToken = null,
  addCode,
  requests = [],
  requestsAvailable = false,
  walkLive = false,
}: {
  lang: SocialLang;
  bridge: PlannerBridge;
  signedIn: boolean;
  /** `?u=`: show this person's profile. */
  profileId: string | null;
  /** `?w=`: a nearby walker's card, by presence token (phase 8, only with the nearby flag). */
  nearbyToken?: string | null;
  /** `?add=`: an invite link, to confirm. */
  addCode: string | null;
  /** Walk-together requests from the planner's inbox (last 24 h). */
  requests?: readonly WalkRequest[];
  requestsAvailable?: boolean;
  walkLive?: boolean;
}) {
  const t = socialCopy[lang];
  const session = useSocialClient(signedIn);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [walks, setWalks] = useState<FriendWalk[]>([]);
  const [code, setCode] = useState<string | null>(null);
  const [mine, setMine] = useState<MyProfile>({ status: "unavailable" });
  const [ready, setReady] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [edit, setEdit] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ friend: Friend; mode: "report" | "block" } | null>(null);
  const [together, setTogether] = useState<{ friend: { id: string; name: string }; choices: MeetChoice[]; token?: string } | null>(null);
  const [senderSheet, setSenderSheet] = useState<WalkRequest | null>(null);
  const meetNames = useMeetNames(requests);

  const refresh = useCallback(async () => {
    if (!session) return;
    const [f, w, c, p] = await Promise.all([
      listFriends(session.client),
      listFriendsWalks(session.client),
      getMyFriendCode(session.client),
      getMyProfile(session.client, session.userId),
    ]);
    setFriends(f);
    setWalks(w);
    setCode(c);
    setMine(p);
    setReady(true);
  }, [session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const profilesOn = socialProfilesEnabled() && mine.status !== "unavailable";

  // Who is walking now: polled once a minute, only while this screen is open and visible.
  const showPresence = presenceEnabled() && mine.status === "ok";
  const [now, setNow] = useState<{ available: boolean; rows: WalkingNowRow[] } | null>(null);
  useEffect(() => {
    if (!showPresence || profileId) return;
    let live = true;
    const load = () => {
      if (document.visibilityState === "hidden") return;
      void fetchWalkingNow().then((r) => live && setNow(r));
    };
    load();
    const id = window.setInterval(load, 60_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [showPresence, profileId]);

  const myAudience: PresenceAudience = mine.status === "ok" ? mine.profile.presenceAudience : "off";
  const toggleAudience = async () => {
    if (mine.status !== "ok" || !session) return;
    const p = mine.profile;
    const next: PresenceAudience = p.presenceAudience === "off" ? "friends" : "off";
    await saveProfile(session.client, { displayName: p.displayName, avatar: p.avatar, visibility: p.visibility, showHistory: p.showHistory, showTaste: p.showTaste, presenceAudience: next, adult: true });
    await refresh();
  };

  if (!signedIn) {
    return (
      <Shell lang={lang} title={t.title}>
        <section className={`${CARD} space-y-3 text-center`}>
          <p className="text-[18px] font-semibold text-tk-ink">{t.needSignIn}</p>
          <Link href="/login" className={`${PRIMARY} inline-flex items-center`}>
            {t.logIn}
          </Link>
        </section>
      </Shell>
    );
  }

  if (nearbyToken && nearbyEnabled() && session) {
    return (
      <Shell lang={lang} title={null}>
        <ProfileView userId={null} nearbyToken={nearbyToken} lang={lang} bridge={bridge} canWalkTogether={requestsAvailable} onBack={() => { go(""); void refresh(); }} />
      </Shell>
    );
  }

  if (profileId && session) {
    return (
      <Shell lang={lang} title={null}>
        <ProfileView userId={profileId} lang={lang} bridge={bridge} canWalkTogether={requestsAvailable} onBack={() => { go(""); void refresh(); }} />
      </Shell>
    );
  }

  const withClient = (fn: (c: NonNullable<typeof session>["client"]) => Promise<boolean>) => (session ? fn(session.client) : Promise.resolve(false));
  const act = async (fn: () => Promise<boolean>, fail: string) => {
    setNote((await fn()) ? null : fail);
    await refresh();
  };

  const incoming = friends.filter((f) => f.status === "pending" && f.incoming);
  const accepted = friends.filter((f) => f.status === "accepted");
  const sent = friends.filter((f) => f.status === "pending" && !f.incoming);

  const invite = async () => {
    if (!code) return;
    const url = `${window.location.origin}/app?view=social&add=${code}`;
    try {
      if (navigator.share) await navigator.share({ url, text: t.inviteMsg });
      else {
        await navigator.clipboard.writeText(url);
        setNote(t.inviteCopied);
      }
    } catch {
      // Share sheet dismissed: nothing to do.
    }
  };

  const openProfile = (id: string) => go(`&u=${id}`);
  const openTogether = (id: string, name: string) => setTogether({ friend: { id, name }, choices: bridge.actions?.meetingChoices() ?? [] });
  const answer = (fn: () => Promise<boolean>) => void fn().then(() => bridge.actions?.refreshInbox());
  const openRequests = requestsAvailable ? requests.filter((r) => r.status === "pending" || r.status === "accepted") : [];
  const fallbackPlace = t.publicPlace;

  const headerActions = (
    <>
      {profilesOn && mine.status === "ok" ? (
        <button type="button" aria-label={t.me} onClick={() => openProfile(session?.userId ?? "")} className="flex h-11 w-11 items-center justify-center">
          <Avatar id={mine.profile.avatar} size={40} seed={session?.userId} />
        </button>
      ) : null}
      <button type="button" aria-label={t.invite} onClick={() => void invite()} className="flex h-11 w-11 items-center justify-center rounded-full bg-paper text-[22px] text-forest shadow-tk-soft">
        +
      </button>
    </>
  );

  return (
    <Shell lang={lang} title={t.title} actions={headerActions}>
      {addCode ? (
        <section className={`${CARD} space-y-2`} aria-label={t.addFriendTitle}>
          <h2 className="text-[20px] font-semibold text-tk-ink">{t.addFriendTitle}</h2>
          <p className="text-[16px] text-charcoal/70">{t.addFriendLine}</p>
          <div className="flex gap-2">
            <button
              type="button"
              className={PRIMARY}
              onClick={() => void act(() => requestFriend(session!.client, addCode), t.notSent).then(() => window.history.replaceState(null, "", "/app?view=social"))}
            >
              {t.add}
            </button>
            <button type="button" className={SOFT} onClick={() => window.history.replaceState(null, "", "/app?view=social")}>
              {t.cancel}
            </button>
          </div>
        </section>
      ) : null}

      {profilesOn && mine.status === "none" ? (
        <section className={`${CARD} relative space-y-3 pe-24`}>
          <Image src="/images/traike/accessories/backpack.png" alt="" width={96} height={96} aria-hidden className="pointer-events-none absolute -top-4 end-3 h-20 w-auto drop-shadow-xl" />
          <p className="text-[18px] font-semibold leading-6 text-tk-ink">{t.createTitle}</p>
          <button type="button" className={PRIMARY} onClick={() => setEdit(true)}>
            {t.createCta}
          </button>
        </section>
      ) : null}

      {showPresence && now?.available ? (
        <section className={`${CARD} space-y-2`} aria-label={t.walkingNow}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[20px] font-semibold text-tk-ink">{t.walkingNow}</h2>
            <button type="button" aria-pressed={myAudience !== "off"} onClick={() => void toggleAudience()} className={`min-h-11 rounded-full px-4 text-[15px] font-semibold ${myAudience === "off" ? "bg-charcoal/5 text-charcoal" : "bg-forest/10 text-forest"}`}>
              {myAudience === "off" ? t.shareOff : myAudience === "friends" ? t.shareFriends : t.shareNearby}
            </button>
          </div>
          {myAudience === "off" ? (
            <p className="text-[16px] text-charcoal/70">{t.turnOnToSee}</p>
          ) : now.rows.length === 0 ? (
            <p className="text-[16px] text-charcoal/70">{t.nobodyWalking}</p>
          ) : (
            <ul>
              {now.rows.map((r) => (
                <li key={r.token} className="flex min-h-14 items-center gap-3">
                  <button type="button" disabled={!r.profileVisible} onClick={() => (r.friendId ? openProfile(r.friendId) : go(`&w=${r.token}`))} className="flex min-h-12 min-w-0 flex-1 items-center gap-3 text-start">
                    <Avatar id={r.avatar} size={40} seed={r.friendId ?? r.token} />
                    <span className="min-w-0">
                      <span dir="auto" className="block truncate text-[17px] font-medium text-tk-ink">
                        {r.displayName}
                        {r.relation === "nearby" ? <span className="ms-2 rounded-full bg-skysoft/30 px-2 py-0.5 text-[13px] font-medium text-forest">{t.nearby}</span> : null}
                      </span>
                      <span dir="auto" className="block truncate text-[15px] text-charcoal/70">
                        {[r.areaLabel, r.distance && r.distance !== "far" ? distanceCopy[lang][r.distance] : null, sinceCopy[lang][r.since]].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </button>
                  {requestsAvailable && r.friendId ? (
                    <button type="button" className={SOFT} onClick={() => openTogether(r.friendId as string, r.displayName)}>
                      {t.walkTogether}
                    </button>
                  ) : null}
                  {requestsAvailable && !r.friendId && nearbyEnabled() ? (
                    <button type="button" className={SOFT} onClick={() => setTogether({ friend: { id: "", name: r.displayName }, choices: bridge.actions?.meetingChoices() ?? [], token: r.token })}>
                      {t.walkTogether}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <p className="text-[15px] text-charcoal/70">{myAudience === "public" ? t.nearbyLine1 : t.shareLine}</p>
        </section>
      ) : null}

      {openRequests.length > 0 ? (
        <section className="space-y-3" aria-label={t.walkRequests}>
          <h2 className="text-[20px] font-semibold text-tk-ink">{t.walkRequests}</h2>
          {openRequests.map((r) =>
            r.status === "accepted" ? (
              <MeetCard
                key={r.id}
                request={r}
                lang={lang}
                placeName={meetLabel(r, meetNames, fallbackPlace)}
                canAddToRoute={walkLive}
                onNote={(code) => answer(() => withClient((c) => setRequestNote(c, r.id, code)))}
                onAddToRoute={() => bridge.actions?.addMeetingToWalk(r.meet)}
                onCancel={() => answer(() => withClient((c) => cancelRequest(c, r.id)))}
              />
            ) : (
              <RequestCard
                key={r.id}
                request={r}
                lang={lang}
                placeName={meetLabel(r, meetNames, fallbackPlace)}
                onAccept={() => answer(() => withClient((c) => respondToRequest(c, r.id, true)))}
                onDecline={() => answer(() => withClient((c) => respondToRequest(c, r.id, false)))}
                onCancel={() => answer(() => withClient((c) => cancelRequest(c, r.id)))}
                onMore={() => setSenderSheet(r)}
              />
            ),
          )}
        </section>
      ) : null}

      {incoming.length > 0 ? (
        <section className={`${CARD} space-y-1`} aria-label={t.requests}>
          <h2 className="text-[20px] font-semibold text-tk-ink">{t.requests}</h2>
          <ul>
            {incoming.map((f) => (
              <li key={f.friendshipId}>
              <FriendRow
                friend={f}
                stacked
                trailing={
                  <span className="flex gap-2">
                    <button type="button" className={PRIMARY} onClick={() => void act(() => acceptFriend(session!.client, f.friendshipId), t.notSent)}>
                      {t.accept}
                    </button>
                    <button type="button" className={SOFT} onClick={() => void act(() => removeFriendship(session!.client, f.friendshipId), t.notSent)}>
                      {t.decline}
                    </button>
                  </span>
                }
              />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={`${CARD} space-y-2`} aria-label={t.friends}>
        <h2 className="text-[20px] font-semibold text-tk-ink">{t.friends}</h2>
        {!ready ? (
          <div aria-busy className="h-14 rounded-2xl bg-forest/5 motion-safe:animate-pulse" />
        ) : accepted.length === 0 ? (
          <p className="text-[16px] text-charcoal/70">{t.noFriends}</p>
        ) : (
          <ul>
            {accepted.map((f) => (
              <li key={f.friendshipId}>
                <FriendRow
                  friend={f}
                  onOpen={profilesOn && f.displayName ? () => openProfile(f.friendId) : undefined}
                  trailing={
                    <button type="button" aria-label={t.more} aria-expanded={menuFor === f.friendshipId} onClick={() => setMenuFor(menuFor === f.friendshipId ? null : f.friendshipId)} className="flex h-11 w-11 items-center justify-center text-[20px] text-charcoal/70">
                      ⋯
                    </button>
                  }
                />
                {menuFor === f.friendshipId ? (
                  <div role="menu" className="mb-2 flex flex-wrap gap-2 ps-12">
                    <button role="menuitem" type="button" className={SOFT} onClick={() => { setMenuFor(null); void act(() => removeFriendship(session!.client, f.friendshipId), t.notSent); }}>
                      {lang === "he" ? "הסרה" : "Remove"}
                    </button>
                    {profilesOn ? (
                      <>
                        <button role="menuitem" type="button" className={SOFT} onClick={() => { setMenuFor(null); setSheet({ friend: f, mode: "block" }); }}>
                          {t.block}
                        </button>
                        <button role="menuitem" type="button" className={SOFT} onClick={() => { setMenuFor(null); setSheet({ friend: f, mode: "report" }); }}>
                          {t.report}
                        </button>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {sent.length > 0 ? <p className="text-[15px] text-charcoal/70">{t.waiting}: {sent.length}</p> : null}
      </section>

      {walks.length > 0 ? (
        <section className="space-y-3" aria-label={t.feed}>
          <h2 className="text-[20px] font-semibold text-tk-ink">{t.feed}</h2>
          {walks.map((w) => (
            <article key={w.id} className={`${CARD} space-y-1`}>
              <p dir="auto" className="text-[15px] text-charcoal/70">{w.ownerLabel}</p>
              <h3 dir="auto" className="text-[18px] font-semibold leading-6 text-tk-ink">{w.title}</h3>
              <p className="text-[15px] text-charcoal/70">
                {w.totalMin !== null ? `${Math.round(w.totalMin)} ${lang === "he" ? "דק׳" : "min"}` : ""}
                {w.distanceM !== null ? ` · ${(w.distanceM / 1000).toFixed(1)} ${t.kmStat}` : ""}
              </p>
              <button type="button" className={`${PRIMARY} mt-2`} onClick={() => bridge.actions?.planSharedWalk({ title: w.title, stops: w.stops })}>
                {t.walkThis}
              </button>
            </article>
          ))}
        </section>
      ) : null}

      <section className={`${CARD} space-y-3`} aria-label={t.addByCode}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[16px] text-charcoal/80">
            {t.myCode}: <strong dir="ltr" className="font-mono tracking-wider text-tk-ink">{code ?? "…"}</strong>
          </span>
          {code ? (
            <button type="button" className={SOFT} onClick={() => void navigator.clipboard?.writeText(code).catch(() => undefined)}>
              {t.copy}
            </button>
          ) : null}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = codeInput;
            setCodeInput("");
            void act(() => requestFriend(session!.client, v).then((ok) => { if (ok) setNote(t.sent); return ok; }), t.notSent);
          }}
        >
          <input value={codeInput} onChange={(e) => setCodeInput(e.target.value)} placeholder={t.codePlaceholder} dir="ltr" maxLength={12} className="min-h-12 min-w-0 flex-1 rounded-2xl bg-charcoal/5 px-4 text-[16px] outline-none focus:bg-charcoal/10" />
          <button type="submit" className={PRIMARY} disabled={codeInput.trim().length < 6}>
            {t.send}
          </button>
        </form>
        <button type="button" className={`${PRIMARY} w-full`} onClick={() => void invite()}>
          {t.invite}
        </button>
        {note ? <p role="status" className="text-[15px] text-forest">{note}</p> : null}
      </section>

      {edit && session ? (
        <ProfileEditSheet open onClose={() => setEdit(false)} lang={lang} client={session.client} userId={session.userId} initial={null} onSaved={() => void refresh()} onDeleted={() => void refresh()} />
      ) : null}
      {together && session ? (
        <WalkTogetherSheet
          open
          onClose={() => setTogether(null)}
          lang={lang}
          client={session.client}
          friend={together.friend}
          choices={together.choices}
          mapProvider={mapProviderNow()}
          nearbyToken={together.token}
          onSent={() => { setNote(t.requestSent); bridge.actions?.refreshInbox(); }}
        />
      ) : null}
      {senderSheet && session ? (
        <BlockReportSheet
          open
          onClose={() => setSenderSheet(null)}
          lang={lang}
          client={session.client}
          target={senderSheet.otherId}
          targetName={senderSheet.otherName}
          context="walk_request"
          onDone={() => bridge.actions?.refreshInbox()}
        />
      ) : null}
      {sheet && session ? (
        <BlockReportSheet
          open
          onClose={() => setSheet(null)}
          lang={lang}
          client={session.client}
          target={sheet.friend.friendId}
          targetName={sheet.friend.label}
          mode={sheet.mode}
          onDone={() => void refresh()}
        />
      ) : null}
    </Shell>
  );
}

function Shell({ lang, title, actions, children }: { lang: SocialLang; title: string | null; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div dir={lang === "he" ? "rtl" : "ltr"} className="fixed inset-0 z-[900] overflow-y-auto bg-cream font-brand text-charcoal lg:start-[72px]">
      <Image src="/images/meadow-hikers.jpg" alt="" fill priority sizes="100vw" aria-hidden className="scale-105 object-cover object-center blur-lg dark:hidden" />
      <Image src="/images/hub-night.jpg" alt="" fill sizes="100vw" aria-hidden className="hidden scale-105 object-cover object-center blur-lg dark:block" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-cream/85 via-cream/75 to-cream/90 dark:from-cream/80 dark:via-cream/85 dark:to-cream/95" />
      <div className="relative mx-auto flex w-full max-w-[560px] flex-col gap-4 px-4 pb-[calc(96px+env(safe-area-inset-bottom))] lg:max-w-[720px] lg:pb-12">
        {title ? <ScreenHeader title={title} actions={actions} /> : null}
        {children}
      </div>
    </div>
  );
}
