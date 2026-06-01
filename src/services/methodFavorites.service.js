import { Op } from 'sequelize';
import { getModels } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { formatMethod } from './content.service.js';
import { methodSectionBriefInclude } from '../utils/contentQuery.js';

export async function listMethodFavorites(userId) {
  const { MethodFavorite, Method, MethodSection } = getModels();
  const favorites = await MethodFavorite.findAll({
    where: { userId },
    order: [['createdAt', 'DESC']],
  });
  const ids = favorites.map((f) => f.methodId);
  if (!ids.length) return { favoriteMethodIds: [], methods: [] };

  const methods = await Method.findAll({
    where: { id: ids, publishedAt: { [Op.ne]: null } },
    include: [methodSectionBriefInclude(MethodSection)],
  });

  return {
    favoriteMethodIds: ids,
    methods: methods.map(formatMethod),
  };
}

export async function addMethodFavorite(userId, methodId) {
  const { MethodFavorite, Method } = getModels();
  const method = await Method.findByPk(methodId, { attributes: ['id', 'publishedAt'] });
  if (!method?.publishedAt) throw ApiError.notFound('Method not found');

  await MethodFavorite.findOrCreate({
    where: { userId, methodId },
    defaults: { userId, methodId },
  });
  return listMethodFavorites(userId);
}

export async function removeMethodFavorite(userId, methodId) {
  const { MethodFavorite } = getModels();
  await MethodFavorite.destroy({ where: { userId, methodId } });
  return listMethodFavorites(userId);
}

export async function toggleMethodFavorite(userId, methodId) {
  const { MethodFavorite } = getModels();
  const existing = await MethodFavorite.findOne({ where: { userId, methodId } });
  if (existing) return removeMethodFavorite(userId, methodId);
  return addMethodFavorite(userId, methodId);
}

export async function setMethodFavorites(userId, methodIds) {
  const { MethodFavorite, Method } = getModels();
  if (!Array.isArray(methodIds)) throw ApiError.badRequest('methodIds must be an array');

  const uniqueIds = [...new Set(methodIds.map(Number).filter((id) => id > 0))];
  if (uniqueIds.length) {
    const count = await Method.count({ where: { id: uniqueIds, publishedAt: { [Op.ne]: null } } });
    if (count !== uniqueIds.length) throw ApiError.badRequest('Some methodIds are invalid');
  }

  await MethodFavorite.destroy({ where: { userId } });
  if (uniqueIds.length) {
    await MethodFavorite.bulkCreate(uniqueIds.map((methodId) => ({ userId, methodId })));
  }
  return listMethodFavorites(userId);
}
