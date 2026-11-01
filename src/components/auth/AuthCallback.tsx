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
      const next = nextParam && /^\/(?![\/\\])/.test(nextParam) ? nextParam : "/app";

      const hash = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const code = search.get("code");
      const tokenHash = search.get("token_hash");
      const type = search.get("type") as EmailOtpType | null;

      const supabase = createClient();
      const isRecovery =
        type === "recovery" ||
        hash.get("type") === "recovery" ||
        next === "/reset-password";

      let message: string | null = null;

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        message = error?.message ?? null;
      } else if (code) {
        // The browser client already exchanges ?code= on startup
        // (detectSessionInUrl) and the PKCE verifier is single-use, so a second
        // exchangeCodeForSession here always fails. Wait for that run instead.
        const { error } = await supabase.auth.initialize();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        message = session
          ? null
          : (error?.message ??
            "Open the link in the same browser you requested it from, or request a new one.");
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
        if (/expired|invalid/i.test(message)) {
          message =
            "This reset link expired or was already used. Request a new one below.";
        }
        const target = isRecovery ? "/forgot-password" : "/login";
        router.replace(`${target}?error=${encodeURIComponent(message)}`);
        return;
      }

      // The session cookie changed, so any cached server render is stale.
      router.refresh();
      router.replace(isRecovery ? "/reset-password" : next);
    }

    void complete();
  }, [router]);

  return (
    <p className="text-sm text-charcoal/70">Checking your link…</p>
  );
}
