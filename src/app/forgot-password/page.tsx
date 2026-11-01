import type { Metadata } from "next";

import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { PasswordResetForm } from "@/components/auth/PasswordResetForm";

export const metadata: Metadata = {
  title: "Reset password — Traike",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream p-4 font-brand text-charcoal">
      <ThemeToggle floating />
      <PasswordResetForm mode="request" initialError={error} />
    </main>
  );
}
