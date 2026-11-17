"use client";

import Image from "next/image";

/** A whole-tile button: a big 3D object overlapping the top-end corner, a display title, one line or one big number. */
export function ChoiceTile({
  title,
  line,
  number,
  image,
  variant = "plain",
  onClick,
}: {
  title: string;
  line?: string;
  number?: number | null;
  /** Path under /public. */
  image: string;
  variant?: "primary" | "plain";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex min-h-[196px] flex-col justify-end rounded-tk-card p-4 text-start shadow-tk-card transition-transform active:scale-[0.98] motion-reduce:transition-none ${
        variant === "primary" ? "bg-gradient-to-br from-terra/20 to-paper" : "bg-paper"
      }`}
    >
      <Image src={image} alt="" width={120} height={120} aria-hidden className="pointer-events-none absolute -top-5 end-3 h-[104px] w-auto drop-shadow-xl" />
      {number !== null && number !== undefined ? <span className="text-[48px] font-light leading-none tabular-nums text-tk-ink">{number}</span> : null}
      <span className="mt-2 font-display text-[22px] leading-7 text-tk-ink">{title}</span>
      {line ? <span className="mt-1 text-[15px] leading-5 text-charcoal/70">{line}</span> : null}
    </button>
  );
}
