import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabasePublishableKey, getSupabaseUrl } from "./env";

export interface UpdateSessionResult {
  /** Response carrying any rotated auth cookies. */
  response: NextResponse;
  /** The signed-in user, or null when the request has no valid session. */
  user: User | null;
}

// Refreshes the auth session and writes any rotated tokens back onto the
// outgoing response. Server Components cannot set cookies, so without this
// running on every request an expired token would never be renewed.
export async function updateSession(
  request: NextRequest,
): Promise<UpdateSessionResult> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }

          response = NextResponse.next({ request });

          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }

          // Responses that set auth cookies must never be cached by a CDN,
          // otherwise one user's tokens can be served to another user.
          for (const [key, headerValue] of Object.entries(headers)) {
            response.headers.set(key, headerValue);
          }
        },
      },
    },
  );

  // Do not remove: this call is what actually triggers the token refresh.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
