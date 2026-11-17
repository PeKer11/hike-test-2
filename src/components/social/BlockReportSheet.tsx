"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useState } from "react";

import { ModalSheet } from "@/components/ui/ModalSheet";
import { socialCopy, type SocialLang } from "@/lib/social/copy";
import { blockUser, reportUser, type ReportContext, type ReportReason } from "@/lib/social/profiles";

const REASONS: ReportReason[] = ["harassment", "spam", "fake", "unsafe", "minor", "other"];

/**
 * Report (with "block them too" ticked: a safety choice, the only pre-ticked box in the app) or just block.
 * Blocking is silent: the other person is never told.
 */
export function BlockReportSheet({
  open,
  onClose,
  lang,
  client,
  target,
  targetName,
  context = "profile",
  mode = "report",
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  lang: SocialLang;
  client: SupabaseClient;
  target: string;
  targetName: string;
  context?: ReportContext;
  mode?: "report" | "block";
  onDone: (result: "reported" | "blocked") => void;
}) {
  const t = socialCopy[lang];
  const [reason, setReason] = useState<ReportReason>("harassment");
  const [note, setNote] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const submit = async (kind: "report" | "block") => {
    setBusy(true);
    setFailed(false);
    // Block first, so the person is gone from every list even if the report call then fails.
    const blocked = kind === "block" || alsoBlock ? await blockUser(client, target) : true;
    const reported = kind === "report" ? await reportUser(client, target, context, reason, note) : true;
    setBusy(false);
    if (blocked && reported) {
      onDone(kind === "report" ? "reported" : "blocked");
      onClose();
    } else setFailed(true);
  };

  return (
    <ModalSheet open={open} onClose={onClose} title={mode === "block" ? t.block : t.reportTitle}>
      <div className="space-y-4 text-charcoal">
        <h2 className="font-display text-[24px] leading-7 text-forest">
          {mode === "block" ? t.block : t.reportTitle}: <span dir="auto">{targetName}</span>
        </h2>
        {mode === "report" ? (
          <>
            <p className="text-[15px] text-charcoal/70">{t.reportLine}</p>
            <div role="radiogroup" aria-label={t.reportTitle} className="flex flex-wrap gap-2">
              {REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={reason === r}
                  onClick={() => setReason(r)}
                  className={`min-h-11 rounded-full px-4 text-[15px] font-medium ${reason === r ? "bg-terra/15 text-terra shadow-tk-soft" : "bg-charcoal/5"}`}
                >
                  {t.reasons[r]}
                </button>
              ))}
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder={t.note}
              className="w-full rounded-2xl bg-charcoal/5 p-3 text-[16px] outline-none focus:bg-charcoal/10"
            />
            <label className="flex min-h-11 items-center gap-3 text-[16px]">
              <input type="checkbox" checked={alsoBlock} onChange={(e) => setAlsoBlock(e.target.checked)} className="h-5 w-5 accent-[var(--tk-terra)]" />
              {t.alsoBlock}
            </label>
          </>
        ) : null}
        {failed ? (
          <p role="alert" className="text-[15px] font-medium text-terra">
            {lang === "he" ? "לא הצלחנו. אפשר לנסות שוב." : "That didn't go through. Try again."}
          </p>
        ) : null}
        <button type="button" disabled={busy} onClick={() => void submit(mode)} className="min-h-14 w-full rounded-full bg-terra text-[17px] font-semibold text-on-accent shadow-tk-soft disabled:opacity-60">
          {mode === "block" ? t.block : t.submit}
        </button>
        {mode === "report" ? (
          <button type="button" disabled={busy} onClick={() => void submit("block")} className="min-h-11 w-full text-[15px] font-semibold text-charcoal/70">
            {t.blockOnly}
          </button>
        ) : null}
      </div>
    </ModalSheet>
  );
}
