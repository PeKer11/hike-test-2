/**
 * Single source of truth for Traike pricing.
 *
 * The monetization model is tentative (hybrid freemium) and may change —
 * edit numbers/tiers here only, never inline in components.
 */

export const CITY_PRICE_USD = 9.99;
export const ANNUAL_PRICE_USD = 39.99;

export interface PricingTier {
  id: "free" | "city" | "annual";
  name: string;
  price: string;
  priceNote: string;
  tagline: string;
  features: string[];
  cta: string;
  href: string;
  highlighted: boolean;
}

export const PRICING_TIERS: PricingTier[] = [
  {
    id: "free",
    name: "First Walk",
    price: "Free",
    priceNote: "no card, no catch",
    tagline:
      "Try Traike properly — your first personalized walk in any city, start to finish.",
    features: [
      "One full personalized walk",
      "Real-time pace and interest adaptation",
      "Local stories along the route",
      "Works in any supported city",
    ],
    cta: "Start your first walk",
    href: "/app",
    highlighted: false,
  },
  {
    id: "city",
    name: "City Pass",
    price: `$${CITY_PRICE_USD}`,
    priceNote: "per city, yours forever",
    tagline:
      "Unlock unlimited walks in one city — ideal for a trip of a few days.",
    features: [
      "Unlimited walks in one city",
      "Traike keeps learning your pace and taste",
      "Re-route anytime mid-walk",
      "Every walk saved to your journal",
    ],
    cta: "Unlock a city",
    href: "/app",
    highlighted: true,
  },
  {
    id: "annual",
    name: "Annual Pass",
    price: `$${ANNUAL_PRICE_USD}`,
    priceNote: "per year, every city",
    tagline:
      "For repeat travelers and locals who walk their own city — everything, everywhere.",
    features: [
      "Unlimited walks in every city",
      "Your walking profile travels with you",
      "New cities included as they launch",
      "Priority access to new features",
    ],
    cta: "Get the Annual Pass",
    href: "/app",
    highlighted: false,
  },
];
