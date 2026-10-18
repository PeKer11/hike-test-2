import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { socialEnabled } from "@/lib/social/flag";

/** The server's opt-in state: the source of truth. Local settings follow it on load. */
export async function GET(): Promise<NextResponse> {
  if (!socialEnabled()) return new NextResponse(null, { status: 404 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ optedIn: null });
  const { data, error } = await supabase
    .from("community_optin")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ optedIn: null });
  return NextResponse.json({ optedIn: data !== null });
}

/** Opt in to community recommendations (own row; re-opting keeps the original time). */
export async function PUT(): Promise<NextResponse> {
  if (!socialEnabled()) return new NextResponse(null, { status: 404 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ saved: false });
  const { error } = await supabase
    .from("community_optin")
    .upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });
  return NextResponse.json({ saved: !error });
}

/** Opt out: the row is deleted, so the walker's votes stop counting at once. */
export async function DELETE(): Promise<NextResponse> {
  if (!socialEnabled()) return new NextResponse(null, { status: 404 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 204 });
  const { error } = await supabase.from("community_optin").delete().eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Could not opt out." }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
