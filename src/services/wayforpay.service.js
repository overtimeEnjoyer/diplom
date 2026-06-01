import crypto from 'crypto';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { confirmPayment, parseOrderReference } from './payments.service.js';

function parseCallbackBody(rawBody, contentType) {
  const text = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || '');
  if (!text.trim()) return {};

  if (String(contentType || '').includes('application/json')) {
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  }

  const params = new URLSearchParams(text);
  const out = {};
  for (const [key, value] of params.entries()) {
    out[key] = value;
  }
  return out;
}

/** WayForPay HMAC-MD5 signature (callback fields). */
export function verifyWayForPaySignature(payload, secret) {
  if (!secret || !payload?.merchantSignature) return false;

  const signatureFields = [
    'merchantAccount',
    'merchantDomainName',
    'orderReference',
    'orderDate',
    'amount',
    'currency',
    'authCode',
    'cardPan',
    'transactionStatus',
    'reasonCode',
  ];

  const parts = signatureFields
    .map((key) => {
      const value = payload[key];
      if (Array.isArray(value)) return value.join(';');
      return value != null ? String(value) : '';
    })
    .filter((v) => v !== '');

  const expected = crypto.createHmac('md5', secret).update(parts.join(';'), 'utf8').digest('hex');
  return expected === String(payload.merchantSignature);
}

export function isWayForPayEnabled() {
  return Boolean(env.wayforpayMerchantSecret);
}

export async function handleWayForPayCallback(rawBody, contentType) {
  if (!isWayForPayEnabled()) {
    throw ApiError.internal('WayForPay is not configured');
  }

  const payload = parseCallbackBody(rawBody, contentType);
  if (!verifyWayForPaySignature(payload, env.wayforpayMerchantSecret)) {
    throw ApiError.forbidden('Invalid WayForPay signature');
  }

  const status = String(payload.transactionStatus || '').toLowerCase();
  if (status && status !== 'approved' && status !== 'accept') {
    return { ok: true, ignored: true, transactionStatus: status };
  }

  const orderReference = payload.orderReference;
  if (!parseOrderReference(orderReference)) {
    throw ApiError.badRequest('Unknown orderReference in callback');
  }

  const result = await confirmPayment(orderReference);
  return { ok: true, ...result };
}
