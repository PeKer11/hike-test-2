import type { ReactNode } from "react";

/** The title of a hub screen: display type at the start, up to two 44px glyph actions at the end. */
export function ScreenHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 pt-[max(24px,env(safe-area-inset-top))]">
      <h1 className="font-display text-[28px] leading-[34px] text-forest">{title}</h1>
      {actions ? <div className="flex items-center gap-1">{actions}</div> : null}
    </div>
  );
}
