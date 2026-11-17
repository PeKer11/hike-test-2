import Image from "next/image";

import { avatarOr, avatarSrc } from "@/lib/social/avatars";

const TINTS = ["bg-forest/15", "bg-terra/15", "bg-skysoft/30"] as const;

/** One of the 12 accessory PNGs on a tinted circle. Sizes 40, 56, 96. */
export function Avatar({ id, size = 56, seed = "" }: { id: string | null | undefined; size?: 40 | 56 | 96; seed?: string }) {
  const tint = TINTS[[...(seed || String(id))].reduce((n, c) => n + c.charCodeAt(0), 0) % TINTS.length];
  const px = Math.round(size * 0.78);
  return (
    <span aria-hidden className={`flex shrink-0 items-center justify-center rounded-full ${tint}`} style={{ width: size, height: size }}>
      <Image src={avatarSrc(avatarOr(id))} alt="" width={px} height={px} className="object-contain" />
    </span>
  );
}
