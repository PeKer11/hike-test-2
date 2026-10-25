/**
 * Single source of truth for Traike pricing.
 *
 * DRAFT packages (2026-10-25): prices and quotas come from the cost research in
 * the vault (projects/hiking-ai.md, "TODO — pricing & quotas") and are not wired
 * to billing or enforced yet. Edit numbers/tiers here only, never inline in
 * components.
 */

export const CITY_PRICE_USD = 4.99;
export const ANNUAL_PRICE_USD = 39.99;

export interface PricingTier {
  id: "free" | "city" | "annual";
  name: string;
  price: string;
  priceNote: string;
  /** What the buyer gets, one short line each: [count, label]. */
  quotas: [string, string][];
  cta: string;
  href: string;
  highlighted: boolean;
  /** Glossy 3D accessory under /images/traike/3d. */
  accessory: string;
}

export const PRICING_TIERS: PricingTier[] = [
  {
    id: "free",
    name: "First Steps",
    price: "Free",
    priceNote: "every day",
    quotas: [
      ["1", "AI route a day"],
      ["8", "chat messages"],
      ["2", "top-rated searches"],
    ],
    cta: "Start walking",
    href: "/app",
    highlighted: false,
    accessory: "boot.png",
  },
  {
    id: "city",
    name: "City Pass",
    price: `$${CITY_PRICE_USD}`,
    priceNote: "7 days",
    quotas: [
      ["10", "AI routes"],
      ["60", "chat messages"],
      ["15", "top-rated searches"],
    ],
    cta: "Get the pass",
    href: "/app",
    highlighted: true,
    accessory: "pin.png",
  },
  {
    id: "annual",
    name: "Annual",
    price: `$${ANNUAL_PRICE_USD}`,
    priceNote: "per year",
    quotas: [
      ["12", "AI routes a month"],
      ["150", "chat messages a month"],
      ["40", "top-rated searches a month"],
    ],
    cta: "Go annual",
    href: "/app",
    highlighted: false,
    accessory: "compass.png",
  },
];
