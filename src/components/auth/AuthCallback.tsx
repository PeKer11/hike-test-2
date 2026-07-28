"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";

// Landing point for the link in Supabase's confirmation email. Three shapes
// reach us depending on which flow the project's email template uses:
//   #access_token=...&refresh_token=...  — implicit, Supabase's default
//                                          (un-editable) "Confirm signup"
//                                          template verifies on its side and
//                                          hands the session back as a hash
//   ?code=...                            — PKCE, what @supabase/ssr clients ask for
//   ?token_hash=...&type=...             — the older verify-based template
// A hash fragment is never sent to the server, so this has to run in the
// browser. All three are handled here so the flow works whichever one the
// project is actually configured for.
export function AuthCallback() {
  const router = useRouter();
  // React runs effects twice in dev; a confirmation token is single-use.
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) {
      return;
    }
    hasRun.current = true;

    async function complete() {
      const search = new URLSearchParams(window.location.search);
      // Only same-origin paths — an attacker-supplied absolute URL must not be
      // able to bounce a freshly authenticated user off-site.
      const nextParam = search.get("next");
      const next = nextParam?.startsWith("/") ? nextParam : "/app";

      const hash = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const code = search.get("code");
      const tokenHash = search.get("token_hash");
      const type = search.get("type") as EmailOtpType | null;

      const supabase = createClient();

      let message: string | null = null;

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        message = error?.message ?? null;
      } else if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        message = error?.message ?? null;
      } else if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({
          type,
          token_hash: tokenHash,
        });
        message = error?.message ?? null;
      } else {
        // Supabase reports a rejected link as an error in the hash too.
        message =
          hash.get("error_description") ??
          search.get("error_description") ??
          "Confirmation link is missing its code.";
      }

      if (message) {
        router.replace(`/login?error=${encodeURIComponent(message)}`);
        return;
      }

      // The session cookie changed, so any cached server render is stale.
      router.refresh();
      router.replace(next);
    }

    void complete();
  }, [router]);

  return (
    <p className="text-sm text-charcoal/70">Confirming your email address…</p>
  );
}
