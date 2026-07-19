import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, Urbanist } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const urbanist = Urbanist({
  subsets: ["latin"],
  variable: "--font-urbanist",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  title: "Traike — Your Personal Hiking Companion",
  description:
    "Tell Traike how much time you have. It builds a walk around your pace, your interests, and the city in front of you — and adapts as you go.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${urbanist.variable} ${fraunces.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
