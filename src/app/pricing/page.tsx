import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/marketing/SiteFooter";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { PRICING_TIERS } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Pricing — Traike",
  description:
    "Your first walk is free. Then pay per city, or get an annual pass for every city Traike knows.",
};

const FAQ = [
  {
    q: "What counts as “one free walk”?",
    a: "A complete personalized walk, start to finish, in any supported city — with the full experience: live adaptation, re-routing, and local stories. It’s the real product, not a demo.",
  },
  {
    q: "Is the City Pass a subscription?",
    a: "No. You pay once per city and it stays unlocked on your account — come back to Lisbon in two years and it’s still yours.",
  },
  {
    q: "How does the personalization actually work?",
    a: "Traike’s AI engine learns your walking pace, how long you linger at different kinds of places, and what you skip — then uses that profile to build and continuously reshape each route. Your profile stays on your device.",
  },
  {
    q: "Will these prices change?",
    a: "We’re in early access, so pricing may evolve — but anything you’ve already unlocked stays unlocked at the price you paid.",
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-cream font-brand text-charcoal">
      <SiteHeader />

      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
          <h1 className="font-display text-4xl font-bold text-forest md:text-5xl">
            Try it first. Properly.
          </h1>
          <p className="mt-4 max-w-lg text-lg text-charcoal/75">
            Your first walk is the full experience, free. If the city clicks
            with you, unlock it — or take Traike everywhere.
          </p>

          <div className="mt-12 grid gap-6 md:grid-cols-3 md:gap-8">
            {PRICING_TIERS.map((tier) => (
              <div
                key={tier.id}
                className={
                  tier.highlighted
                    ? "flex flex-col rounded-xl bg-forest p-8 text-cream shadow-[0_4px_20px_rgba(30,61,47,0.25)]"
                    : "flex flex-col rounded-xl bg-white p-8 shadow-[0_4px_20px_rgba(30,61,47,0.12)]"
                }
              >
                {tier.highlighted && (
                  <span className="mb-4 self-start rounded-full bg-terra px-3 py-1 text-xs font-bold uppercase tracking-wide text-cream">
                    Most popular
                  </span>
                )}
                <h2
                  className={`text-xl font-semibold ${tier.highlighted ? "text-cream" : "text-forest"}`}
                >
                  {tier.name}
                </h2>
                <p className="mt-4 flex items-baseline gap-2">
                  <span
                    className={`font-display text-4xl font-bold ${tier.highlighted ? "text-cream" : "text-forest"}`}
                  >
                    {tier.price}
                  </span>
                  <span
                    className={`text-sm ${tier.highlighted ? "text-cream/70" : "text-charcoal/60"}`}
                  >
                    {tier.priceNote}
                  </span>
                </p>
                <p
                  className={`mt-4 leading-relaxed ${tier.highlighted ? "text-cream/85" : "text-charcoal/75"}`}
                >
                  {tier.tagline}
                </p>
                <ul className="mt-6 flex flex-col gap-3 text-sm">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex gap-2.5">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`mt-0.5 h-4 w-4 shrink-0 ${tier.highlighted ? "text-skysoft" : "text-terra"}`}
                        aria-hidden
                      >
                        <path d="m5 13 4 4L19 7" />
                      </svg>
                      <span
                        className={
                          tier.highlighted ? "text-cream/90" : "text-charcoal/80"
                        }
                      >
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={tier.href}
                  className={
                    tier.highlighted
                      ? "mt-8 rounded-[10px] bg-terra px-6 py-3 text-center font-bold text-cream shadow-[0_4px_20px_rgba(0,0,0,0.2)] transition-colors hover:bg-terra/90"
                      : "mt-8 rounded-[10px] bg-terra/10 px-6 py-3 text-center font-bold text-terra transition-colors hover:bg-terra/20"
                  }
                >
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>

          <p className="mt-8 text-sm text-charcoal/55">
            Early-access pricing — the model may evolve, but whatever you
            unlock stays yours.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-skysoft/25 py-16 md:py-24">
        <div className="mx-auto max-w-[760px] px-4 sm:px-6">
          <h2 className="font-display text-3xl font-bold text-forest">
            Questions people ask
          </h2>
          <dl className="mt-10 flex flex-col gap-8">
            {FAQ.map((item) => (
              <div key={item.q}>
                <dt className="text-lg font-semibold text-forest">{item.q}</dt>
                <dd className="mt-2 leading-relaxed text-charcoal/75">
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>
          <Link
            href="/app"
            className="mt-12 inline-block rounded-[10px] bg-terra px-7 py-3.5 font-bold text-cream shadow-[0_4px_20px_rgba(30,61,47,0.12)] transition-colors hover:bg-terra/90"
          >
            Start your first walk — free
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
