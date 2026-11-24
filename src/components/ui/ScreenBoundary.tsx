"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

import { BTN, BTN_ALT } from "@/components/ui/panel-style";

type Lang = "he" | "en";

const COPY: Record<Lang, { title: string; again: string; live: string; retry: string; backWalk: string; backHome: string; reload: string }> = {
  he: {
    title: "משהו השתבש במסך הזה",
    again: "אפשר לנסות שוב.",
    live: "ההליכה שלך ממשיכה ונשמרת.",
    retry: "נסו שוב",
    backWalk: "חזרה להליכה",
    backHome: "חזרה לבית",
    reload: "טעינה מחדש",
  },
  en: {
    title: "Something went wrong on this screen",
    again: "You can try again.",
    live: "Your walk keeps going and is saved.",
    retry: "Try again",
    backWalk: "Back to your walk",
    backHome: "Back home",
    reload: "Reload",
  },
};

interface FallbackProps {
  /** Omit when the language is not known (route-level errors): both are shown. */
  lang?: Lang;
  walkLive?: boolean;
  onRetry: () => void;
  onBack?: () => void;
}

/** The screen shown in place of one that threw. Hebrew first; with no known language, both. */
export function ScreenFallback({ lang, walkLive, onRetry, onBack }: FallbackProps) {
  const langs: Lang[] = lang ? [lang] : ["he", "en"];
  const join = (pick: (c: (typeof COPY)[Lang]) => string) => langs.map((l) => pick(COPY[l])).join(" / ");
  return (
    <div role="alert" className="flex h-full min-h-[200px] w-full flex-col items-center justify-center gap-3 bg-cream p-6 text-center text-charcoal">
      {langs.map((l) => (
        <div key={l} dir={l === "he" ? "rtl" : "ltr"} lang={l} className="space-y-1">
          <h2 className="text-lg font-bold">{COPY[l].title}</h2>
          <p className="text-[15px]">{walkLive ? COPY[l].live : COPY[l].again}</p>
        </div>
      ))}
      <div className="flex w-full max-w-[320px] flex-col gap-2">
        <button type="button" onClick={onRetry} className={BTN}>
          {join((c) => c.retry)}
        </button>
        {onBack ? (
          <button type="button" onClick={onBack} className={BTN_ALT}>
            {join((c) => (walkLive ? c.backWalk : c.backHome))}
          </button>
        ) : null}
        <button type="button" onClick={() => window.location.reload()} className="text-[14px] underline">
          {join((c) => c.reload)}
        </button>
      </div>
    </div>
  );
}

interface Props {
  /** For the console line: which screen or panel this guards. */
  name: string;
  lang?: Lang;
  walkLive?: boolean;
  /** Back to the walk (live) or Home. The button is left out when this is not given. */
  onBack?: () => void;
  children: ReactNode;
}

/**
 * A render error in one panel shows a fallback there instead of unmounting the whole React root (a blank frame, and a
 * GPS watch that stops). Put the inner ones around panels, so the live walk keeps running when a panel throws.
 */
export class ScreenBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ScreenBoundary]", this.props.name, error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <ScreenFallback lang={this.props.lang} walkLive={this.props.walkLive} onBack={this.props.onBack} onRetry={() => this.setState({ failed: false })} />;
  }
}
