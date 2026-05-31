import * as progressService from '../services/progress.service.js';
import { sendData, sendJson } from '../utils/response.js';

export async function recordView(req, res) {
  const methodId = Number(req.params.methodId || req.body.methodId);
  const view = await progressService.recordView(req.user.id, methodId);
  sendJson(res, 200, { ok: true, viewedAt: view.viewedAt });
}

export async function myHistory(req, res) {
  const data = await progressService.listViewHistory(req.user.id, {
    limit: req.query.limit,
  });
  sendData(res, data);
}
