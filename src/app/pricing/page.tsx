import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { SiteFooter } from "@/components/marketing/SiteFooter";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { PRICING_TIERS } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Pricing — Traike",
  description: "Walk first, pay later. Start free, take a pass for a trip, or go annual.",
};

const FAQ = [
  {
    q: "What is a Traike route?",
    a: "A walk built for you by the AI: your start, your time, your taste. Re-routing mid-walk is included.",
  },
  {
    q: "Does the free plan ever expire?",
    a: "No. The daily allowance simply renews every day.",
  },
  {
    q: "Can prices change?",
    a: "We're in early access. Anything you've already bought keeps its price.",
  },
];

function QuotaIcon({ index }: { index: number }) {
  const paths = [
    <path key="r" d="M5 19c4 0 3-6 7-6s3-8 7-8M5 19h.01M19 5h.01" />,
    <path key="c" d="M4 6h16v10H9l-5 4V6z" />,
    <path key="s" d="m12 4 2.4 5 5.6.8-4 3.9.9 5.6-4.9-2.6-4.9 2.6.9-5.6-4-3.9 5.6-.8z" />,
  ];
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0" aria-hidden>
      {paths[index]}
    </svg>
  );
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-cream font-brand text-charcoal">
      <SiteHeader />

      <section className="relative isolate overflow-hidden">
        <Image
          src="/images/hub-mountain-lake-sunset.png"
          alt=""
          fill
          priority
          sizes="100vw"
          aria-hidden
          className="-z-20 object-cover object-center"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-cream/90 via-cream/55 to-cream" />

        <div className="mx-auto max-w-[1200px] px-4 pb-24 pt-16 sm:px-6 md:pt-24">
          <h1 className="text-center font-display text-5xl font-bold text-forest md:text-7xl">
            Walk first. Pay later.
          </h1>

          <div className="mt-32 grid items-stretch gap-x-8 gap-y-24 md:grid-cols-3">
            {PRICING_TIERS.map((tier) => (
              <div
                key={tier.id}
                className={`relative flex flex-col rounded-[28px] px-8 pb-8 pt-28 ${
                  tier.highlighted
                    ? "bg-forest text-cream shadow-[0_24px_60px_rgba(30,61,47,0.45)] md:-translate-y-4"
                    : "bg-white/90 text-charcoal shadow-[0_16px_44px_rgba(30,61,47,0.18)] backdrop-blur"
                }`}
              >
                <Image
                  src={`/images/traike/3d/${tier.accessory}`}
                  alt=""
                  width={640}
                  height={640}
                  aria-hidden
                  className="pointer-events-none absolute -top-20 left-1/2 h-44 w-44 -translate-x-1/2 object-contain drop-shadow-[0_18px_22px_rgba(0,0,0,0.28)]"
                />
                <h2 className={`text-center text-lg font-semibold ${tier.highlighted ? "text-cream/80" : "text-forest/70"}`}>
                  {tier.name}
                </h2>
                <p className="mt-2 text-center">
                  <span className="font-sans text-6xl font-extralight">{tier.price}</span>
                  <span className={`ml-2 text-sm ${tier.highlighted ? "text-cream/60" : "text-charcoal/50"}`}>
                    {tier.priceNote}
                  </span>
                </p>
                <ul className="mt-8 flex flex-col gap-4">
                  {tier.quotas.map(([count, label], i) => (
                    <li key={label} className="flex items-center gap-3">
                      <span className={tier.highlighted ? "text-skysoft" : "text-terra"}>
                        <QuotaIcon index={i} />
                      </span>
                      <span className="font-sans text-3xl font-extralight">{count}</span>
                      <span className={`text-sm ${tier.highlighted ? "text-cream/80" : "text-charcoal/70"}`}>{label}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={tier.href}
                  className={`mt-10 rounded-full px-6 py-3.5 text-center font-bold transition-colors ${
                    tier.highlighted
                      ? "bg-terra text-cream shadow-[0_8px_24px_rgba(193,95,60,0.5)] hover:bg-terra/90"
                      : "bg-terra/10 text-terra hover:bg-terra/20"
                  }`}
                >
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-20">
        <div className="mx-auto max-w-[640px] px-4 sm:px-6">
          {FAQ.map((item) => (
            <details key={item.q} className="group border-b border-forest/15 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-forest">
                {item.q}
                <span className="text-terra transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 leading-relaxed text-charcoal/75">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
