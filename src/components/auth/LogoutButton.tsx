"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

interface LogoutButtonProps {
  className?: string;
}

export function LogoutButton({
  className = "font-semibold text-emerald-700 hover:text-emerald-600 disabled:text-slate-400",
}: LogoutButtonProps) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleClick() {
    setIsSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    // Re-render the server components that read the (now cleared) session.
    router.refresh();
    router.push("/login");
  }

  return (
    <button type="button" onClick={handleClick} disabled={isSigningOut} className={className}>
      {isSigningOut ? "Logging out…" : "Log out"}
    </button>
  );
}
