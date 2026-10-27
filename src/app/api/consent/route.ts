import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/** Keeps the walker's learning choice on the server, so the AI routes can check it before saving anything. */
export async function POST(request: Request): Promise<NextResponse> {
  let body: { consent?: unknown };
  try {
    body = (await request.json()) as { consent?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (body.consent !== "granted" && body.consent !== "declined") {
    return NextResponse.json({ error: "consent must be granted or declined." }, { status: 400 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { error } = await supabase
    .from("profiles")
    .update({ learning_consent: body.consent, learning_consent_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) return NextResponse.json({ error: "Could not save." }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
