import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { Op } from 'sequelize';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { getModels } from '../models/index.js';
import { issueJwt, sanitizeUser } from './auth.service.js';

export function isSupabaseAuthEnabled() {
  return Boolean(env.supabaseJwtSecret);
}

/** Verify Supabase access token (HS256, project JWT secret). */
export function verifySupabaseAccessToken(token) {
  if (!env.supabaseJwtSecret) return null;
  try {
    const payload = jwt.verify(token, env.supabaseJwtSecret, {
      algorithms: ['HS256'],
    });
    const sub = payload.sub;
    const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : null;
    if (!sub) return null;
    return { sub, email, payload };
  } catch {
    return null;
  }
}

/**
 * Sync local user after Supabase Auth registration/login (thesis: POST /api/auth/sync).
 * Accepts Supabase access token in Authorization header or body.accessToken.
 */
export async function syncFromSupabase({ accessToken, email, username }) {
  if (!isSupabaseAuthEnabled()) {
    throw ApiError.internal('Supabase Auth is not configured (set SUPABASE_JWT_SECRET)');
  }
  const claims = verifySupabaseAccessToken(accessToken);
  if (!claims) throw ApiError.unauthorized('Invalid Supabase access token');

  const { User, Role } = getModels();
  const resolvedEmail = (email || claims.email || '').toLowerCase();
  if (!resolvedEmail) throw ApiError.badRequest('Email is required for sync');

  let user = await User.unscoped().findOne({
    where: {
      [Op.or]: [{ supabaseUid: claims.sub }, { email: resolvedEmail }],
    },
  });

  const role = await Role.findOne({ where: { type: 'authenticated' } });
  if (!role) throw ApiError.internal('Default role not found');

  if (!user) {
    const baseUsername =
      username ||
      resolvedEmail.split('@')[0].slice(0, 40) ||
      `user_${String(claims.sub).slice(0, 8)}`;
    let uniqueUsername = baseUsername;
    let suffix = 1;
    while (await User.unscoped().findOne({ where: { username: uniqueUsername } })) {
      uniqueUsername = `${baseUsername}_${suffix}`;
      suffix += 1;
    }

    const randomPassword = await bcrypt.hash(uuidv4(), 10);
    user = await User.create({
      documentId: uuidv4(),
      username: uniqueUsername,
      email: resolvedEmail,
      password: randomPassword,
      provider: 'supabase',
      supabaseUid: claims.sub,
      confirmed: true,
      blocked: false,
      roleId: role.id,
    });
  } else {
    await user.update({
      supabaseUid: claims.sub,
      provider: 'supabase',
      email: resolvedEmail,
      confirmed: true,
    });
  }

  return { jwt: issueJwt(user.id), user: sanitizeUser(user) };
}
