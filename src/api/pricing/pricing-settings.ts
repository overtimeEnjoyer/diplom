declare const strapi: any;

type AccessKind = "mak-cards" | "medium" | "premium" | "section";

export type PricingSettings = {
  prices: Record<AccessKind, number>;
  currency: string;
};

export const DEFAULT_PRICING: PricingSettings = {
  prices: {
    "mak-cards": 1890,
    medium: 3990,
    premium: 4990,
    section: 890,
  },
  currency: "UAH",
};

function toPositiveInt(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.round(n);
}

function mapEntryToSettings(entry: Record<string, unknown> | null | undefined): PricingSettings {
  if (!entry) return DEFAULT_PRICING;

  const currency = String(entry.currency || DEFAULT_PRICING.currency).trim().toUpperCase() || DEFAULT_PRICING.currency;

  return {
    prices: {
      "mak-cards": toPositiveInt(entry.makCardsPrice, DEFAULT_PRICING.prices["mak-cards"]),
      medium: toPositiveInt(entry.mediumPrice, DEFAULT_PRICING.prices.medium),
      premium: toPositiveInt(entry.premiumPrice, DEFAULT_PRICING.prices.premium),
      section: toPositiveInt(entry.sectionPrice, DEFAULT_PRICING.prices.section),
    },
    currency,
  };
}

async function findPricingEntry(): Promise<Record<string, unknown> | null> {
  const uid = "api::pricing.pricing";

  if (strapi.documents?.(uid)?.findFirst) {
    const doc = await strapi.documents(uid).findFirst();
    return (doc as Record<string, unknown> | null) || null;
  }

  const rows = await strapi.entityService.findMany(uid);
  if (Array.isArray(rows)) return (rows[0] as Record<string, unknown> | undefined) || null;
  return (rows as Record<string, unknown> | null) || null;
}

export async function loadPricingSettings(): Promise<PricingSettings> {
  try {
    return mapEntryToSettings(await findPricingEntry());
  } catch (error) {
    strapi.log.warn(
      `[pricing] failed to load settings, using defaults: ${String((error as Error)?.message || error)}`,
    );
    return DEFAULT_PRICING;
  }
}

export async function ensureDefaultPricing(): Promise<void> {
  const uid = "api::pricing.pricing";
  const existing = await findPricingEntry();
  if (existing) return;

  const data = {
    makCardsPrice: DEFAULT_PRICING.prices["mak-cards"],
    mediumPrice: DEFAULT_PRICING.prices.medium,
    premiumPrice: DEFAULT_PRICING.prices.premium,
    sectionPrice: DEFAULT_PRICING.prices.section,
    currency: DEFAULT_PRICING.currency,
  };

  if (strapi.documents?.(uid)?.create) {
    await strapi.documents(uid).create({ data });
    return;
  }

  await strapi.entityService.create(uid, { data });
}
