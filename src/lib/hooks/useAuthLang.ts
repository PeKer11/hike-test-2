"use client";

import { useEffect, useState } from "react";

/** Hebrew or English for the sign-in pages: the walker's saved language setting, else the browser's. Read after mount. */
export function useAuthLang(): "he" | "en" {
  const [lang, setLang] = useState<"he" | "en">("en");
  useEffect(() => {
    let chosen: unknown = null;
    try {
      chosen = (JSON.parse(localStorage.getItem("walk-settings") ?? "null") as { uiLanguage?: unknown } | null)?.uiLanguage;
    } catch {
      chosen = null;
    }
    if (chosen === "he" || chosen === "en") setLang(chosen);
    else setLang(navigator.language?.toLowerCase().startsWith("he") ? "he" : "en");
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "he" ? "rtl" : "ltr";
  }, [lang]);
  return lang;
}
