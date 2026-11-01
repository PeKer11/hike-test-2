export type ThemeChoice = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_KEY = "traike-theme";
// Art-directed pages that have no dark design yet.
const LIGHT_ONLY = ["/", "/pricing"];

export function isLightOnly(pathname: string): boolean {
  return LIGHT_ONLY.includes(pathname.replace(/(.)\/$/, "$1"));
}

export function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function writeChoice(choice: ThemeChoice): void {
  try {
    localStorage.setItem(THEME_KEY, choice);
  } catch {
    // Private mode / blocked storage: the choice just won't persist.
  }
}

export function systemPrefersDark(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveTheme(choice: ThemeChoice, pathname: string, prefersDark: boolean): ResolvedTheme {
  if (isLightOnly(pathname)) return "light";
  if (choice === "system") return prefersDark ? "dark" : "light";
  return choice;
}

export function applyTheme(): ResolvedTheme {
  const resolved = resolveTheme(readChoice(), window.location.pathname, systemPrefersDark());
  document.documentElement.setAttribute("data-theme", resolved);
  return resolved;
}

export const THEME_EVENT = "traike-theme-change";

export function setChoice(choice: ThemeChoice): void {
  writeChoice(choice);
  applyTheme();
  window.dispatchEvent(new Event(THEME_EVENT));
}

// Runs before first paint so there is no flash of the wrong theme.
export const THEME_INIT_SCRIPT = `(function(){try{var c=localStorage.getItem(${JSON.stringify(THEME_KEY)});var p=location.pathname.replace(/(.)\\/$/,"$1");var lo=${JSON.stringify(LIGHT_ONLY)}.indexOf(p)>-1;var d=c==="dark"||((c!=="light")&&typeof matchMedia==="function"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",(!lo&&d)?"dark":"light")}catch(e){document.documentElement.setAttribute("data-theme","light")}})()`;
