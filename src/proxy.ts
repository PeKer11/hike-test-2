import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/session";

// Next 16 renamed the `middleware` file convention to `proxy`.
export default async function proxy(request: NextRequest) {
  // Supabase is optional until auth ships — without the env vars configured
  // the app must keep working exactly as it does today.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return NextResponse.next();
  }

  const { response, user } = await updateSession(request);

  // /app is the only gated area. Everything else — landing page, /login,
  // /signup, /pricing, API routes — stays public.
  const isGated =
    request.nextUrl.pathname === "/app" ||
    request.nextUrl.pathname.startsWith("/app/");

  if (isGated && !user) {
    const loginUrl = new URL("/login", request.url);
    const redirect = NextResponse.redirect(loginUrl);

    // Carry over any cookies the refresh above rotated, otherwise the response
    // that actually reaches the browser would drop them.
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }

    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals and static assets. Auth cookies still
    // need refreshing on API routes, so those are deliberately included.
    "/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
