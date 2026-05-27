import crypto from 'crypto';
import { Op } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { getModels } from '../models/index.js';
import { loadPricingSettings } from './pricing.service.js';

const WFP_PAY_OFFLINE_URL = 'https://secure.wayforpay.com/pay?behavior=offline';
const WFP_PAY_FALLBACK_URL = 'https://secure.wayforpay.com/pay';

function requirePaymentConfig() {
  const merchantAccount = (process.env.WAYFORPAY_MERCHANT_ACCOUNT || '').trim();
  const merchantDomainName = (process.env.WAYFORPAY_MERCHANT_DOMAIN_NAME || '').trim();
  const merchantSecretKey = (process.env.WAYFORPAY_MERCHANT_SECRET_KEY || '').trim();
  const merchantPassword = (process.env.WAYFORPAY_MERCHANT_PASSWORD || '').trim();
  const returnUrl = (process.env.WAYFORPAY_RETURN_URL || '').trim();
  const serviceUrl = (process.env.WAYFORPAY_SERVICE_URL || '').trim();

  if (!merchantAccount || !merchantDomainName || !merchantSecretKey || !returnUrl || !serviceUrl) {
    throw new Error('WAYFORPAY env config is incomplete');
  }

  return { merchantAccount, merchantDomainName, merchantSecretKey, merchantPassword, returnUrl, serviceUrl };
}

function signHmacMd5(source, secret) {
  return crypto.createHmac('md5', secret).update(source, 'utf8').digest('hex');
}

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function productLabel(kind) {
  if (kind === 'mak-cards') return 'MAK cards access';
  if (kind === 'medium') return 'Tariff Medium';
  if (kind === 'section') return 'Method section access';
  return 'Tariff Premium';
}

function returnKind(kind) {
  if (kind === 'mak-cards') return 'mak';
  return kind;
}

function withReturnParams(baseUrl, kind, extraParams) {
  const separator = baseUrl.includes('?') ? '&' : '?';
  let url = `${baseUrl}${separator}kind=${encodeURIComponent(returnKind(kind))}`;
  if (extraParams?.category) url += `&category=${encodeURIComponent(extraParams.category)}`;
  if (extraParams?.methodic) url += `&methodic=${encodeURIComponent(extraParams.methodic)}`;
  return url;
}

function buildOrderReference(kind, userId, methodSectionId) {
  const random = Math.random().toString(36).slice(2, 8);
  if (kind === 'section') return `RKM|section|${userId}|${methodSectionId || 0}|${Date.now()}|${random}`;
  return `RKM|${kind}|${userId}|${Date.now()}|${random}`;
}

export function parseOrderReference(orderReference) {
  if (orderReference.startsWith('wp_')) {
    const mUser = orderReference.match(/^wp_(\d+)_/);
    const userId = mUser ? Number(mUser[1]) : NaN;
    if (!Number.isFinite(userId) || userId <= 0) return null;
    if (orderReference.includes('_tariff_medium_')) return { kind: 'medium', userId };
    if (orderReference.includes('_tariff_premium_')) return { kind: 'premium', userId };
    if (orderReference.includes('_mak_cards_') || orderReference.includes('_mak-cards_') || orderReference.includes('_mak_')) {
      return { kind: 'mak-cards', userId };
    }
    return null;
  }

  const parts = orderReference.split('|');
  if (parts[0] !== 'RKM') return null;
  const maybeKind = parts[1];
  const userId = Number(parts[2]);
  if (!Number.isFinite(userId) || userId <= 0) return null;
  if (!['mak-cards', 'medium', 'premium', 'section'].includes(maybeKind)) return null;

  if (maybeKind === 'section') {
    if (parts.length < 6) return null;
    const methodSectionId = Number(parts[3]);
    if (!Number.isFinite(methodSectionId) || methodSectionId <= 0) return null;
    return { kind: maybeKind, userId, methodSectionId };
  }

  if (parts.length < 5) return null;
  return { kind: maybeKind, userId };
}

export function verifyWayForPayCallbackSignature(payload) {
  const { merchantSecretKey, merchantPassword, merchantDomainName } = requirePaymentConfig();
  const provided = String(payload.merchantSignature ?? '').trim().toLowerCase();
  if (!provided) return false;
  const keysToTry = [merchantSecretKey, merchantPassword].filter((k) => k.length > 0);

  const merchantAccount = String(payload.merchantAccount ?? '');
  const orderReference = String(payload.orderReference ?? '');
  const amountRaw = payload.amount;
  const currency = String(payload.currency ?? '');
  const authCode = String(payload.authCode ?? '');
  const cardPan = String(payload.cardPan ?? '');
  const transactionStatus = String(payload.transactionStatus ?? '');
  const reasonCodeRaw = payload.reasonCode;

  const amountVariants = new Set([String(amountRaw ?? '')]);
  const amountAsNumber = Number(amountRaw);
  if (Number.isFinite(amountAsNumber)) {
    amountVariants.add(amountAsNumber.toString());
    amountVariants.add(amountAsNumber.toFixed(2));
  }

  const reasonCodeVariants = new Set([String(reasonCodeRaw ?? '')]);
  const reasonAsNumber = Number(reasonCodeRaw);
  if (Number.isFinite(reasonAsNumber)) reasonCodeVariants.add(reasonAsNumber.toString());

  const makeExpected = (parts, key) => signHmacMd5(parts.join(';'), key).toLowerCase();
  const authCodeVariants = [String(payload.authCode ?? ''), ''];
  const cardPanVariants = [String(payload.cardPan ?? ''), ''];
  const txStatusVariants = [String(payload.transactionStatus ?? ''), ''];
  const parsedRef = parseOrderReference(orderReference);
  const refParts = orderReference.split('|');
  const refTimestampMsRaw = refParts.find((p) => /^\d{12,}$/.test(p)) || '';
  const refTimestampSec = refTimestampMsRaw ? Math.floor(Number(refTimestampMsRaw) / 1000) : NaN;

  for (const key of keysToTry) {
    for (const amount of amountVariants) {
      for (const reasonCode of reasonCodeVariants) {
        const expectedShort = makeExpected([merchantAccount, orderReference, amount, currency], key);
        if (provided === expectedShort) return true;

        for (const ac of authCodeVariants) {
          const expectedInvoiceWithAuth = makeExpected([merchantAccount, orderReference, amount, currency, ac], key);
          if (provided === expectedInvoiceWithAuth) return true;

          if (parsedRef && Number.isFinite(refTimestampSec) && refTimestampSec > 0) {
            const name = productLabel(parsedRef.kind);
            const expectedCreateInvoice = makeExpected(
              [merchantAccount, merchantDomainName, orderReference, String(refTimestampSec), amount, currency, name, '1', amount],
              key,
            );
            if (provided === expectedCreateInvoice) return true;
          }

          for (const cp of cardPanVariants) {
            for (const tx of txStatusVariants) {
              const expectedFull = makeExpected([merchantAccount, orderReference, amount, currency, ac, cp, tx, reasonCode], key);
              if (provided === expectedFull) return true;
            }
          }
        }
      }
    }
  }
  return false;
}

export function buildWayForPayCallbackAck(orderReference) {
  const { merchantSecretKey } = requirePaymentConfig();
  const time = nowSec();
  const status = 'accept';
  const signature = signHmacMd5(`${orderReference};${status};${time}`, merchantSecretKey);
  return { orderReference, status, time, signature };
}

export async function createAccessPayment(kind, user, options = {}) {
  const config = requirePaymentConfig();
  const { prices, currency } = await loadPricingSettings();
  const amount = prices[kind];
  const orderReference = buildOrderReference(kind, user.id, options.methodSectionId);
  const orderDate = nowSec();
  const name = productLabel(kind);
  const count = 1;

  const signSource = [
    config.merchantAccount,
    config.merchantDomainName,
    orderReference,
    orderDate,
    amount,
    currency,
    name,
    count,
    amount,
  ].join(';');

  const merchantSignature = signHmacMd5(signSource, config.merchantSecretKey);

  const paymentData = {
    transactionType: 'CREATE_INVOICE',
    merchantAccount: config.merchantAccount,
    merchantDomainName: config.merchantDomainName,
    merchantAuthType: 'SimpleSignature',
    merchantSignature,
    apiVersion: 1,
    language: 'UA',
    returnUrl: withReturnParams(config.returnUrl, kind, options.returnParams),
    serviceUrl: config.serviceUrl,
    orderReference,
    orderDate,
    amount,
    currency,
    productName: [name],
    productPrice: [amount],
    productCount: [count],
    clientEmail: user.email || undefined,
    orderTimeout: 3600,
  };

  try {
    const response = await fetch(WFP_PAY_OFFLINE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paymentData),
    });
    if (response.ok) {
      const data = await response.json();
      if (data?.url && typeof data.url === 'string') {
        return { kind, orderReference, amount, currency, paymentUrl: data.url };
      }
    }
  } catch {
    // fallback
  }

  return { kind, orderReference, amount, currency, paymentUrl: WFP_PAY_FALLBACK_URL, paymentData };
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
  for (const section of sections) {
    const existing = await UserMethodSection.findOne({
      where: { userId, methodSectionId: section.id },
      ...txOpts(transaction),
    });
    if (existing) {
      if (!existing.isPaid) await existing.update({ isPaid: true }, txOpts(transaction));
    } else {
      await UserMethodSection.create(
        {
          documentId: uuidv4(),
          userId,
          methodSectionId: section.id,
          isPaid: true,
        },
        txOpts(transaction),
      );
    }
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

export function isSuccessTransactionStatus(status) {
  return status === 'Approved';
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
  if (!isPremium && !isMedium) {
    await revokeAllMethodicsAccess(userId);
    if (makCardsAccess) await applyPaidAccess('mak-cards', userId, { skipUserFlagUpdate: true });
    return;
  }
  if (makCardsAccess) await applyPaidAccess('mak-cards', userId, { skipUserFlagUpdate: true });
}
