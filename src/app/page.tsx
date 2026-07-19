import Image from "next/image";
import Link from "next/link";

import { SiteFooter } from "@/components/marketing/SiteFooter";
import { SiteHeader } from "@/components/marketing/SiteHeader";

/* Inline icons in the Iconoir style (1.5px stroke, round caps) — DESIGN.md
   forbids Lucide; no icon package is worth adding for four glyphs. */
function IconClock({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.5} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function IconPath({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.5} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M5 20c6 0 2-7 8-7s2-8 6-8" />
      <circle cx="5" cy="20" r="1.5" fill="currentColor" />
      <circle cx="19" cy="5" r="1.5" fill="currentColor" />
    </svg>
  );
}

function IconWalk({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.5} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="13" cy="4.5" r="2" />
      <path d="M13 8.5 10 11l1 4-3 5.5" />
      <path d="M13 8.5l2.5 3 3 .5" />
      <path d="M11 15l3 2 1 4.5" />
    </svg>
  );
}

function IconCompass({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.5} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </svg>
  );
}

function IconMapPin({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.5} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 21s-7-5.1-7-11a7 7 0 0 1 14 0c0 5.9-7 11-7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function IconHeart({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.5} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 20.5s-8-4.9-8-11a4.5 4.5 0 0 1 8-2.8 4.5 4.5 0 0 1 8 2.8c0 6.1-8 11-8 11Z" />
    </svg>
  );
}

const STEPS = [
  {
    icon: IconClock,
    title: "Say how long you have",
    body: "“Give me 90 minutes near the old port.” That’s the whole setup — no browsing tour catalogs, no planning the night before.",
  },
  {
    icon: IconPath,
    title: "Get a walk that’s yours",
    body: "Traike shapes a route around your pace, the things you love lingering over, and what’s actually open and nearby right now.",
  },
  {
    icon: IconWalk,
    title: "Walk — it adapts with you",
    body: "Stop longer at a market? Speed up? Traike quietly reshapes what’s ahead so you always finish on time, never mid-highlight.",
  },
];

const FEATURES = [
  {
    icon: IconCompass,
    title: "Adapts in real time",
    body: "Every other app hands you a fixed route someone else designed. Traike watches your actual pace and time left, and reroutes as you go.",
  },
  {
    icon: IconHeart,
    title: "Learns what you linger on",
    body: "Skip the cathedral, stay an hour in the food market — next walk starts from who you are, not from a tourist top-10 list.",
  },
  {
    icon: IconMapPin,
    title: "Local stories, not landmarks",
    body: "The courtyard café, the mural in the side alley, the story behind the street name — the city a local would show you.",
  },
  {
    icon: IconClock,
    title: "Fits the time you have",
    body: "Forty minutes before dinner or a full free morning — every walk ends where and when you need it to.",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "I’m a slow walker and every guided tour leaves me behind. Traike just… adjusted. I finished the whole route and never felt rushed.",
    name: "Maya",
    detail: "3 days in Lisbon",
  },
  {
    quote:
      "We had 75 minutes before our train out of Rome. It built a loop from the station and got us back with eight minutes to spare.",
    name: "Daniel & Or",
    detail: "Layover in Rome",
  },
  {
    quote:
      "I’ve lived in Tel Aviv for a decade and it walked me down a street I’d never once noticed. That café is now my regular.",
    name: "Noa",
    detail: "Local, Tel Aviv",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-cream font-brand text-charcoal">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <Image
          src="/images/hero-tent-sunrise-new.png"
          alt="Sunrise over mountains seen from inside a tent"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-forest/70 via-forest/45 to-forest/75" />
        <div className="relative mx-auto flex max-w-[1200px] flex-col items-start px-4 py-24 sm:px-6 md:py-40">
          <h1 className="max-w-xl font-display text-4xl font-bold leading-[1.2] text-cream sm:text-5xl md:text-6xl">
            A walk built around you
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-cream/90">
            Tell Traike how much time you have. It shapes a route around your
            pace, your interests, and the city in front of you — and reshapes
            it as you walk.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/app"
              className="rounded-[10px] bg-terra px-7 py-3.5 text-center text-base font-bold text-cream shadow-[0_4px_20px_rgba(30,61,47,0.3)] transition-colors hover:bg-terra/90"
            >
              Start your first walk — free
            </Link>
            <Link
              href="#how-it-works"
              className="rounded-[10px] px-7 py-3.5 text-center text-base font-semibold text-cream/90 transition-colors hover:bg-cream/10"
            >
              See how it works
            </Link>
          </div>
          <p className="mt-8 text-sm text-cream/80">
            ★★★★★&ensp;Walked and loved by early explorers in Tel Aviv, Lisbon
            and Athens
          </p>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-20 py-16 md:py-28">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
          <h2 className="font-display text-3xl font-bold text-forest md:text-4xl">
            Three steps, then just walk
          </h2>
          <p className="mt-3 max-w-lg text-charcoal/70">
            No route catalogs to browse. No itinerary spreadsheets. The planning
            is the part Traike does.
          </p>
          <ol className="mt-12 grid gap-6 md:grid-cols-3 md:gap-8">
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                className="rounded-xl bg-white p-8 shadow-[0_4px_20px_rgba(30,61,47,0.12)]"
              >
                <div className="flex items-center gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-terra/10 text-terra">
                    <step.icon className="h-6 w-6" />
                  </span>
                  <span className="font-display text-3xl font-bold text-skysoft">
                    {i + 1}
                  </span>
                </div>
                <h3 className="mt-5 text-xl font-semibold text-forest">
                  {step.title}
                </h3>
                <p className="mt-3 leading-relaxed text-charcoal/75">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* The gap — photo + argument */}
      <section className="bg-skysoft/25 py-16 md:py-28">
        <div className="mx-auto grid max-w-[1200px] items-center gap-10 px-4 sm:px-6 md:grid-cols-2 md:gap-16">
          <div className="relative h-80 overflow-hidden rounded-xl shadow-[0_4px_20px_rgba(30,61,47,0.12)] md:h-[480px]">
            <Image
              src="/images/meadow-hikers-new.png"
              alt="Three friends walking together through an alpine wildflower meadow"
              fill
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
          <div>
            <h2 className="font-display text-3xl font-bold text-forest md:text-4xl">
              Not someone else&rsquo;s tour
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-charcoal/80">
              Every tour app hands you the same fixed route it hands everyone
              else — recorded once, walked by thousands, adapted to no one.
            </p>
            <p className="mt-4 text-lg leading-relaxed text-charcoal/80">
              Traike doesn&rsquo;t have a route database. It builds your walk
              at the moment you ask, from where you&rsquo;re standing, for the
              time you actually have — and keeps rebuilding it while you walk.
            </p>
            <Link
              href="/app"
              className="mt-8 inline-block rounded-[10px] bg-terra px-7 py-3.5 text-base font-bold text-cream shadow-[0_4px_20px_rgba(30,61,47,0.12)] transition-colors hover:bg-terra/90"
            >
              Start your first walk — free
            </Link>
          </div>
        </div>
      </section>

      {/* Feature highlights */}
      <section className="py-16 md:py-28">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
          <h2 className="font-display text-3xl font-bold text-forest md:text-4xl">
            Made for the way you actually wander
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 md:gap-8">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-xl bg-white p-8 shadow-[0_4px_20px_rgba(30,61,47,0.12)]"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-forest/10 text-forest">
                  <f.icon className="h-6 w-6" />
                </span>
                <h3 className="mt-5 text-xl font-semibold text-forest">
                  {f.title}
                </h3>
                <p className="mt-3 leading-relaxed text-charcoal/75">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-forest py-16 md:py-28">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
          <h2 className="font-display text-3xl font-bold text-cream md:text-4xl">
            Walks people still talk about
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3 md:gap-8">
            {TESTIMONIALS.map((t) => (
              <figure
                key={t.name}
                className="flex flex-col justify-between rounded-xl bg-cream p-8 shadow-[0_4px_20px_rgba(0,0,0,0.2)]"
              >
                <blockquote className="leading-relaxed text-charcoal/85">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-6 text-sm">
                  <span className="font-bold text-forest">{t.name}</span>
                  <span className="text-charcoal/60"> · {t.detail}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="relative overflow-hidden">
        <Image
          src="/images/sunset-couple-new.png"
          alt="Couple at a sunset overlook with a camp stove"
          fill
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-charcoal/55" />
        <div className="relative mx-auto flex max-w-[1200px] flex-col items-center px-4 py-24 text-center sm:px-6 md:py-36">
          <h2 className="max-w-2xl font-display text-3xl font-bold text-cream md:text-5xl">
            Your first walk is on us
          </h2>
          <p className="mt-4 max-w-md text-lg text-cream/90">
            One full walk, in any city, free — no card, no account hoops. See
            what a walk built for you feels like.
          </p>
          <Link
            href="/app"
            className="mt-8 rounded-[10px] bg-terra px-8 py-4 text-lg font-bold text-cream shadow-[0_4px_20px_rgba(0,0,0,0.3)] transition-colors hover:bg-terra/90"
          >
            Start your first walk — free
          </Link>
          <Link
            href="/pricing"
            className="mt-4 text-sm font-semibold text-cream/80 underline-offset-4 hover:underline"
          >
            Curious what comes after? See pricing
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
