"use client";

import { useEffect, useRef } from "react";

/* Muted looping clip behind the closing card. Poster only for reduced motion,
   data-saver and until the card is on screen. */
export function ClosingVideo({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saver = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (reduce || saver) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) void v.play().catch(() => undefined);
        else v.pause();
      },
      { threshold: 0.25 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      className={className}
      poster="/images/landing/closing-poster.webp"
      muted
      loop
      playsInline
      preload="none"
      aria-hidden
      tabIndex={-1}
    >
      <source src="/videos/landing-loop-1280.webm" type="video/webm" />
      <source src="/videos/landing-loop-1280.mp4" type="video/mp4" />
    </video>
  );
}
