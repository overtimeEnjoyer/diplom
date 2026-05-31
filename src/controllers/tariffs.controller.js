import { activateMediumAccess, activatePremiumAccess } from '../services/payments.service.js';
import { sendJson } from '../utils/response.js';

export async function activateMedium(req, res) {
  sendJson(res, 200, await activateMediumAccess(req.user));
}

export async function activatePremium(req, res) {
  sendJson(res, 200, await activatePremiumAccess(req.user));
}
