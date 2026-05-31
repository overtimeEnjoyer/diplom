import { getModels } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';

const METHOD_SUMMARY_ATTRS = ['id', 'documentId', 'slug', 'title'];

/** Record material view (thesis: Progress / view history). */
export async function recordView(userId, methodId) {
  if (!Number.isInteger(methodId) || methodId <= 0) {
    throw ApiError.badRequest('Valid methodId is required');
  }
  const { Method, MaterialView } = getModels();
  const method = await Method.findByPk(methodId, { attributes: ['id'] });
  if (!method) throw ApiError.notFound('Method not found');

  const [view] = await MaterialView.findOrCreate({
    where: { userId, methodId },
    defaults: { viewedAt: new Date() },
  });
  await view.update({ viewedAt: new Date() });
  return view;
}

export async function listViewHistory(userId, { limit = 50 } = {}) {
  const { MaterialView, Method } = getModels();
  const rows = await MaterialView.findAll({
    where: { userId },
    include: [{ model: Method, as: 'method', attributes: METHOD_SUMMARY_ATTRS }],
    order: [['viewedAt', 'DESC']],
    limit: Math.min(Number(limit) || 50, 100),
  });

  return rows.map((row) => ({
    viewedAt: row.viewedAt,
    method: row.method,
  }));
}
