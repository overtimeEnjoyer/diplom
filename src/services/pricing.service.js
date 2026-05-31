import { getModels } from '../models/index.js';

export const DEFAULT_PRICING = {
  prices: {
    'mak-cards': 1890,
    medium: 3990,
    premium: 4990,
    section: 890,
  },
  currency: 'UAH',
};

function toPositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.round(n);
}

function mapRow(row) {
  if (!row) return DEFAULT_PRICING;
  const plain = row.toJSON ? row.toJSON() : row;
  return {
    prices: {
      'mak-cards': toPositiveInt(plain.makCardsPrice, DEFAULT_PRICING.prices['mak-cards']),
      medium: toPositiveInt(plain.mediumPrice, DEFAULT_PRICING.prices.medium),
      premium: toPositiveInt(plain.premiumPrice, DEFAULT_PRICING.prices.premium),
      section: toPositiveInt(plain.sectionPrice, DEFAULT_PRICING.prices.section),
    },
    currency: String(plain.currency || DEFAULT_PRICING.currency).trim().toUpperCase() || DEFAULT_PRICING.currency,
  };
}

export async function loadPricingSettings() {
  const { Pricing } = getModels();
  try {
    const row = await Pricing.findOne({ order: [['id', 'ASC']] });
    return mapRow(row);
  } catch {
    return DEFAULT_PRICING;
  }
}

export async function ensureDefaultPricing() {
  const { Pricing } = getModels();
  try {
    const { v4: uuidv4 } = await import('uuid');
    const existing = await Pricing.findOne();
    if (existing) return existing;
    return Pricing.create({
      documentId: uuidv4(),
      makCardsPrice: DEFAULT_PRICING.prices['mak-cards'],
      mediumPrice: DEFAULT_PRICING.prices.medium,
      premiumPrice: DEFAULT_PRICING.prices.premium,
      sectionPrice: DEFAULT_PRICING.prices.section,
      currency: DEFAULT_PRICING.currency,
    });
  } catch (err) {
    if (err.name === 'SequelizeDatabaseError' || err.original?.code === '42P01') {
      const migrationHint = new Error(
        'Database tables are missing. Run: DATABASE_URL="..." pnpm db:migrate && pnpm db:seed',
      );
      migrationHint.cause = err;
      throw migrationHint;
    }
    throw err;
  }
}

/** Public pricing row for GET /api/pricing (Strapi-compatible shape). */
export async function getPublicPricing() {
  const { Pricing } = getModels();
  const row = await Pricing.findOne({ order: [['id', 'ASC']] });
  return { data: row ? formatPricingForApi(row) : null, meta: {} };
}

export function formatPricingForApi(row) {
  const plain = row.toJSON ? row.toJSON() : row;
  return {
    id: plain.id,
    documentId: plain.documentId,
    makCardsPrice: plain.makCardsPrice,
    mediumPrice: plain.mediumPrice,
    premiumPrice: plain.premiumPrice,
    sectionPrice: plain.sectionPrice,
    currency: plain.currency,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
}
