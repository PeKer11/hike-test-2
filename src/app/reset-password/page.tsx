import type { Metadata } from "next";

import { AuthScreen } from "@/components/auth/AuthScreen";

export const metadata: Metadata = {
  title: "New password — Traike",
};

export default function Page() {
  return <AuthScreen mode="reset" />;
}
