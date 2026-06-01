import { verifyJwt } from '../services/auth.service.js';
import { verifySupabaseAccessToken, isSupabaseAuthEnabled } from '../services/supabaseAuth.service.js';
import { getModels } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

async function loadUserById(userId) {
  const { User, Role } = getModels();
  const user = await User.findByPk(userId, {
    include: [{ model: Role, as: 'role', attributes: ['id', 'name', 'type'] }],
  });
  if (!user || user.blocked) throw ApiError.unauthorized();
  return user;
}

async function resolveUserFromSupabaseToken(token) {
  const claims = verifySupabaseAccessToken(token);
  if (!claims) return null;

  const { User, Role } = getModels();
  const user = await User.findOne({
    where: { supabaseUid: claims.sub },
    include: [{ model: Role, as: 'role', attributes: ['id', 'name', 'type'] }],
  });
  if (!user || user.blocked) return null;
  return user;
}

async function resolveUserFromRequest(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw ApiError.unauthorized();

  if (isSupabaseAuthEnabled()) {
    const supabaseUser = await resolveUserFromSupabaseToken(token);
    if (supabaseUser) return supabaseUser;
  }

  try {
    const payload = verifyJwt(token);
    return loadUserById(payload.id);
  } catch {
    throw ApiError.unauthorized();
  }
}

export const authenticate = asyncHandler(async (req, _res, next) => {
  req.user = await resolveUserFromRequest(req);
  next();
});

export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();
  resolveUserFromRequest(req)
    .then((user) => {
      req.user = user;
      next();
    })
    .catch(() => next());
}
