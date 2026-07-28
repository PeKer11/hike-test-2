import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
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
    <div className="pointer-events-auto fixed right-3 top-3 z-[1000] flex items-center gap-2 rounded-md border border-slate-200 bg-white/95 px-3 py-1.5 text-xs shadow-sm">
      {user ? (
        <>
          <span className="max-w-[160px] truncate text-slate-600">
            {user.email}
          </span>
          <LogoutButton />
        </>
      ) : (
        <Link
          href="/login"
          className="font-semibold text-emerald-700 hover:text-emerald-600"
        >
          Log in
        </Link>
      )}
    </div>
  );
}
