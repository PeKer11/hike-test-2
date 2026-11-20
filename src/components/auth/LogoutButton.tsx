"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { LAST_FIX_KEY } from "@/lib/geo/locate";
import { clearActiveWalk } from "@/lib/walk/active-walk-store";
import { createClient } from "@/lib/supabase/client";

interface LogoutButtonProps {
  className?: string;
  /** Words for the button and its busy state (the Me screen speaks Hebrew too). */
  labels?: { idle: string; busy: string };
}

export function LogoutButton({
  className = "font-semibold text-emerald-700 hover:text-emerald-600 disabled:text-slate-400",
  labels = { idle: "Log out", busy: "Logging out…" },
}: LogoutButtonProps) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleClick() {
    setIsSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    // The next person on this device must not see this walker's route or position.
    clearActiveWalk();
    try {
      localStorage.removeItem(LAST_FIX_KEY);
    } catch {
      // Storage blocked: nothing was stored.
    }
    // Re-render the server components that read the (now cleared) session.
    router.refresh();
    router.push("/login");
  }

  return (
    <button type="button" onClick={handleClick} disabled={isSigningOut} className={className}>
      {isSigningOut ? labels.busy : labels.idle}
    </button>
  );
}
