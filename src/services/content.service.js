import { Op } from 'sequelize';
import { getModels } from '../models/index.js';
import { parsePagination, paginationMeta } from '../utils/pagination.js';
import { parseStrapiFilters, onlyPublished, parsePopulate } from '../utils/strapiFilters.js';
import { ApiError } from '../utils/ApiError.js';

function formatMethodSection(row, includeMethods = false) {
  const plain = row.toJSON();
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
  const plain = row.toJSON();
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
  const { MethodSection, Method } = getModels();
  const { page, pageSize, limit, offset } = parsePagination(query);
  const filters = parseStrapiFilters(query);
  const where = onlyPublished(filters);
  const populate = parsePopulate(query);

  const include =
    populate.includes('methods') || populate.includes('*')
      ? [{ model: Method, as: 'methods', where: { publishedAt: { [Op.ne]: null } }, required: false }]
      : [];

  const { rows, count } = await MethodSection.findAndCountAll({
    where,
    include,
    limit,
    offset,
    order: [['id', 'ASC']],
    distinct: true,
  });

  return {
    data: rows.map((r) => formatMethodSection(r, populate.includes('methods') || populate.includes('*'))),
    meta: paginationMeta(page, pageSize, count),
  };
}

export async function getMethodSection(idOrDocumentId, query) {
  const { MethodSection, Method } = getModels();
  const populate = parsePopulate(query);
  const where = Number.isFinite(Number(idOrDocumentId))
    ? { id: Number(idOrDocumentId), ...onlyPublished({}) }
    : { documentId: idOrDocumentId, ...onlyPublished({}) };

  const include =
    populate.includes('methods') || populate.includes('*')
      ? [{ model: Method, as: 'methods', where: { publishedAt: { [Op.ne]: null } }, required: false }]
      : [];

  const row = await MethodSection.findOne({ where, include });
  if (!row) throw ApiError.notFound('Method section not found');
  return {
    data: formatMethodSection(row, populate.includes('methods') || populate.includes('*')),
    meta: {},
  };
}

export async function listMethods(query) {
  const { Method, MethodSection } = getModels();
  const { page, pageSize, limit, offset } = parsePagination(query);
  const filters = parseStrapiFilters(query);
  const where = onlyPublished(filters);
  const populate = parsePopulate(query);

  const include = populate.includes('method_section') || populate.includes('*')
    ? [{ model: MethodSection, as: 'method_section' }]
    : [];

  const { rows, count } = await Method.findAndCountAll({
    where,
    include,
    limit,
    offset,
    order: [['id', 'ASC']],
  });

  return { data: rows.map(formatMethod), meta: paginationMeta(page, pageSize, count) };
}

export async function getMethod(idOrDocumentId, query) {
  const { Method, MethodSection } = getModels();
  const populate = parsePopulate(query);
  const where = Number.isFinite(Number(idOrDocumentId))
    ? { id: Number(idOrDocumentId), ...onlyPublished({}) }
    : { documentId: idOrDocumentId, ...onlyPublished({}) };

  const include = populate.includes('method_section') || populate.includes('*')
    ? [{ model: MethodSection, as: 'method_section' }]
    : [];

  const row = await Method.findOne({ where, include });
  if (!row) throw ApiError.notFound('Method not found');
  return { data: formatMethod(row), meta: {} };
}
