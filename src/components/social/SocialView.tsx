"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Avatar } from "@/components/social/Avatar";
import { BlockReportSheet } from "@/components/social/BlockReportSheet";
import { FriendRow } from "@/components/social/FriendRow";
import { MeetCard, RequestCard } from "@/components/social/RequestCard";
import { WalkTogetherSheet } from "@/components/social/WalkTogetherSheet";
import { ProfileEditSheet } from "@/components/social/ProfileEditSheet";
import { ProfileView } from "@/components/social/ProfileView";
import { WalksBand } from "@/components/shell/WalksBand";
import { WalksTabs } from "@/components/shell/WalksTabs";
import { useWalksSummary } from "@/lib/hooks/useWalksSummary";
import { SheetSection } from "@/components/ui/SheetSection";
import { BTN, BTN_ALT_SM, BTN_SM, FIELD, chipCell } from "@/components/ui/panel-style";
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

const PRIMARY = BTN_SM;
const SOFT = BTN_ALT_SM;
const MUTED = "text-[14px] leading-5 text-tk-sage";

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
  const summary = useWalksSummary(signedIn);
  const openWalks = (tab: "saved" | "walked" | "friends") => {
    if (tab !== "friends") window.history.pushState(null, "", `/app?view=walks&tab=${tab === "walked" ? "history" : "saved"}`);
  };

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
      <Shell lang={lang} band={<WalksBand lang={lang} summary={null} />}>
        <SheetSection className="text-center">
          <p className="text-[18px] font-semibold text-tk-ink">{t.needSignIn}</p>
          <Link href="/login" className={BTN}>
            {t.logIn}
          </Link>
        </SheetSection>
      </Shell>
    );
  }

  if (nearbyToken && nearbyEnabled() && session) {
    return (
      <Shell lang={lang} band={null}>
        <ProfileView userId={null} nearbyToken={nearbyToken} lang={lang} bridge={bridge} canWalkTogether={requestsAvailable} onBack={() => { go(""); void refresh(); }} />
      </Shell>
    );
  }

  if (profileId && session) {
    return (
      <Shell lang={lang} band={null}>
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
      <button type="button" aria-label={t.invite} onClick={() => void invite()} className={`${BTN_ALT_SM} !px-0 w-11 text-[22px] leading-none`}>
        +
      </button>
    </>
  );

  const band = (
    <>
      <WalksBand lang={lang} summary={summary} actions={headerActions} />
      <WalksTabs lang={lang} value="friends" summary={summary ? { ...summary, friends: accepted.length } : ready ? { saved: 0, walked: 0, km: 0, friends: accepted.length } : null} onChange={openWalks} />
    </>
  );

  return (
    <Shell lang={lang} band={band} columns>
      {addCode ? (
        <SheetSection title={t.addFriendTitle}>
          <p className="text-[16px]">{t.addFriendLine}</p>
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
        </SheetSection>
      ) : null}

      {profilesOn && mine.status === "none" ? (
        <SheetSection>
          <p className="text-[18px] font-semibold leading-6 text-tk-ink">{t.createTitle}</p>
          <button type="button" className={BTN} onClick={() => setEdit(true)}>
            {t.createCta}
          </button>
        </SheetSection>
      ) : null}

      {showPresence && now?.available ? (
        <SheetSection
          flush
          title={t.walkingNow}
          aside={
            <button type="button" aria-pressed={myAudience !== "off"} onClick={() => void toggleAudience()} className={`${chipCell(myAudience !== "off")} !min-h-9 !py-0`}>
              {myAudience === "off" ? t.shareOff : myAudience === "friends" ? t.shareFriends : t.shareNearby}
            </button>
          }
        >
          {myAudience === "off" ? (
            <p className="tk-row text-[16px]">{t.turnOnToSee}</p>
          ) : now.rows.length === 0 ? (
            <p className="tk-row text-[16px]">{t.nobodyWalking}</p>
          ) : (
            <ul>
              {now.rows.map((r) => (
                <li key={r.token} className="tk-row">
                  <button type="button" disabled={!r.profileVisible} onClick={() => (r.friendId ? openProfile(r.friendId) : go(`&w=${r.token}`))} className="flex min-h-12 min-w-0 flex-1 items-center gap-3 text-start">
                    <Avatar id={r.avatar} size={40} seed={r.friendId ?? r.token} />
                    <span className="min-w-0">
                      <span className="block truncate text-[17px] font-semibold text-tk-ink">
                        <bdi>{r.displayName}</bdi>
                        {r.relation === "nearby" ? <span className="ms-2 rounded-full bg-skysoft/30 px-2 py-0.5 text-[13px] font-medium text-tk-ink">{t.nearby}</span> : null}
                      </span>
                      <span className={`block truncate ${MUTED}`}>
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
          <p className={`px-4 py-2 ${MUTED}`}>{myAudience === "public" ? t.nearbyLine1 : t.shareLine}</p>
        </SheetSection>
      ) : null}

      {openRequests.length > 0 ? (
        <SheetSection flush title={t.walkRequests}>
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
        </SheetSection>
      ) : null}

      {incoming.length > 0 ? (
        <SheetSection flush title={t.requests}>
          <ul>
            {incoming.map((f) => (
              <li key={f.friendshipId} className="tk-row !items-start">
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
        </SheetSection>
      ) : null}

      <SheetSection flush title={t.friends} aside={sent.length > 0 ? <span className="text-[14px] font-medium text-tk-sage">{t.waiting}: {sent.length}</span> : undefined}>
        {!ready ? (
          <div aria-busy className="tk-row"><div className="h-10 w-full rounded-[10px] bg-tk-bar motion-safe:animate-pulse" /></div>
        ) : accepted.length === 0 ? (
          <p className="tk-row text-[16px] text-tk-body">{t.noFriends}</p>
        ) : (
          <ul>
            {accepted.map((f) => (
              <li key={f.friendshipId} className="border-b border-tk-hair">
                <div className="flex min-h-14 items-center gap-3 px-4">
                  <FriendRow
                    friend={f}
                    onOpen={profilesOn && f.displayName ? () => openProfile(f.friendId) : undefined}
                    trailing={
                      <button type="button" aria-label={t.more} aria-expanded={menuFor === f.friendshipId} onClick={() => setMenuFor(menuFor === f.friendshipId ? null : f.friendshipId)} className="flex h-11 w-11 items-center justify-center text-[20px] text-tk-sage">
                        ⋯
                      </button>
                    }
                  />
                </div>
                {menuFor === f.friendshipId ? (
                  <div role="menu" className="flex flex-wrap gap-2 px-4 pb-3">
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
      </SheetSection>

      {walks.length > 0 ? (
        <SheetSection flush title={t.feed}>
          {walks.map((w) => (
            <article key={w.id} className="tk-row">
              <div className="min-w-0 flex-1">
                <p className={`truncate ${MUTED}`}><bdi>{w.ownerLabel}</bdi></p>
                <h3 className="text-[17px] font-semibold leading-6 text-tk-ink"><bdi>{w.title}</bdi></h3>
                <p className={MUTED}>
                  {w.totalMin !== null ? `${Math.round(w.totalMin)} ${lang === "he" ? "דק׳" : "min"}` : ""}
                  {w.distanceM !== null ? ` · ${(w.distanceM / 1000).toFixed(1)} ${t.kmStat}` : ""}
                </p>
              </div>
              <button type="button" className={PRIMARY} onClick={() => bridge.actions?.planSharedWalk({ title: w.title, stops: w.stops })}>
                {t.walkThis}
              </button>
            </article>
          ))}
        </SheetSection>
      ) : null}

      <SheetSection title={t.addByCode}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[16px] text-tk-body">
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
          <input value={codeInput} onChange={(e) => setCodeInput(e.target.value)} placeholder={t.codePlaceholder} dir="ltr" maxLength={12} className={`${FIELD} min-h-11`} />
          <button type="submit" className={PRIMARY} disabled={codeInput.trim().length < 6}>
            {t.send}
          </button>
        </form>
        <button type="button" className={`${BTN} w-full`} onClick={() => void invite()}>
          {t.invite}
        </button>
        {note ? <p role="status" className="text-[15px] font-semibold text-tk-check">{note}</p> : null}
      </SheetSection>

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

function Shell({ lang, band, children, columns = false }: { lang: SocialLang; /** The painted band; null for a person's profile, which has its own header. */ band: React.ReactNode; children: React.ReactNode; /** Tablet and desktop: the sections flow in two columns (the friends screen); a short message stays centred in one. */ columns?: boolean }) {
  return (
    <div dir={lang === "he" ? "rtl" : "ltr"} className="fixed inset-0 z-[900] overflow-y-auto bg-cream font-app-sans text-charcoal lg:start-[72px]">
      {band}
      <div className={`tk-page flex flex-col pb-[calc(96px+env(safe-area-inset-bottom))] lg:pb-12 ${band ? "" : "gap-4 px-4"}`}>{columns ? <div className="tk-cols-2">{children}</div> : children}</div>
    </div>
  );
}
