import { getModels } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { checkAccessStatus } from './payments.service.js';

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

  const hasSection = await checkAccessStatus('section', user.id, sectionId);
  if (hasSection) return;

  throw ApiError.forbidden('Insufficient access level for this method');
}

export async function getMethodBySlug(slug, user) {
  const { Method, MethodSection } = getModels();
  const method = await Method.findOne({
    where: { slug },
    include: [{ model: MethodSection, as: 'method_section', required: false }],
  });
  if (!method) throw ApiError.notFound('Method not found');
  if (!method.publishedAt) throw ApiError.notFound('Method not found');

  await assertMethodContentAccess(user, method);
  return method;
}
