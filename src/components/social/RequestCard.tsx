"use client";

import { Avatar } from "@/components/social/Avatar";
import { socialCopy, type SocialLang } from "@/lib/social/copy";
import { NOTE_CODES, type NoteCode, type WalkRequest } from "@/lib/social/walk-requests";

const CARD = "space-y-2 rounded-tk-card bg-paper p-4 shadow-tk-card";
const PRIMARY = "min-h-12 rounded-full bg-terra px-6 text-[16px] font-semibold text-on-accent shadow-tk-soft";
const SOFT = "min-h-11 rounded-full bg-charcoal/5 px-4 text-[15px] font-semibold text-charcoal";

const clock = (iso: string, lang: SocialLang) => new Date(iso).toLocaleTimeString(lang === "he" ? "he-IL" : "en", { hour: "2-digit", minute: "2-digit" });

/** A walk request waiting for an answer: incoming (accept / not now / more) or one I sent (cancel). */
export function RequestCard({
  request,
  lang,
  placeName,
  onAccept,
  onDecline,
  onCancel,
  onMore,
}: {
  request: WalkRequest;
  lang: SocialLang;
  placeName: string;
  onAccept: () => void;
  onDecline: () => void;
  onCancel: () => void;
  /** Opens block / report for the sender. */
  onMore: () => void;
}) {
  const t = socialCopy[lang];
  const incoming = request.direction === "in";
  return (
    <article className={CARD} aria-label={t.walkRequests}>
      <div className="flex items-center gap-3">
        <Avatar id={request.otherAvatar} size={40} seed={request.otherId} />
        <div className="min-w-0 flex-1">
          <h3 dir="auto" className="text-[18px] font-semibold leading-6 text-tk-ink">
            {incoming ? t.wantsToWalk(request.otherName) : t.waitingFor(request.otherName)}
          </h3>
          <p dir="auto" className="text-[15px] text-charcoal/70">
            {t.placeTime(placeName, clock(request.meetAt, lang))}
          </p>
        </div>
        {incoming ? (
          <button type="button" aria-label={t.more} onClick={onMore} className="flex h-11 w-11 items-center justify-center text-[20px] text-charcoal/70">
            ⋯
          </button>
        ) : null}
      </div>
      <div className="flex gap-2">
        {incoming ? (
          <>
            <button type="button" className={PRIMARY} onClick={onAccept}>
              {t.accept}
            </button>
            <button type="button" className={SOFT} onClick={onDecline}>
              {t.decline}
            </button>
          </>
        ) : (
          <button type="button" className={SOFT} onClick={onCancel}>
            {t.cancelRequest}
          </button>
        )}
      </div>
    </article>
  );
}

/** An accepted request: where and when, a fixed set of note chips (no free text), add to the live route, cancel. */
export function MeetCard({
  request,
  lang,
  placeName,
  canAddToRoute,
  onNote,
  onAddToRoute,
  onCancel,
}: {
  request: WalkRequest;
  lang: SocialLang;
  placeName: string;
  /** Only while a walk is live. */
  canAddToRoute: boolean;
  onNote: (code: NoteCode) => void;
  onAddToRoute: () => void;
  onCancel: () => void;
}) {
  const t = socialCopy[lang];
  return (
    <article className={CARD} aria-label={t.meetingAt(placeName, clock(request.meetAt, lang))}>
      <div className="flex items-center gap-3">
        <Avatar id={request.otherAvatar} size={40} seed={request.otherId} />
        <h3 dir="auto" className="min-w-0 flex-1 text-[18px] font-semibold leading-6 text-tk-ink">
          {t.meetingAt(placeName, clock(request.meetAt, lang))}
        </h3>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t.walkRequests}>
        {NOTE_CODES.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={request.myNote === c}
            onClick={() => onNote(c)}
            className={`min-h-11 rounded-full px-4 text-[15px] font-medium ${request.myNote === c ? "bg-terra/15 text-terra shadow-tk-soft" : "bg-charcoal/5"}`}
          >
            {t.notes[c]}
          </button>
        ))}
      </div>
      {request.theirNote ? <p className="text-[15px] text-charcoal/80">{t.theirNote(request.otherName, t.notes[request.theirNote])}</p> : null}
      <div className="flex gap-2">
        {canAddToRoute ? (
          <button type="button" className={PRIMARY} onClick={onAddToRoute}>
            {t.addToRoute}
          </button>
        ) : null}
        <button type="button" className={SOFT} onClick={onCancel}>
          {t.cancelRequest}
        </button>
      </div>
    </article>
  );
}
