import type { Metadata, Viewport } from "next";
import { Assistant, Fraunces, Frank_Ruhl_Libre, Heebo, Manrope, Secular_One } from "next/font/google";
import { ThemeSync } from "@/components/theme/ThemeSync";
import { THEME_INIT_SCRIPT } from "@/lib/theme/theme";
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

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });
// Round 13 Hebrew pairing: Assistant under Manrope, Frank Ruhl Libre under Fraunces.
const assistant = Assistant({ subsets: ["hebrew", "latin"], variable: "--font-assistant", display: "swap" });
const frank = Frank_Ruhl_Libre({ subsets: ["hebrew", "latin"], variable: "--font-frank", display: "swap" });

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
  colorScheme: "only light",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f3ea" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1613" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body
        className={`${heebo.variable} ${secular.variable} ${fraunces.variable} ${manrope.variable} ${assistant.variable} ${frank.variable} antialiased`}
      >
        <ThemeSync />
        {children}
      </body>
    </html>
  );
}
