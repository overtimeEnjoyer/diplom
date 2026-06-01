import { Op } from 'sequelize';
import { getModels } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { catalogQueryOptions } from '../utils/catalogDb.js';
import { methodSectionBriefInclude } from '../utils/contentQuery.js';

/**
 * Premium / medium / paid section grants access to method content (thesis §2.5).
 */
export async function assertMethodContentAccess(user, method) {
  if (!method) throw ApiError.notFound('Method not found');

  if (!user) {
    throw ApiError.forbidden('Authentication required to access this method');
  }

  if (user.isPremium || user.isMedium) return;

  const sectionId = method.methodSectionId || method.method_section_id;
  if (!sectionId) return;

  const { UserMethodSection } = getModels();
  const grant = await UserMethodSection.findOne({
    where: { userId: user.id, methodSectionId: sectionId },
    attributes: ['id'],
    ...catalogQueryOptions(),
  });
  if (!grant) {
    throw ApiError.forbidden('Insufficient access level for this method');
  }
}

/**
 * Load method and verify access with parallel I/O (thesis §3.4 Promise.all).
 */
export async function getMethodBySlug(slug, user) {
  const { Method, MethodSection, UserMethodSection } = getModels();
  const readOpts = catalogQueryOptions();
  const include = [{ model: MethodSection, as: 'method_section', required: false }];

  const methodPromise = Method.findOne({
    where: { slug },
    include,
    ...readOpts,
  });

  if (!user) {
    const method = await methodPromise;
    if (!method?.publishedAt) throw ApiError.notFound('Method not found');
    throw ApiError.forbidden('Authentication required to access this method');
  }

  if (user.isPremium || user.isMedium) {
    const method = await methodPromise;
    if (!method?.publishedAt) throw ApiError.notFound('Method not found');
    return method;
  }

  const [method, grants] = await Promise.all([
    methodPromise,
    UserMethodSection.findAll({
      where: { userId: user.id },
      attributes: ['methodSectionId'],
      ...readOpts,
    }),
  ]);

  if (!method?.publishedAt) throw ApiError.notFound('Method not found');

  const sectionId = method.methodSectionId;
  if (sectionId) {
    const hasGrant = grants.some((g) => g.methodSectionId === sectionId);
    if (!hasGrant) {
      throw ApiError.forbidden('Insufficient access level for this method');
    }
  }

  return method;
}
