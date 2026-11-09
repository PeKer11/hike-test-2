"use client";

import { createBrowserClient } from "@supabase/ssr";
import { createClient as createJsClient } from "@supabase/supabase-js";

import { getSupabasePublishableKey, getSupabaseUrl } from "./env";

// Browser-side Supabase client. `createBrowserClient` is a singleton by
// default, so calling this from several components reuses one client and one
// auth listener.
export function createClient() {
  return createBrowserClient(getSupabaseUrl(), getSupabasePublishableKey());
}

// Used only to *request* a password-reset email. The ssr client above is PKCE:
// the emailed link carries a one-time code that can only be exchanged in the
// browser that asked for it, so opening the email on a phone or in Gmail's
// in-app browser failed with "same browser" and burned the link. An implicit
// request produces a link that works in any browser; the callback page already
// handles its #access_token hash. Nothing is persisted from this client.
export function createRecoveryRequestClient() {
  return createJsClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    auth: {
      flowType: "implicit",
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
