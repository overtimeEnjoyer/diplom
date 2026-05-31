import {
  checkAccessStatus,
  confirmMockPayment,
  parseOrderReference,
} from '../services/payments.service.js';
import { ApiError } from '../utils/ApiError.js';
import { sendJson } from '../utils/response.js';

export async function paymentStatus(req, res) {
  const orderReference = String(req.query.orderReference || '');
  if (!orderReference) throw ApiError.badRequest('orderReference is required');

  const parsed = parseOrderReference(orderReference);
  if (!parsed) throw ApiError.badRequest('Unknown orderReference format');

  const paid = await checkAccessStatus(parsed.kind, parsed.userId, parsed.methodSectionId);
  sendJson(res, 200, {
    orderReference,
    kind: parsed.kind,
    userId: parsed.userId,
    methodSectionId: parsed.methodSectionId || null,
    paid,
  });
}

export async function confirmPayment(req, res) {
  const orderReference = String(req.body.orderReference || '');
  if (!orderReference) throw ApiError.badRequest('orderReference is required');
  sendJson(res, 200, await confirmMockPayment(orderReference, { userId: req.user.id }));
}
