import { NextResponse } from "next/server";

import { defaultTurnLock } from "@/lib/llm/turn-lock";
import { createClient } from "@/lib/supabase/server";

/** Stop: asks the signed-in walker's running assistant turn to end. Only ever touches their own turn. */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const cancelled = await defaultTurnLock().requestCancel(`assistant:${user.id}`).catch(() => false);
  return NextResponse.json({ cancelled });
}
