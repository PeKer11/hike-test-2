import Image from "next/image";
import type { ReactNode } from "react";

/* Card with a glossy 3D prop overlapping its top edge (about 30% inside).
   PropParallax sets --py on [data-prop]; the card also works with no prop. */
export function FloatingPropCard({
  title,
  body,
  prop,
  icon,
}: {
  title: string;
  body: string;
  prop?: string;
  icon?: ReactNode;
}) {
  return (
    <div
      className={`relative rounded-[28px] bg-white/90 px-8 pb-8 text-center shadow-[0_16px_44px_rgba(30,61,47,0.18)] backdrop-blur ${
        prop ? "pt-[84px]" : "pt-8"
      }`}
    >
      {prop ? (
        <Image
          src={prop}
          alt=""
          width={640}
          height={640}
          aria-hidden
          data-prop
          className="pointer-events-none absolute left-1/2 top-0 w-[150px] object-contain drop-shadow-[0_18px_22px_rgba(30,61,47,0.28)] md:w-[190px]"
          style={{ transform: "translate(-50%, calc(-70% + var(--py, 0px)))" }}
        />
      ) : (
        icon && (
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-terra/10 text-terra">
            {icon}
          </span>
        )
      )}
      <h3 className="font-display text-2xl font-normal text-forest">{title}</h3>
      <p className="mt-3 leading-relaxed text-charcoal/75">{body}</p>
    </div>
  );
}
