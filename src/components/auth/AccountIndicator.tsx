import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { LogoutButton } from "./LogoutButton";

// Server component: the session is read from the request cookies, which the
// proxy (src/proxy.ts) has already refreshed by the time this renders.
export async function AccountIndicator() {
  // Auth is optional — without Supabase configured the app must still run.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="pointer-events-auto fixed right-3 top-3 z-[1000] max-sm:top-[66px] flex items-center gap-2 text-xs">
      <ThemeToggle />
      {user ? (
        // Collapsed to one round button so the cluster stays a corner dot, not a bar over the map.
        <details className="group relative">
          <summary
            aria-label="Account"
            className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-full border border-charcoal/10 bg-paper/95 text-sm font-semibold uppercase text-terra shadow-sm [&::-webkit-details-marker]:hidden"
          >
            {user.email?.[0] ?? "?"}
          </summary>
          <div className="absolute right-0 top-full mt-2 flex min-w-[200px] flex-col gap-2 rounded-md border border-charcoal/10 bg-paper/95 px-3 py-2 shadow-md">
            <span className="truncate text-charcoal/70">{user.email}</span>
            <Link href="/forgot-password" className="font-semibold text-terra hover:text-terra">
              Change password
            </Link>
            <LogoutButton />
          </div>
        </details>
      ) : (
        <Link
          href="/login"
          className="rounded-md border border-charcoal/10 bg-paper/95 px-3 py-1.5 font-semibold text-terra shadow-sm hover:text-terra"
        >
          Log in
        </Link>
      )}
    </div>
  );
}
