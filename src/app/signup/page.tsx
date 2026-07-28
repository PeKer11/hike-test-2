import type { Metadata } from "next";
import Image from "next/image";

import { AuthForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = {
  title: "Sign up — Traike",
};

export default function SignupPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-cream p-4 font-brand text-charcoal">
      {/* Same terracotta studio gradient as /login — see that file for why this
          is a light blur over a heavy cream wash rather than the landing hero. */}
      <Image
        src="/images/auth-terra-gradient.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        aria-hidden
        className="scale-105 object-cover object-center blur-sm"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-cream/86 via-cream/72 to-cream/92" />
      <div className="relative w-full max-w-sm">
        <AuthForm mode="signup" />
      </div>
    </main>
  );
}
