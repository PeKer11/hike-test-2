import type { ReactNode } from "react";

import { SEC_BAR } from "@/components/ui/panel-style";

/**
 * One block of the cream sheet that sits under a screen's header: an optional tinted section bar, then the
 * content with a 16px gutter, closed by a hairline. Full-bleed on purpose: it replaces the floating card.
 */
export function SheetSection({
  title,
  aside,
  className = "",
  children,
}: {
  title?: ReactNode;
  /** Something quiet at the end of the bar (a link, a count). */
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`border-b border-tk-hair bg-cream font-app-sans text-tk-body ${className}`}>
      {title ? (
        <div className={SEC_BAR}>
          <h2 className="text-[15px] font-semibold text-tk-ink">{title}</h2>
          {aside}
        </div>
      ) : null}
      <div className="space-y-3 px-4 py-3">{children}</div>
    </section>
  );
}
