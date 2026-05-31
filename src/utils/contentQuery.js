import { Op } from 'sequelize';
import { onlyPublished, parseContentFilters, parsePopulate } from './queryFilters.js';

export { parsePopulate };

export const METHOD_SECTION_BRIEF_ATTRS = ['id', 'documentId', 'slug', 'title', 'subtitle', 'mobtitle'];

export function resolveIdOrDocumentWhere(idOrDocumentId, extra = {}) {
  const base = Number.isFinite(Number(idOrDocumentId))
    ? { id: Number(idOrDocumentId) }
    : { documentId: idOrDocumentId };
  return { ...base, ...extra };
}

export function wantsPopulate(populate, ...fields) {
  return fields.some((field) => populate.includes(field) || populate.includes('*'));
}

export function parsePublishedWhere(query) {
  return onlyPublished(parseContentFilters(query));
}

export function publishedMethodsInclude(Method) {
  return {
    model: Method,
    as: 'methods',
    where: { publishedAt: { [Op.ne]: null } },
    required: false,
  };
}

export function methodSectionBriefInclude(MethodSection) {
  return {
    model: MethodSection,
    as: 'method_section',
    attributes: METHOD_SECTION_BRIEF_ATTRS,
  };
}
