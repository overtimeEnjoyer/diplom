import {
  applyPaidAccess,
  applyPaidSectionAccess,
  buildWayForPayCallbackAck,
  checkAccessStatus,
  expectedCurrency,
  expectedPrice,
  isSuccessTransactionStatus,
  parseOrderReference,
  verifyWayForPayCallbackSignature,
} from '../services/payments.service.js';
import { mergeCallbackPayload } from '../utils/wayforpayPayload.js';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';

export async function wayforpayCallback(req, res) {
  const payload = mergeCallbackPayload(req);
  const orderReference = String(payload.orderReference || '');
  const transactionStatus = String(payload.transactionStatus || '');
  const reason = String(payload.reason || '');
  const reasonCodeRaw = payload.reasonCode;
  const reasonCode =
    reasonCodeRaw === '' || reasonCodeRaw === null || reasonCodeRaw === undefined ? NaN : Number(reasonCodeRaw);
  const authCode = String(payload.authCode || '');
  const derivedStatus =
    transactionStatus ||
    (Number.isFinite(reasonCode) && reasonCode === 1100 ? 'Approved' : '') ||
    (String(payload.reason || '') === '1100' ? 'Approved' : '') ||
    (authCode ? 'Approved' : '');

  if (!orderReference) throw ApiError.badRequest('orderReference is required');

  const signatureValid = verifyWayForPayCallbackSignature(payload);
  if (!signatureValid && env.isProduction) {
    throw ApiError.badRequest('Invalid merchantSignature');
  }

  const parsed = parseOrderReference(orderReference);
  if (!parsed) throw ApiError.badRequest('Unknown orderReference format');

  const expectedCurr = await expectedCurrency();
  if (String(payload.currency || '') !== expectedCurr) {
    throw ApiError.badRequest('Unexpected currency');
  }
  const expectedAmt = await expectedPrice(parsed.kind);
  if (Number(payload.amount) !== expectedAmt) {
    throw ApiError.badRequest('Unexpected amount');
  }

  if (isSuccessTransactionStatus(derivedStatus)) {
    if (parsed.kind === 'section' && parsed.methodSectionId) {
      await applyPaidSectionAccess(parsed.userId, parsed.methodSectionId);
    } else {
      await applyPaidAccess(parsed.kind, parsed.userId);
    }
  }

  res.set('Content-Type', 'application/json; charset=utf-8');
  res.json(buildWayForPayCallbackAck(orderReference));
}

export async function paymentStatus(req, res) {
  const orderReference = String(req.query.orderReference || '');
  if (!orderReference) throw ApiError.badRequest('orderReference is required');

  const parsed = parseOrderReference(orderReference);
  if (!parsed) throw ApiError.badRequest('Unknown orderReference format');

  const paid = await checkAccessStatus(parsed.kind, parsed.userId, parsed.methodSectionId);
  res.json({
    orderReference,
    kind: parsed.kind,
    userId: parsed.userId,
    methodSectionId: parsed.methodSectionId || null,
    paid,
  });
}
