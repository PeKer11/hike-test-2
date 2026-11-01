import type { Metadata } from "next";

import { PasswordResetForm } from "@/components/auth/PasswordResetForm";

export const metadata: Metadata = {
  title: "New password — Traike",
};

export default function Page() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream p-4 font-brand text-charcoal">
      <PasswordResetForm mode="update" />
    </main>
  );
}
