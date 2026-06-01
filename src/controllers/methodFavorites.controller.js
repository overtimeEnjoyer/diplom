import * as methodFavorites from '../services/methodFavorites.service.js';
import { sendJson } from '../utils/response.js';

export async function listFavorites(req, res) {
  sendJson(res, 200, await methodFavorites.listMethodFavorites(req.user.id));
}

export async function setFavorites(req, res) {
  sendJson(res, 200, await methodFavorites.setMethodFavorites(req.user.id, req.body.methodIds));
}

export async function addFavorite(req, res) {
  const methodId = Number(req.body.methodId);
  sendJson(res, 200, await methodFavorites.addMethodFavorite(req.user.id, methodId));
}

export async function toggleFavorite(req, res) {
  const methodId = Number(req.body.methodId);
  sendJson(res, 200, await methodFavorites.toggleMethodFavorite(req.user.id, methodId));
}
