import { NextResponse } from "next/server";

import {
  appendExchange,
  clearExchanges,
  getRecentExchanges,
} from "@/lib/history/exchange-store";
import { isExchangeTurn } from "@/lib/history/exchange";
import { createClient } from "@/lib/supabase/server";

/**
 * The persisted half of the prompt panel's scrollback.
 *
 * Every method answers benignly when there is nothing to do — signed out, no
 * Supabase, or history persistence turned off all come back 204 / `[]` rather
 * than an error. The panel's in-memory log is the render source either way, so
 * a walker who is not signed in sees exactly what they saw before this existed.
 *
 * `prompt_text` is deliberately never logged anywhere in this file: walk
 * prompts name home streets, workplaces and children.
 */

interface AppendExchangeRequest {
  turn?: unknown;
  prompt?: unknown;
  responseSummary?: unknown;
  /** Client-side "Remember what I typed" setting. Absent means off. */
  persistHistory?: unknown;
}

/** The signed-in walker's id, or null for every reason there is not one. */
async function signedInUser(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
} | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return user ? { supabase, userId: user.id } : null;
  } catch {
    // Supabase unconfigured, or a session lookup that blew up.
    return null;
  }
}

/**
 * Append one exchange. Fire-and-forget from the panel's side, so the only thing
 * the status code has to get right is "never make the caller retry": a
 * rejected or skipped write is a 204 like a successful one.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: AppendExchangeRequest;
  try {
    body = (await request.json()) as AppendExchangeRequest;
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  if (body.persistHistory !== true || !isExchangeTurn(body.turn)) {
    return new NextResponse(null, { status: 204 });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  const responseSummary =
    typeof body.responseSummary === "string" ? body.responseSummary : "";

  const session = await signedInUser();
  if (!session) {
    return new NextResponse(null, { status: 204 });
  }

  await appendExchange(session.supabase, session.userId, {
    turn: body.turn,
    prompt,
    responseSummary,
  });

  return new NextResponse(null, { status: 204 });
}

/**
 * The walker's last few requests, oldest first. An empty array is the answer to
 * every question that has no rows behind it — no session, no Supabase, nothing
 * stored, or a failed read — because the panel treats "nothing to hydrate" and
 * "nothing to say" identically.
 */
export async function GET(): Promise<NextResponse> {
  const session = await signedInUser();
  if (!session) {
    return NextResponse.json([]);
  }

  const exchanges = await getRecentExchanges(session.supabase, session.userId);
  return NextResponse.json(exchanges);
}

/**
 * Forget everything. Not gated on the persistence setting: a walker who has
 * just turned persistence off is exactly the walker most likely to want the
 * rows already written gone.
 */
export async function DELETE(): Promise<NextResponse> {
  const session = await signedInUser();
  if (!session) {
    return new NextResponse(null, { status: 204 });
  }

  await clearExchanges(session.supabase, session.userId);
  return new NextResponse(null, { status: 204 });
}
