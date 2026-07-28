import type { Metadata } from "next";
import Image from "next/image";

import { AuthForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = {
  title: "Sign up — Traike",
};

export default function SignupPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-cream p-4 font-brand text-charcoal">
      {/* Same hero photo as the landing page, blurred and washed out so it reads
          as brand texture behind the form rather than a second focal point. */}
      <Image
        src="/images/hero-tent-sunrise-new.png"
        alt=""
        fill
        sizes="100vw"
        aria-hidden
        className="scale-110 object-cover object-center blur-lg"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-cream/85 via-cream/75 to-cream/90" />
      <div className="relative w-full max-w-sm">
        <AuthForm mode="signup" />
      </div>
    </main>
  );
}
