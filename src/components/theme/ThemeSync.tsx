"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";

import { THEME_EVENT, applyTheme, readChoice } from "@/lib/theme/theme";

// Re-applies the theme on client navigation (landing is light-only, /app is
// not) and follows live device changes while the choice is "system".
export function ThemeSync() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    applyTheme();
  }, [pathname]);

  useLayoutEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readChoice() === "system") applyTheme();
    };
    mq.addEventListener("change", onChange);
    window.addEventListener(THEME_EVENT, onChange);
    return () => {
      mq.removeEventListener("change", onChange);
      window.removeEventListener(THEME_EVENT, onChange);
    };
  }, []);

  return null;
}
