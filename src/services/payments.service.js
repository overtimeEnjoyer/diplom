import { Op } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env.js';
import { getModels } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { loadPricingSettings } from './pricing.service.js';

export const ACCESS_KINDS = ['mak-cards', 'medium', 'premium', 'section'];

function paymentProvider() {
  const raw = String(process.env.PAYMENT_PROVIDER || '').trim().toLowerCase();
  if (raw === 'mock' || raw === 'manual') return raw;
  return env.isProduction ? 'manual' : 'mock';
}

function buildOrderReference(kind, userId, methodSectionId) {
  const random = Math.random().toString(36).slice(2, 8);
  if (kind === 'section') {
    return `RKM|section|${userId}|${methodSectionId || 0}|${Date.now()}|${random}`;
  }
  return `RKM|${kind}|${userId}|${Date.now()}|${random}`;
}

export function parseOrderReference(orderReference) {
  const parts = String(orderReference || '').split('|');
  if (parts[0] !== 'RKM') return null;

  const kind = parts[1];
  const userId = Number(parts[2]);
  if (!ACCESS_KINDS.includes(kind) || !Number.isFinite(userId) || userId <= 0) return null;

  if (kind === 'section') {
    if (parts.length < 6) return null;
    const methodSectionId = Number(parts[3]);
    if (!Number.isFinite(methodSectionId) || methodSectionId <= 0) return null;
    return { kind, userId, methodSectionId };
  }

  if (parts.length < 5) return null;
  return { kind, userId };
}

async function createPendingPaymentIntent(kind, user, options = {}) {
  const { prices, currency } = await loadPricingSettings();
  const amount = prices[kind];
  if (!Number.isFinite(amount) || amount <= 0) {
    throw ApiError.internal(`Price not configured for access type: ${kind}`);
  }

  return {
    orderReference: buildOrderReference(kind, user.id, options.methodSectionId),
    amount,
    currency,
    provider: paymentProvider(),
    type: kind,
    status: 'pending',
  };
}

function buildPaymentRequiredResponse(kind, intent) {
  return {
    status: 'payment_required',
    access: kind,
    payment_required: true,
    payment: {
      provider: intent.provider,
      type: intent.type,
      amount: intent.amount,
      currency: intent.currency,
      orderReference: intent.orderReference,
      status: intent.status,
    },
    orderReference: intent.orderReference,
    amount: intent.amount,
    currency: intent.currency,
  };
}

/** Start a pending payment for any access type (tariff, MAK, section). */
export async function startAccessPayment(kind, user, options = {}) {
  const intent = await createPendingPaymentIntent(kind, user, options);
  return buildPaymentRequiredResponse(kind, intent);
}

export function activateMediumAccess(user) {
  return startAccessPayment('medium', user);
}

export function activatePremiumAccess(user) {
  return startAccessPayment('premium', user);
}

export function startMakCardsAccess(user) {
  return startAccessPayment('mak-cards', user);
}

export function canConfirmMockPayment() {
  return env.isTest || !env.isProduction || process.env.PAYMENT_MOCK_CONFIRM === 'true';
}

/** Demo/local confirmation — disabled in production unless PAYMENT_MOCK_CONFIRM=true. */
export async function confirmMockPayment(orderReference, { userId } = {}) {
  if (!canConfirmMockPayment()) {
    throw ApiError.forbidden('Mock payment confirmation is disabled in production');
  }
  const parsed = parseOrderReference(orderReference);
  if (!parsed) throw ApiError.badRequest('Unknown orderReference format');
  if (userId != null && parsed.userId !== userId) {
    throw ApiError.forbidden('Order does not belong to this user');
  }
  return confirmPayment(orderReference);
}

/** Admin/manual confirmation after offline payment verification. */
export async function confirmManualPayment(orderReference) {
  return confirmPayment(orderReference);
}

export async function confirmPayment(orderReference) {
  const parsed = parseOrderReference(orderReference);
  if (!parsed) throw ApiError.badRequest('Unknown orderReference format');

  const amount = await expectedPrice(parsed.kind);
  const currency = await expectedCurrency();

  if (parsed.kind === 'section' && parsed.methodSectionId) {
    await applyPaidSectionAccess(parsed.userId, parsed.methodSectionId);
  } else {
    await applyPaidAccess(parsed.kind, parsed.userId);
  }

  return {
    ok: true,
    paid: true,
    orderReference,
    kind: parsed.kind,
    userId: parsed.userId,
    methodSectionId: parsed.methodSectionId || null,
    amount,
    currency,
  };
}

function txOpts(transaction) {
  return transaction ? { transaction } : {};
}

async function grantMakCardsAccess(userId, skipUserFlagUpdate, transaction) {
  if (skipUserFlagUpdate) return;
  const { User } = getModels();
  await User.update({ makCardsAccess: true }, { where: { id: userId }, ...txOpts(transaction) });
}

async function grantAllSectionsPaid(userId, transaction) {
  const { MethodSection, UserMethodSection } = getModels();
  const sections = await MethodSection.findAll({
    attributes: ['id'],
    ...txOpts(transaction),
  });
  if (!sections.length) return;

  const sectionIds = sections.map((s) => s.id);
  const existing = await UserMethodSection.findAll({
    where: { userId, methodSectionId: { [Op.in]: sectionIds } },
    ...txOpts(transaction),
  });
  const existingBySectionId = new Map(existing.map((row) => [row.methodSectionId, row]));

  const unpaidIds = existing.filter((row) => !row.isPaid).map((row) => row.id);
  if (unpaidIds.length) {
    await UserMethodSection.update(
      { isPaid: true },
      { where: { id: { [Op.in]: unpaidIds } }, ...txOpts(transaction) },
    );
  }

  const missingSectionIds = sectionIds.filter((id) => !existingBySectionId.has(id));
  if (missingSectionIds.length) {
    await UserMethodSection.bulkCreate(
      missingSectionIds.map((methodSectionId) => ({
        documentId: uuidv4(),
        userId,
        methodSectionId,
        isPaid: true,
      })),
      txOpts(transaction),
    );
  }
}

async function grantMediumAccess(userId, skipUserFlagUpdate, transaction) {
  const { User } = getModels();
  if (!skipUserFlagUpdate) {
    await User.update({ isMedium: true }, { where: { id: userId }, ...txOpts(transaction) });
  }
  await grantAllSectionsPaid(userId, transaction);
}

async function grantPremiumAccess(userId, skipUserFlagUpdate, transaction) {
  const { User } = getModels();
  if (!skipUserFlagUpdate) {
    await User.update(
      { makCardsAccess: true, isPremium: true },
      { where: { id: userId }, ...txOpts(transaction) },
    );
  }
  await grantMediumAccess(userId, true, transaction);
}

async function grantSingleSectionAccess(userId, methodSectionId, transaction) {
  const { UserMethodSection } = getModels();
  const existing = await UserMethodSection.findOne({
    where: { userId, methodSectionId },
    ...txOpts(transaction),
  });
  if (existing) {
    if (!existing.isPaid) await existing.update({ isPaid: true }, txOpts(transaction));
    return;
  }
  await UserMethodSection.create(
    {
      documentId: uuidv4(),
      userId,
      methodSectionId,
      isPaid: true,
    },
    txOpts(transaction),
  );
}

async function runInTransaction(fn) {
  const { sequelize } = getModels();
  return sequelize.transaction(fn);
}

export async function applyPaidAccess(kind, userId, options = {}) {
  const { User } = getModels();
  const user = await User.findByPk(userId);
  if (!user) return;

  await runInTransaction(async (transaction) => {
    if (kind === 'mak-cards') {
      await grantMakCardsAccess(userId, options.skipUserFlagUpdate, transaction);
      return;
    }
    if (kind === 'medium') {
      await grantMediumAccess(userId, options.skipUserFlagUpdate, transaction);
      return;
    }
    if (kind === 'section') return;
    await grantPremiumAccess(userId, options.skipUserFlagUpdate, transaction);
  });
}

export async function applyPaidSectionAccess(userId, methodSectionId) {
  await runInTransaction(async (transaction) => {
    await grantSingleSectionAccess(userId, methodSectionId, transaction);
  });
}

export async function revokeAllMethodicsAccess(userId) {
  const { UserMethodSection } = getModels();
  await runInTransaction(async (transaction) => {
    await UserMethodSection.destroy({ where: { userId }, ...txOpts(transaction) });
  });
}

export async function expectedPrice(kind) {
  const { prices } = await loadPricingSettings();
  return prices[kind];
}

export async function expectedCurrency() {
  const { currency } = await loadPricingSettings();
  return currency;
}

export async function checkAccessStatus(kind, userId, methodSectionId) {
  const { User, UserMethodSection } = getModels();
  const user = await User.unscoped().findByPk(userId);
  if (!user) return false;

  if (kind === 'mak-cards') return user.makCardsAccess === true;
  if (kind === 'medium') return user.isMedium === true;
  if (kind === 'premium') return user.isPremium === true;
  if (!methodSectionId) return false;

  const row = await UserMethodSection.findOne({
    where: { userId, methodSectionId, isPaid: true },
  });
  return !!row;
}

export async function syncUserTariffFromAdmin(userId, { isPremium, isMedium, makCardsAccess }) {
  if (isPremium) {
    await applyPaidAccess('premium', userId, { skipUserFlagUpdate: true });
    return;
  }
  if (isMedium) {
    await applyPaidAccess('medium', userId, { skipUserFlagUpdate: true });
    return;
  }
  await revokeAllMethodicsAccess(userId);
  if (makCardsAccess) await applyPaidAccess('mak-cards', userId, { skipUserFlagUpdate: true });
}
