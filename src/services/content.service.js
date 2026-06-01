import { QueryTypes } from 'sequelize';
import { getModels } from '../models/index.js';
import { getCatalogSequelize } from '../config/database.js';
import { env } from '../config/env.js';
import { cacheGet, cacheSet, cacheKey } from '../utils/cache.js';
import { parsePagination, paginationMeta } from '../utils/pagination.js';
import {
  methodSectionBriefInclude,
  parsePopulate,
  parsePublishedWhere,
  publishedMethodsInclude,
  resolveIdOrDocumentWhere,
  wantsPopulate,
} from '../utils/contentQuery.js';
import { onlyPublished } from '../utils/queryFilters.js';
import { ApiError } from '../utils/ApiError.js';

function toPlain(row) {
  return row && typeof row.toJSON === 'function' ? row.toJSON() : row;
}

function formatMethodSection(row, includeMethods = false) {
  const plain = toPlain(row);
  const out = {
    id: plain.id,
    documentId: plain.documentId,
    slug: plain.slug,
    title: plain.title,
    subtitle: plain.subtitle,
    mobtitle: plain.mobtitle,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
    publishedAt: plain.publishedAt,
    locale: plain.locale,
  };
  if (includeMethods && plain.methods) {
    out.methods = plain.methods.map(formatMethod);
  }
  return out;
}

function formatMethod(row) {
  const plain = toPlain(row);
  return {
    id: plain.id,
    documentId: plain.documentId,
    title: plain.title,
    slug: plain.slug,
    author_source: plain.authorSource,
    approach: plain.approach,
    target_audience: plain.targetAudience,
    goal: plain.goal,
    purpose: plain.purpose,
    therapeutic_effect: plain.therapeuticEffect,
    time: plain.time,
    materials: plain.materials,
    short_instruction: plain.shortInstruction,
    instruction: plain.instruction,
    interpretation: plain.interpretation,
    completion: plain.completion,
    reflection_questions: plain.reflectionQuestions,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
    publishedAt: plain.publishedAt,
    locale: plain.locale,
    method_section: plain.method_section
      ? {
          id: plain.method_section.id,
          documentId: plain.method_section.documentId,
          slug: plain.method_section.slug,
          title: plain.method_section.title,
        }
      : undefined,
  };
}

export async function listMethodSections(query) {
  const cacheId = cacheKey('method-sections', query);
  const cached = cacheGet(cacheId);
  if (cached) return cached;

  const { MethodSection, Method } = getModels();
  const { page, pageSize, limit, offset } = parsePagination(query);
  const where = parsePublishedWhere(query);
  const populate = parsePopulate(query);
  const withMethods = wantsPopulate(populate, 'methods');

  const include = withMethods ? [publishedMethodsInclude(Method)] : [];

  const { rows, count } = await MethodSection.findAndCountAll({
    where,
    include,
    limit,
    offset,
    order: [['id', 'ASC']],
    distinct: true,
  });

  const result = {
    data: rows.map((r) => formatMethodSection(r, withMethods)),
    meta: paginationMeta(page, pageSize, count),
  };
  cacheSet(cacheId, result, env.contentCacheTtlMs);
  return result;
}

export async function searchMethods(query) {
  const q = String(query.q || query.search || '').trim();
  if (!q) throw ApiError.badRequest('Query parameter q or search is required');

  const { Method, MethodSection } = getModels();
  const sequelize = getCatalogSequelize();
  const { page, pageSize, limit, offset } = parsePagination(query);

  const rows = await sequelize.query(
    `
    SELECT m.id
    FROM methods m
    WHERE m.published_at IS NOT NULL
      AND to_tsvector(
        'simple',
        coalesce(m.title, '') || ' ' ||
        coalesce(m.approach, '') || ' ' ||
        coalesce(m.target_audience, '') || ' ' ||
        coalesce(m.short_instruction::text, '')
      ) @@ plainto_tsquery('simple', :q)
    ORDER BY m.id ASC
    LIMIT :limit OFFSET :offset
    `,
    {
      replacements: { q, limit, offset },
      type: QueryTypes.SELECT,
    },
  );

  const ids = rows.map((r) => r.id);
  if (!ids.length) {
    return { data: [], meta: paginationMeta(page, pageSize, 0) };
  }

  const methods = await Method.findAll({
    where: { id: ids },
    include: [methodSectionBriefInclude(MethodSection)],
    order: [['id', 'ASC']],
  });

  return {
    data: methods.map(formatMethod),
    meta: paginationMeta(page, pageSize, ids.length),
  };
}

export async function getMethodSection(idOrDocumentId, query) {
  const { MethodSection, Method } = getModels();
  const populate = parsePopulate(query);
  const withMethods = wantsPopulate(populate, 'methods');
  const where = resolveIdOrDocumentWhere(idOrDocumentId, onlyPublished({}));
  const include = withMethods ? [publishedMethodsInclude(Method)] : [];

  const row = await MethodSection.findOne({ where, include });
  if (!row) throw ApiError.notFound('Method section not found');
  return { data: formatMethodSection(row, withMethods), meta: {} };
}

export async function listMethods(query) {
  const { Method, MethodSection } = getModels();
  const { page, pageSize, limit, offset } = parsePagination(query);
  const where = parsePublishedWhere(query);
  const populate = parsePopulate(query);
  const withSection = wantsPopulate(populate, 'method_section');

  const include = withSection ? [methodSectionBriefInclude(MethodSection)] : [];

  const { rows, count } = await Method.findAndCountAll({
    where,
    include,
    limit,
    offset,
    order: [['id', 'ASC']],
    distinct: withSection,
  });

  return { data: rows.map(formatMethod), meta: paginationMeta(page, pageSize, count) };
}

export async function getMethod(idOrDocumentId, query) {
  const { Method, MethodSection } = getModels();
  const populate = parsePopulate(query);
  const withSection = wantsPopulate(populate, 'method_section');
  const where = resolveIdOrDocumentWhere(idOrDocumentId, onlyPublished({}));
  const include = withSection ? [methodSectionBriefInclude(MethodSection)] : [];

  const row = await Method.findOne({ where, include });
  if (!row) throw ApiError.notFound('Method not found');
  return { data: formatMethod(row), meta: {} };
}

export { formatMethod, formatMethodSection };
