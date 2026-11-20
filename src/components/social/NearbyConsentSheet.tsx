"use client";

import Image from "next/image";
import { useState } from "react";

import { ModalSheet } from "@/components/ui/ModalSheet";
import { socialCopy, type SocialLang } from "@/lib/social/copy";
import { BTN } from "@/components/ui/panel-style";

/**
 * Its own consent for sharing with strangers nearby (phase 8): three plain lines, an unticked box, one button that
 * stays disabled until the box is ticked. Shown only when the nearby feature flag is on.
 */
export function NearbyConsentSheet({ open, onClose, onConfirm, lang }: { open: boolean; onClose: () => void; onConfirm: () => void; lang: SocialLang }) {
  const t = socialCopy[lang];
  const [agreed, setAgreed] = useState(false);
  return (
    <ModalSheet open={open} onClose={onClose} title={t.nearbyTitle}>
      <div className="space-y-4 text-charcoal">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-[24px] leading-7 text-forest">{t.nearbyTitle}</h2>
          <Image src="/images/traike/accessories/binoculars.png" alt="" width={72} height={72} aria-hidden className="h-16 w-auto shrink-0" />
        </div>
        <ul className="space-y-2 text-[16px] leading-6">
          <li>{t.nearbyLine1}</li>
          <li>{t.nearbyLine2}</li>
          <li>{t.nearbyLine3}</li>
        </ul>
        <label className="flex min-h-11 items-center gap-3 text-[16px]">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="h-5 w-5 accent-[var(--tk-terra)]" />
          {t.nearbyAgree}
        </label>
        <button type="button" disabled={!agreed} onClick={onConfirm} className={`${BTN} w-full`}>
          {t.nearbyOn}
        </button>
      </div>
    </ModalSheet>
  );
}
