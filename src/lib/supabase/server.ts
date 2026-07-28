import { cookies } from "next/headers";

import { createServerClient } from "@supabase/ssr";

import { getSupabasePublishableKey, getSupabaseUrl } from "./env";

// Server-side Supabase client for Server Components, Route Handlers and Server
// Actions. Never share the returned client across requests — create a new one
// per render, the cookie store is request-scoped.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies. That is fine as long as
          // the proxy (src/proxy.ts) refreshes the session on every request.
        }
      },
    },
  });
}
