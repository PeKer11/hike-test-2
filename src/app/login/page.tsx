import type { Metadata } from "next";
import Image from "next/image";

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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-cream p-4 font-brand text-charcoal">
      {/* Terracotta studio gradient instead of the landing-page photo: the auth
          pages should feel like brand surface, not a second marketing hero. It
          needs only a light blur (it has no detail to hide, just a faint
          cyclorama seam) and a heavier cream wash, since the source is far more
          saturated than the photo it replaced. Its highlight sits dead centre,
          so the warm glow lands behind the card. */}
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
        <AuthForm mode="login" initialError={error} />
      </div>
    </main>
  );
}
