import type { Viewport } from "next";

import { AccountIndicator } from "@/components/auth/AccountIndicator";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <AccountIndicator />
      {children}
    </>
  );
}
