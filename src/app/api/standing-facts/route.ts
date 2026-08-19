import { NextResponse } from "next/server";

import {
  deleteFact,
  getStandingFacts,
  restoreSupersededFact,
} from "@/lib/preferences/fact-store";
import { createClient } from "@/lib/supabase/server";

/**
 * What the app remembers about the walker, and the two ways they can take it
 * back: delete a fact outright, or undo a contradiction the app resolved on
 * their behalf.
 *
 * A memory that silently changes results and cannot be inspected is the single
 * worst outcome of this feature, so this route is not optional dressing — it
 * ships in the same step as the injection that reads the facts.
 *
 * Every method answers benignly when signed out or Supabase is unconfigured:
 * an empty list or a 204, never an error for a walker who has nothing stored.
 */

interface FactActionRequest {
  action?: unknown;
  /** The fact the walker wants back. */
  supersededFactId?: unknown;
  /** The fact that replaced it, which the undo removes. */
  newFactId?: unknown;
}

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
    return null;
  }
}

/** Everything the walker is currently on record as saying, newest first. */
export async function GET(): Promise<NextResponse> {
  const session = await signedInUser();
  if (!session) {
    return NextResponse.json([]);
  }

  const facts = await getStandingFacts(session.supabase, session.userId);

  return NextResponse.json(
    [...facts].sort((a, b) => b.lastSeenAt - a.lastSeenAt),
  );
}

/**
 * Forget one fact. Takes the id in the query string rather than a body because
 * a DELETE with a body is awkward to send from `fetch` and there is exactly one
 * thing to say.
 */
export async function DELETE(request: Request): Promise<NextResponse> {
  const factId = new URL(request.url).searchParams.get("id");
  if (!factId) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  const session = await signedInUser();
  if (!session) {
    return new NextResponse(null, { status: 204 });
  }

  // A delete that did not happen must not answer like one that did. The walker
  // clicked ✕ on a fact that shapes every walk they build from here; if the row
  // survives and the panel says nothing, they go on believing they removed it
  // while it keeps steering their results. Same failure the Undo button had.
  const deleted = await deleteFact(session.supabase, session.userId, factId);
  if (!deleted) {
    return NextResponse.json(
      { error: "Could not forget that fact." },
      { status: 500 },
    );
  }

  return new NextResponse(null, { status: 204 });
}

/**
 * Undo a contradiction: the walker says the app read them wrong, so the retired
 * fact comes back and the one that replaced it goes.
 *
 * This is the half of the layered answer that needs an explicit yes. Saying
 * nothing is already an answer — the newest statement stands — so nothing here
 * runs unless the walker asks for it.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: FactActionRequest;
  try {
    body = (await request.json()) as FactActionRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { action, supersededFactId, newFactId } = body;
  if (
    action !== "restore" ||
    typeof supersededFactId !== "string" ||
    typeof newFactId !== "string"
  ) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const session = await signedInUser();
  if (!session) {
    return NextResponse.json({ restored: false });
  }

  const restored = await restoreSupersededFact(
    session.supabase,
    session.userId,
    supersededFactId,
    newFactId,
  );

  // `{ restored: false }` inside a 200 is how `restoreSupersededFact` managed to
  // fail on every single real call for a week without anyone noticing: the
  // response was success-shaped, and the client only ever looked at whether the
  // fetch itself resolved. A write that did not happen answers 500 now, so the
  // next bug on this path shows up as a red request instead of a silent one.
  if (!restored) {
    return NextResponse.json(
      { restored: false, error: "Could not undo that." },
      { status: 500 },
    );
  }

  return NextResponse.json({ restored });
}
