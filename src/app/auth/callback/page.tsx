import type { Metadata } from "next";

import { AuthCallback } from "@/components/auth/AuthCallback";

export const metadata: Metadata = {
  title: "Confirming — Traike",
};

// A page, not a route handler: the implicit flow returns the session in a URL
// hash fragment, which browsers never send to the server.
export default function AuthCallbackPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream p-4 font-brand text-charcoal">
      <AuthCallback />
    </main>
  );
}
