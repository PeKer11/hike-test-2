import type { SupabaseClient } from "@supabase/supabase-js";

/** True only when the walker has granted learning on the server. Any failure counts as no consent. */
export async function hasLearningConsent(supabase: SupabaseClient, userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.from("profiles").select("learning_consent").eq("id", userId).maybeSingle();
    return !error && data?.learning_consent === "granted";
  } catch {
    return false;
  }
}
