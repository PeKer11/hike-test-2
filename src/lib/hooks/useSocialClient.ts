"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

export interface SocialSession {
  client: SupabaseClient;
  userId: string;
}

/** The signed-in browser session for the social screens; null while signed out, loading or when Supabase is not configured. */
export function useSocialClient(enabled: boolean): SocialSession | null {
  const [session, setSession] = useState<SocialSession | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const client = createClient();
        const { data } = await client.auth.getUser();
        if (live && data.user) setSession({ client, userId: data.user.id });
      } catch {
        // Signed out or offline: the screens show their signed-out state.
      }
    })();
    return () => {
      live = false;
    };
  }, [enabled]);
  return enabled ? session : null;
}
