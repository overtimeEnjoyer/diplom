import * as userMethodSectionService from '../services/userMethodSection.service.js';
import { createAccessPayment } from '../services/payments.service.js';

export async function assign(req, res) {
  const result = await userMethodSectionService.assignSection(req.user, req.body);
  res.json(result);
}

export async function mySections(req, res) {
  const result = await userMethodSectionService.getMySections(req.user.id);
  res.json(result);
}

export async function activateMedium(req, res) {
  const payment = await createAccessPayment('medium', { id: req.user.id, email: req.user.email });
  res.json({ status: 'payment_required', access: 'medium', ...payment });
}

export async function activatePremium(req, res) {
  const payment = await createAccessPayment('premium', { id: req.user.id, email: req.user.email });
  res.json({ status: 'payment_required', access: 'premium', ...payment });
}
