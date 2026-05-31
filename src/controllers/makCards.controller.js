import * as makFavorites from '../services/makFavorites.service.js';
import { startMakCardsAccess } from '../services/payments.service.js';
import { sendJson } from '../utils/response.js';

export async function getFavorites(req, res) {
  sendJson(res, 200, await makFavorites.getMakFavorites(req.user.id));
}

export async function setFavorites(req, res) {
  sendJson(res, 200, await makFavorites.setMakFavorites(req.user.id, req.body.favoriteCardIds));
}

export async function toggleFavorite(req, res) {
  sendJson(res, 200, await makFavorites.toggleMakFavorite(req.user.id, req.body.cardId));
}

export async function requestAccess(req, res) {
  sendJson(res, 200, await startMakCardsAccess(req.user));
}
