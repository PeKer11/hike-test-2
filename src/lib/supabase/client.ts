"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublishableKey, getSupabaseUrl } from "./env";

// Browser-side Supabase client. `createBrowserClient` is a singleton by
// default, so calling this from several components reuses one client and one
// auth listener.
export function createClient() {
  return createBrowserClient(getSupabaseUrl(), getSupabasePublishableKey());
}
