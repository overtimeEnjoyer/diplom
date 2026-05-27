import { Op } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { getModels } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { formatPricingForApi } from './pricing.service.js';
import { syncUserTariffFromAdmin } from './payments.service.js';

export async function listFeedbacks({ processed, limit = 100 } = {}) {
  const { Feedback } = getModels();
  const where = {};
  if (processed === 'true') where.isProcessed = true;
  if (processed === 'false') where.isProcessed = false;

  const rows = await Feedback.findAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: Math.min(Number(limit) || 100, 500),
  });
  return rows;
}

export async function markFeedbackProcessed(id) {
  const { Feedback } = getModels();
  const row = await Feedback.findByPk(id);
  if (!row) throw ApiError.notFound('Feedback not found');
  await row.update({ isProcessed: true });
  return row;
}

export async function getPricing() {
  const { Pricing } = getModels();
  const row = await Pricing.findOne({ order: [['id', 'ASC']] });
  if (!row) throw ApiError.notFound('Pricing not configured');
  return formatPricingForApi(row);
}

export async function updatePricing(data) {
  const { Pricing } = getModels();
  const row = await Pricing.findOne();
  if (!row) throw ApiError.notFound('Pricing not configured');
  const allowed = ['makCardsPrice', 'mediumPrice', 'premiumPrice', 'sectionPrice', 'currency'];
  const patch = {};
  for (const key of allowed) {
    if (data[key] !== undefined) patch[key] = data[key];
  }
  await row.update(patch);
  await row.reload();
  return formatPricingForApi(row);
}

export async function listUsers({ search, limit = 50 } = {}) {
  const { User, Role } = getModels();
  const where = {};
  if (search) {
    const q = `%${search}%`;
    where[Op.or] = [{ email: { [Op.iLike]: q } }, { username: { [Op.iLike]: q } }];
  }
  const rows = await User.findAll({
    where,
    include: [{ model: Role, as: 'role', attributes: ['id', 'name', 'type'] }],
    order: [['id', 'DESC']],
    limit: Math.min(Number(limit) || 50, 200),
  });
  return rows;
}

export async function updateUserTariff(userId, body) {
  const { User } = getModels();
  const user = await User.unscoped().findByPk(userId);
  if (!user) throw ApiError.notFound('User not found');

  const isPremium = body.isPremium ?? user.isPremium;
  const isMedium = body.isMedium ?? user.isMedium;
  const makCardsAccess = body.makCardsAccess ?? user.makCardsAccess;

  await user.update({ isPremium, isMedium, makCardsAccess });
  await syncUserTariffFromAdmin(user.id, { isPremium, isMedium, makCardsAccess });
  return user;
}

export async function listMethodSectionsAdmin({ includeUnpublished = true, limit = 100 } = {}) {
  const { MethodSection } = getModels();
  const where = includeUnpublished ? {} : { publishedAt: { [Op.ne]: null } };
  return MethodSection.findAll({
    where,
    order: [['id', 'ASC']],
    limit: Math.min(Number(limit) || 100, 500),
  });
}

export async function updateMethodSection(id, data) {
  const { MethodSection } = getModels();
  const row = await findSectionByIdOrSlug(id);
  const allowed = ['slug', 'title', 'subtitle', 'mobtitle', 'publishedAt', 'locale'];
  const patch = pickAllowed(data, allowed);
  if (patch.publishedAt === null) patch.publishedAt = null;
  await row.update(patch);
  return row;
}

export async function createMethodSection(data) {
  const { MethodSection } = getModels();
  return MethodSection.create({
    documentId: uuidv4(),
    slug: data.slug,
    title: data.title,
    subtitle: data.subtitle,
    mobtitle: data.mobtitle,
    locale: data.locale,
    publishedAt: data.publishedAt ?? new Date(),
  });
}

export async function listMethodsAdmin({ sectionId, limit = 100 } = {}) {
  const { Method, MethodSection } = getModels();
  const where = {};
  if (sectionId) where.methodSectionId = sectionId;
  return Method.findAll({
    where,
    include: [{ model: MethodSection, as: 'method_section', attributes: ['id', 'slug', 'title'] }],
    order: [['id', 'ASC']],
    limit: Math.min(Number(limit) || 100, 500),
  });
}

export async function updateMethod(id, data) {
  const { Method } = getModels();
  const row = await findMethodByIdOrSlug(id);
  const allowed = [
    'methodSectionId',
    'title',
    'slug',
    'authorSource',
    'approach',
    'targetAudience',
    'goal',
    'purpose',
    'therapeuticEffect',
    'time',
    'materials',
    'shortInstruction',
    'instruction',
    'interpretation',
    'completion',
    'reflectionQuestions',
    'publishedAt',
    'locale',
  ];
  await row.update(pickAllowed(data, allowed));
  return row;
}

export async function createMethod(data) {
  const { Method } = getModels();
  return Method.create({
    documentId: uuidv4(),
    methodSectionId: data.methodSectionId,
    title: data.title,
    slug: data.slug,
    authorSource: data.authorSource,
    approach: data.approach,
    targetAudience: data.targetAudience,
    goal: data.goal,
    purpose: data.purpose,
    therapeuticEffect: data.therapeuticEffect,
    time: data.time,
    materials: data.materials,
    shortInstruction: data.shortInstruction,
    instruction: data.instruction,
    interpretation: data.interpretation,
    completion: data.completion,
    reflectionQuestions: data.reflectionQuestions,
    publishedAt: data.publishedAt ?? new Date(),
    locale: data.locale,
  });
}

async function findSectionByIdOrSlug(id) {
  const { MethodSection } = getModels();
  const where = Number.isFinite(Number(id)) ? { id: Number(id) } : { slug: id };
  const row = await MethodSection.findOne({ where });
  if (!row) throw ApiError.notFound('Method section not found');
  return row;
}

async function findMethodByIdOrSlug(id) {
  const { Method } = getModels();
  const where = Number.isFinite(Number(id)) ? { id: Number(id) } : { slug: id };
  const row = await Method.findOne({ where });
  if (!row) throw ApiError.notFound('Method not found');
  return row;
}

function pickAllowed(data, keys) {
  const out = {};
  for (const key of keys) {
    if (data[key] !== undefined) out[key] = data[key];
  }
  return out;
}
