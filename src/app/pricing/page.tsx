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
    a: "A walk built for you by the AI: your start, your time, your taste. Re-routing mid-walk is included. On the free plan you choose the places yourself and Traike arranges the route.",
  },
  {
    q: "Does the free plan ever expire?",
    a: "No. Your free walks renew every month.",
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0" aria-hidden>
      {paths[index]}
    </svg>
  );
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-cream font-app-sans text-charcoal">
      <SiteHeader variant="app" />

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

        <div className="tk-page px-4 pb-24 pt-16 sm:px-6 md:pt-24">
          <h1 className="text-balance text-center font-app-serif text-[44px] font-semibold leading-[1.05] text-tk-ink [font-variation-settings:'SOFT'_100,'WONK'_1] md:text-[64px]">
            Walk first. Pay later.
          </h1>

          {/* One column up to a desktop (each card at most 480px wide), three from lg. */}
          <div className="mx-auto mt-32 grid max-w-[480px] items-stretch gap-x-8 gap-y-24 lg:max-w-none lg:grid-cols-3">
            {PRICING_TIERS.map((tier) => (
              <div
                key={tier.id}
                className={`relative flex flex-col rounded-[6px] border-[1.5px] px-6 pb-6 pt-28 ${
                  tier.highlighted
                    ? "border-[var(--tk-lip)] bg-[var(--tk-sel)] text-[var(--tk-on-sel)] shadow-[0_6px_0_var(--tk-lip)] lg:-translate-y-4"
                    : "border-[var(--tk-ctl)] bg-cream text-tk-ink shadow-[0_4px_0_var(--tk-lip)]"
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
                <h2 className={`text-center text-[18px] font-semibold ${tier.highlighted ? "opacity-80" : "text-tk-sage"}`}>
                  {tier.name}
                </h2>
                <p className="mt-2 text-center">
                  <span className="font-app-serif text-[56px] font-semibold leading-none [font-variation-settings:'SOFT'_100,'WONK'_1]">{tier.price}</span>
                  <span className={`ms-2 text-[14px] font-semibold ${tier.highlighted ? "opacity-70" : "text-tk-sage"}`}>
                    {tier.priceNote}
                  </span>
                </p>
                <ul className="mb-8 mt-8 flex flex-col gap-4">
                  {tier.quotas.map(([count, label], i) => (
                    <li key={label} className="flex items-center gap-3">
                      <span className="text-[var(--tk-leather)]">
                        <QuotaIcon index={i} />
                      </span>
                      <span className="font-app-serif text-[28px] font-semibold leading-none [font-variation-settings:'SOFT'_100,'WONK'_1]">{count}</span>
                      <span className={`text-[15px] ${tier.highlighted ? "opacity-85" : "text-tk-body"}`}>{label}</span>
                    </li>
                  ))}
                </ul>
                <Link href={tier.href} className={`${tier.highlighted ? "tk-btn tk-btn-primary" : "tk-btn tk-btn-secondary"} mt-auto w-full`}>
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-20">
        <div className="mx-auto max-w-[720px] px-4 sm:px-6">
          {FAQ.map((item) => (
            <details key={item.q} className="group border-b border-tk-hair py-3">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-[18px] font-semibold text-tk-ink">
                {item.q}
                <span aria-hidden className="text-[var(--tk-leather)] transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-[16px] leading-6 text-tk-body">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <SiteFooter variant="app" />
    </div>
  );
}
