"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * Whether a Supabase session exists in the browser. Used to decide whether it
 * is worth showing the post-walk feedback question at all — an anonymous walker
 * has nowhere for the answer to be stored, so asking would be pointless.
 *
 * Starts false and flips once the session resolves, so nothing auth-dependent
 * flashes on screen before we know. Returns false, rather than throwing, when
 * Supabase is not configured — no walk-planning feature is gated behind login.
 */
export function useIsSignedIn(): boolean {
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    let active = true;

    let client: ReturnType<typeof createClient>;
    try {
      client = createClient();
    } catch {
      return;
    }

    void client.auth.getUser().then(({ data }) => {
      if (active) {
        setIsSignedIn(Boolean(data.user));
      }
    });

    const { data: subscription } = client.auth.onAuthStateChange(
      (_event, session) => {
        if (active) {
          setIsSignedIn(Boolean(session?.user));
        }
      },
    );

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return isSignedIn;
}
