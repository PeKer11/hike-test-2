import type { Metadata } from "next";

import { AuthForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = {
  title: "Sign up — Traike",
};

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream p-4 font-brand text-charcoal">
      <AuthForm mode="signup" />
    </main>
  );
}
