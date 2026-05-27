import { getModels } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';

/** Record material view (thesis: Progress / view history). */
export async function recordView(userId, methodId) {
  const { Method, MaterialView } = getModels();
  const method = await Method.findByPk(methodId);
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
    include: [{ model: Method, as: 'method', attributes: ['id', 'documentId', 'slug', 'title'] }],
    order: [['viewedAt', 'DESC']],
    limit,
  });
  return rows;
}
