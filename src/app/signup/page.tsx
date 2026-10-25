import type { Metadata } from "next";
import Image from "next/image";

import { AuthForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = {
  title: "Sign up — Traike",
};

export default function SignupPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-cream p-4 font-brand text-charcoal">
      {/* Photo background under a cream wash, one glossy 3D accessory on the card's corner. */}
      <Image
        src="/images/meadow-hikers-new.png"
        alt=""
        fill
        priority
        sizes="100vw"
        aria-hidden
        className="scale-105 object-cover object-center"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-cream/80 via-cream/45 to-cream/85" />
      <div className="relative w-full max-w-sm">
        <Image
          src="/images/traike/3d/boot.png"
          alt=""
          width={640}
          height={640}
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-24 z-10 h-36 w-36 object-contain drop-shadow-[0_16px_20px_rgba(0,0,0,0.3)]"
        />
        <AuthForm mode="signup" />
      </div>
    </main>
  );
}
