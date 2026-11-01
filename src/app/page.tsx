import Image from "next/image";
import Link from "next/link";

import { ClosingVideo } from "@/components/marketing/landing/ClosingVideo";
import { FloatingPropCard } from "@/components/marketing/landing/FloatingPropCard";
import { LandingHero } from "@/components/marketing/landing/LandingHero";
import { PropParallax } from "@/components/marketing/landing/PropParallax";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { SiteHeader } from "@/components/marketing/SiteHeader";

const STEPS = [
  {
    prop: "/images/traike/3d/compass.png",
    title: "Say how long you have",
    body: "“Give me 90 minutes near the old port.” That’s the setup.",
  },
  {
    prop: "/images/traike/3d/pin.png",
    title: "Get a walk that’s yours",
    body: "Built around your pace and what’s open right now.",
  },
  {
    prop: "/images/traike/3d/boot.png",
    title: "Walk. It adapts.",
    body: "Linger or speed up. You still finish on time.",
  },
];

const FEATURES = [
  {
    prop: "/images/landing/prop-watch.webp",
    title: "Adapts in real time",
    body: "Watches your pace and reroutes as you go.",
  },
  {
    prop: "/images/landing/prop-mug.webp",
    title: "Learns what you linger on",
    body: "Your next walk starts from who you are.",
  },
  {
    prop: "/images/landing/prop-binoculars.webp",
    title: "Local stories, not landmarks",
    body: "The courtyard café, the mural down the alley.",
  },
];

// TODO(launch gate): confirm these are real, attributable quotes before launch.
const TESTIMONIALS = [
  {
    quote:
      "Every guided tour leaves me behind. Traike just adjusted, and I never felt rushed.",
    name: "Maya",
    detail: "Lisbon",
  },
  {
    quote:
      "75 minutes before our train. It built a loop and got us back with eight minutes to spare.",
    name: "Daniel & Or",
    detail: "Rome",
  },
  {
    quote:
      "It walked me down a street I’d never noticed in ten years. That café is now my regular.",
    name: "Noa",
    detail: "Tel Aviv",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-cream font-brand text-charcoal">
      <SiteHeader />
      <PropParallax />

      <LandingHero />

      {/* How it works */}
      <section
        id="how-it-works"
        className="relative isolate scroll-mt-20 overflow-hidden"
      >
        <Image
          src="/images/hub-mountain-lake-sunset.png"
          alt=""
          fill
          sizes="100vw"
          aria-hidden
          className="-z-20 object-cover object-center"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-cream via-cream/60 to-cream" />
        <div className="mx-auto max-w-[1200px] px-4 pb-24 pt-16 sm:px-6 md:pt-24">
          <h2 className="text-center font-display text-4xl font-normal text-forest md:text-6xl">
            Three steps, then just walk
          </h2>
          <ol className="mt-56 grid gap-x-8 gap-y-44 md:mt-60 md:grid-cols-3 md:gap-y-16">
            {STEPS.map((s) => (
              <li key={s.title}>
                <FloatingPropCard {...s} />
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Features */}
      <section className="relative isolate overflow-hidden">
        <Image
          src="/images/meadow-hikers-new.png"
          alt=""
          fill
          sizes="100vw"
          aria-hidden
          className="-z-20 object-cover object-[50%_70%]"
        />
        <div className="absolute inset-0 -z-10 bg-cream/85" />
        <div className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6 md:py-28">
          <h2 className="text-center font-display text-4xl font-normal text-forest md:text-6xl">
            Made for the way you wander
          </h2>
          <div className="mt-48 grid gap-x-8 gap-y-44 md:mt-52 md:grid-cols-3 md:gap-y-16">
            {FEATURES.map((f) => (
              <FloatingPropCard key={f.title} {...f} />
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="relative isolate overflow-hidden py-20 md:py-28">
        <Image
          src="/images/landing/forest-plate.webp"
          alt=""
          fill
          sizes="100vw"
          aria-hidden
          className="-z-20 object-cover object-center"
        />
        <div className="absolute inset-0 -z-10 bg-tk-ink/70" />
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
          <h2 className="text-center font-display text-4xl font-normal text-cream md:text-6xl">
            Walks people still talk about
          </h2>
          <div className="mt-14 grid gap-6 md:grid-cols-3 md:gap-8">
            {TESTIMONIALS.map((t) => (
              <figure
                key={t.name}
                className="flex flex-col justify-between rounded-[28px] bg-cream p-8 shadow-[0_16px_44px_rgba(0,0,0,0.3)]"
              >
                <blockquote className="text-lg leading-relaxed text-charcoal/85">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-6 text-[15px]">
                  <span className="font-bold text-forest">{t.name}</span>
                  <span className="text-charcoal/60"> · {t.detail}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Closing card */}
      <section className="px-4 py-16 sm:px-6 md:py-24">
        <div className="relative mx-auto max-w-[1200px]">
          <Image
            src="/images/landing/prop-backpack.webp"
            alt=""
            width={900}
            height={1118}
            aria-hidden
            className="pointer-events-none absolute -top-14 right-6 z-10 hidden w-[170px] drop-shadow-[0_22px_26px_rgba(7,42,31,0.4)] md:block"
          />
          <div className="relative isolate mx-auto flex h-[520px] max-w-[1200px] items-center overflow-hidden rounded-[28px] shadow-[0_24px_60px_rgba(30,61,47,0.3)] md:h-[560px]">
            <ClosingVideo className="absolute inset-0 -z-20 h-full w-full object-cover object-[20%_50%]" />
            <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(7,42,31,0.78),rgba(7,42,31,0.2)_70%)] max-md:bg-[linear-gradient(180deg,rgba(7,42,31,0.7),rgba(7,42,31,0.35))]" />
            <div className="px-8 md:px-14">
              <h2 className="max-w-lg font-display text-4xl font-normal text-cream md:text-6xl">
                Your first walk is on us
              </h2>
              <p className="mt-4 text-xl text-cream/90">Any city. No card.</p>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                <Link
                  href="/app"
                  className="rounded-full bg-terra px-8 py-4 text-lg font-bold text-cream shadow-[0_8px_24px_rgba(193,95,60,0.5)] transition-colors hover:bg-terra/90"
                >
                  Start a free walk
                </Link>
                <Link
                  href="/pricing"
                  className="text-base font-semibold text-cream underline-offset-4 hover:underline"
                >
                  See pricing
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
