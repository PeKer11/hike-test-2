"use client";

import { useEffect } from "react";

import { ScreenFallback } from "@/components/ui/ScreenBoundary";

/** Last resort when even the root layout throws: it must bring its own <html> and <body>. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);
  return (
    <html lang="he" dir="rtl">
      <body style={{ margin: 0, background: "#f8f3ea" }}>
        <div style={{ minHeight: "100dvh" }}>
          <ScreenFallback onRetry={reset} />
        </div>
      </body>
    </html>
  );
}
