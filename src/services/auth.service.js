import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { getModels } from '../models/index.js';
import { normalizeFavoriteCardIds } from './makFavorites.service.js';

const CODE_TTL_MS = 10 * 60 * 1000;
const SENDGRID_TEMPLATE_PASSWORD_RESET = 'd-f428088d3f7743fe88ff7c3521e0e782';

function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getBrevoPasswordResetTemplateId() {
  const raw = String(process.env.BREVO_TEMPLATE_PASSWORD_RESET || '').trim();
  if (!raw) return null;
  const templateId = Number(raw);
  return Number.isFinite(templateId) && templateId > 0 ? templateId : null;
}

async function sendPasswordResetEmail(to, code) {
  const brevoApiKey = String(process.env.BREVO_API_KEY || '').trim();
  const brevoTemplateId = getBrevoPasswordResetTemplateId();

  if (brevoApiKey && brevoTemplateId) {
    const fromEmail = String(process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_FROM || 'no-reply@example.com').trim();
    const fromName = String(process.env.BREVO_SENDER_NAME || 'ROK Mental Health').trim();
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'api-key': brevoApiKey },
      body: JSON.stringify({
        sender: { email: fromEmail, name: fromName },
        to: [{ email: to }],
        templateId: brevoTemplateId,
        params: { code },
      }),
    });
    if (!response.ok) {
      const errorBody = (await response.text()).slice(0, 500);
      throw new Error(`Brevo API error ${response.status}: ${errorBody}`);
    }
    return;
  }

  const sendgridKey = process.env.SENDGRID_API_KEY;
  if (sendgridKey) {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sendgridKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }], dynamic_template_data: { code } }],
        from: { email: process.env.EMAIL_FROM || 'no-reply@example.com' },
        template_id: SENDGRID_TEMPLATE_PASSWORD_RESET,
      }),
    });
    if (!response.ok) throw new Error(`SendGrid error ${response.status}`);
    return;
  }

  console.warn('[auth] No email provider configured for password reset');
}

export function issueJwt(userId) {
  return jwt.sign({ id: userId }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

export function verifyJwt(token) {
  return jwt.verify(token, env.jwtSecret);
}

export async function register({ email, username, password }) {
  const { User, Role } = getModels();
  if (!email || !username || !password) throw ApiError.badRequest('Email, username and password are required');
  if (username.length < 3) throw ApiError.badRequest('Username must be at least 3 characters');
  if (password.length < 6) throw ApiError.badRequest('Password must be at least 6 characters');

  const existing = await User.unscoped().findOne({
    where: { [Op.or]: [{ email: email.toLowerCase() }, { username }] },
  });
  if (existing) throw ApiError.badRequest('User with this email or username already exists');

  const role = await Role.findOne({ where: { type: 'authenticated' } });
  if (!role) throw ApiError.internal('Default role not found');

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await User.create({
    documentId: uuidv4(),
    username,
    email: String(email).toLowerCase(),
    password: hashedPassword,
    provider: 'local',
    confirmed: true,
    blocked: false,
    makFavoriteCardIds: null,
    roleId: role.id,
  });

  return { jwt: issueJwt(user.id), user: sanitizeUser(user) };
}

export async function loginLocal({ identifier, password }) {
  const { User } = getModels();
  if (!identifier || !password) throw ApiError.badRequest('Identifier and password are required');

  const user = await User.unscoped().findOne({
    where: { [Op.or]: [{ email: identifier.toLowerCase() }, { username: identifier }] },
  });
  if (!user || user.blocked) throw ApiError.badRequest('Invalid identifier or password');
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw ApiError.badRequest('Invalid identifier or password');

  return { jwt: issueJwt(user.id), user: sanitizeUser(user) };
}

export async function requestEmailCode(email) {
  const { User } = getModels();
  if (!email) throw ApiError.badRequest('Email is required');
  const user = await User.unscoped().findOne({ where: { email: email.toLowerCase() } });
  if (!user) return { ok: true };

  const code = generateCode();
  await user.update({
    emailConfirmationCode: hashCode(code),
    emailConfirmationExpires: new Date(Date.now() + CODE_TTL_MS),
  });
  console.info(`[auth] email confirmation code for ${email} (dev log)`);
  return { ok: true };
}

export async function verifyEmailCode({ email, code }) {
  const { User } = getModels();
  if (!email || !code) throw ApiError.badRequest('Email and code are required');
  const user = await User.unscoped().findOne({ where: { email: email.toLowerCase() } });
  if (!user || !user.emailConfirmationCode || !user.emailConfirmationExpires) {
    throw ApiError.badRequest('Invalid email or code');
  }
  if (user.emailConfirmationExpires < new Date()) throw ApiError.badRequest('Code expired');
  if (hashCode(code) !== user.emailConfirmationCode) throw ApiError.badRequest('Invalid code');

  await user.update({
    confirmed: true,
    emailConfirmationCode: null,
    emailConfirmationExpires: null,
  });
  return { jwt: issueJwt(user.id), user: sanitizeUser(user) };
}

export async function requestPasswordCode(email) {
  const { User } = getModels();
  if (!email) throw ApiError.badRequest('Email is required');
  const user = await User.unscoped().findOne({ where: { email: email.toLowerCase() } });
  if (!user) return { ok: true };

  const code = generateCode();
  await user.update({
    passwordResetCode: hashCode(code),
    passwordResetExpires: new Date(Date.now() + CODE_TTL_MS),
  });

  try {
    await sendPasswordResetEmail(email, code);
  } catch (err) {
    console.error('[auth] password reset email failed', err.message);
  }
  return { ok: true };
}

export async function resetPassword({ email, code, password }) {
  const { User } = getModels();
  if (!email || !code || !password) throw ApiError.badRequest('Email, code and password are required');
  if (password.length < 6) throw ApiError.badRequest('Password must be at least 6 characters');

  const user = await User.unscoped().findOne({ where: { email: email.toLowerCase() } });
  if (!user || !user.passwordResetCode || !user.passwordResetExpires) {
    throw ApiError.badRequest('Invalid email or code');
  }
  if (user.passwordResetExpires < new Date()) throw ApiError.badRequest('Code expired');
  if (hashCode(code) !== user.passwordResetCode) throw ApiError.badRequest('Invalid code');

  await user.update({
    password: await bcrypt.hash(password, 10),
    passwordResetCode: null,
    passwordResetExpires: null,
  });
  return { ok: true, message: 'Password has been reset' };
}

export async function getMe(userId) {
  const { User, Role, UserMethodSection, MethodSection } = getModels();
  const user = await User.findByPk(userId, { include: [{ model: Role, as: 'role' }] });
  if (!user) throw ApiError.notFound();

  const methodSections = await UserMethodSection.findAll({
    where: { userId },
    include: [{ model: MethodSection, as: 'method_section', attributes: ['id', 'documentId', 'slug', 'title', 'subtitle', 'mobtitle'] }],
  });

  return formatMeResponse(user, methodSections);
}

export async function updateProfile(userId, { username, email, password }) {
  const { User } = getModels();
  const user = await User.unscoped().findByPk(userId);
  if (!user) throw ApiError.notFound();

  const updateData = {};
  if (username !== undefined) {
    if (typeof username !== 'string' || username.length < 3) throw ApiError.badRequest('Username must be at least 3 characters');
    const existing = await User.unscoped().findOne({ where: { username } });
    if (existing && existing.id !== userId) throw ApiError.badRequest('Username already taken');
    updateData.username = username;
  }
  if (email !== undefined) {
    if (typeof email !== 'string' || email.length < 6) throw ApiError.badRequest('Invalid email');
    const normalized = email.toLowerCase();
    const existing = await User.unscoped().findOne({ where: { email: normalized } });
    if (existing && existing.id !== userId) throw ApiError.badRequest('Email already taken');
    updateData.email = normalized;
  }
  if (password !== undefined && password) {
    if (typeof password !== 'string' || password.length < 6) throw ApiError.badRequest('Password must be at least 6 characters');
    updateData.password = await bcrypt.hash(password, 10);
  }
  if (Object.keys(updateData).length === 0) {
    throw ApiError.badRequest('Provide at least one of: username, email, password');
  }

  await user.update(updateData);
  const updated = await User.findByPk(userId);
  return sanitizeUser(updated);
}

function sanitizeUser(user) {
  const plain = user.toJSON();
  return {
    id: plain.id,
    documentId: plain.documentId,
    username: plain.username,
    email: plain.email,
    confirmed: plain.confirmed,
    blocked: plain.blocked,
    provider: plain.provider,
  };
}

function formatMeResponse(user, methodSections) {
  const plain = user.toJSON();
  return {
    id: plain.id,
    documentId: plain.documentId,
    username: plain.username,
    email: plain.email,
    confirmed: plain.confirmed,
    blocked: plain.blocked,
    provider: plain.provider,
    role: plain.role,
    makCardsAccess: plain.makCardsAccess === true,
    isMedium: plain.isMedium === true,
    isPremium: plain.isPremium === true,
    makFavoriteCardIds: normalizeFavoriteCardIds(plain.makFavoriteCardIds),
    methodSections: methodSections.map((ums) => ({
      id: ums.id,
      documentId: ums.documentId,
      createdAt: ums.createdAt,
      updatedAt: ums.updatedAt,
      publishedAt: null,
      locale: null,
      isPaid: ums.isPaid,
      method_section: ums.method_section
        ? {
            id: ums.method_section.id,
            documentId: ums.method_section.documentId,
            slug: ums.method_section.slug,
            title: ums.method_section.title,
            subtitle: ums.method_section.subtitle,
            mobtitle: ums.method_section.mobtitle,
          }
        : null,
    })),
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
}
