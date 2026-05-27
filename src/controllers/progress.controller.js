import * as progressService from '../services/progress.service.js';

export async function recordView(req, res) {
  const methodId = Number(req.params.methodId || req.body.methodId);
  const view = await progressService.recordView(req.user.id, methodId);
  res.json({ ok: true, viewedAt: view.viewedAt });
}

export async function myHistory(req, res) {
  const rows = await progressService.listViewHistory(req.user.id);
  res.json({
    data: rows.map((r) => ({
      viewedAt: r.viewedAt,
      method: r.method,
    })),
  });
}
