import type { Metadata } from "next";

import { AuthForm } from "@/components/auth/AuthForm";

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

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream p-4 font-brand text-charcoal">
      <AuthForm mode="login" initialError={error} />
    </main>
  );
}
