import type { Metadata } from "next";

import { AuthScreen } from "@/components/auth/AuthScreen";

export const metadata: Metadata = {
  title: "Log in — Traike",
};

export default async function LoginPage({
  searchParams,
}: {
  // Set by /auth/callback when a confirmation link fails to produce a session.
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return <AuthScreen mode="login" initialError={error} />;
}
