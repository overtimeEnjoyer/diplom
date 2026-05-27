import * as authService from '../services/auth.service.js';
import * as makFavorites from '../services/makFavorites.service.js';
import { createAccessPayment } from '../services/payments.service.js';

export async function register(req, res) {
  const result = await authService.register(req.body);
  res.json(result);
}

export async function loginLocal(req, res) {
  const result = await authService.loginLocal(req.body);
  res.json(result);
}

export async function requestEmailCode(req, res) {
  res.json(await authService.requestEmailCode(req.body.email));
}

export async function verifyEmailCode(req, res) {
  res.json(await authService.verifyEmailCode(req.body));
}

export async function requestPasswordCode(req, res) {
  const result = await authService.requestPasswordCode(req.body.email);
  res.json(result);
}

export async function resetPassword(req, res) {
  const result = await authService.resetPassword(req.body);
  res.json(result);
}

export async function me(req, res) {
  const result = await authService.getMe(req.user.id);
  res.json(result);
}

export async function updateProfile(req, res) {
  const result = await authService.updateProfile(req.user.id, req.body);
  res.json(result);
}

export async function getMakFavorites(req, res) {
  const result = await makFavorites.getMakFavorites(req.user.id);
  res.json(result);
}

export async function setMakFavorites(req, res) {
  const result = await makFavorites.setMakFavorites(req.user.id, req.body.favoriteCardIds);
  res.json(result);
}

export async function toggleMakFavorite(req, res) {
  const result = await makFavorites.toggleMakFavorite(req.user.id, req.body.cardId);
  res.json(result);
}

export async function grantMakCardsAccess(req, res) {
  const payment = await createAccessPayment('mak-cards', {
    id: req.user.id,
    email: req.user.email,
  });
  res.json({ status: 'payment_required', access: 'mak-cards', ...payment });
}
