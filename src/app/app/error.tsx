"use client";

import { useEffect } from "react";

import { ScreenFallback } from "@/components/ui/ScreenBoundary";

/** Route-level net: replaces Next's "Application error" page. Language is not known here, so both are shown. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app/error]", error);
  }, [error]);
  return (
    <div className="h-dvh bg-cream">
      <ScreenFallback onRetry={reset} />
    </div>
  );
}
