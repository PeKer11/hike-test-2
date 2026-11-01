"use client";

import { useEffect } from "react";

/* One rAF scroll handler drives --py on every [data-prop]. Transform-only,
   rects are measured on resize, never inside the scroll loop. */
export function PropParallax() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) return;

    const props = Array.from(document.querySelectorAll<HTMLElement>("[data-prop]"));
    let mids: number[] = [];
    let vh = window.innerHeight;
    let ticking = false;

    const measure = () => {
      vh = window.innerHeight;
      const y = window.scrollY;
      mids = props.map((el) => {
        const card = el.parentElement!.getBoundingClientRect();
        return card.top + y + card.height / 2;
      });
    };

    const update = () => {
      ticking = false;
      const center = window.scrollY + vh / 2;
      props.forEach((el, i) => {
        const py = Math.max(-20, Math.min(20, ((mids[i] - center) / vh) * -40));
        el.style.setProperty("--py", `${py.toFixed(1)}px`);
      });
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    const onResize = () => {
      measure();
      onScroll();
    };

    measure();
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return null;
}
