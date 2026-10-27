import type { Metadata, Viewport } from "next";
import { Heebo, Secular_One } from "next/font/google";
import "./globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
  display: "swap",
});

const secular = Secular_One({
  weight: "400",
  subsets: ["hebrew", "latin"],
  variable: "--font-secular",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Traike — Your Personal Hiking Companion",
  description:
    "Tell Traike how much time you have. It builds a walk around your pace, your interests, and the city in front of you — and adapts as you go.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the walk HUD pad for the notch / home bar via env(safe-area-inset-*),
  // and stops Samsung's forced dark mode from repainting the cream UI.
  viewportFit: "cover",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${heebo.variable} ${secular.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
