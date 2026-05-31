import * as authService from '../services/auth.service.js';
import { sendJson } from '../utils/response.js';

export async function register(req, res) {
  sendJson(res, 200, await authService.register(req.body));
}

export async function loginLocal(req, res) {
  sendJson(res, 200, await authService.loginLocal(req.body));
}

export async function requestEmailCode(req, res) {
  sendJson(res, 200, await authService.requestEmailCode(req.body.email));
}

export async function verifyEmailCode(req, res) {
  sendJson(res, 200, await authService.verifyEmailCode(req.body));
}

export async function requestPasswordCode(req, res) {
  sendJson(res, 200, await authService.requestPasswordCode(req.body.email));
}

export async function resetPassword(req, res) {
  sendJson(res, 200, await authService.resetPassword(req.body));
}

export async function me(req, res) {
  sendJson(res, 200, await authService.getMe(req.user.id));
}

export async function updateProfile(req, res) {
  sendJson(res, 200, await authService.updateProfile(req.user.id, req.body));
}
