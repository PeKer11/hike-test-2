/* eslint-disable @next/next/no-img-element */

/** Small hand-drawn hiking prop (public/images/traike/accessories/). Transparent PNG, so it sits on any card colour. */
export function Accessory({ name, className = "" }: { name: string; className?: string }) {
  return (
    <img
      src={`/images/traike/accessories/${name}.png`}
      alt=""
      aria-hidden
      width={96}
      height={96}
      className={`pointer-events-none select-none ${className}`}
    />
  );
}
