import { verifyJwt } from '../services/auth.service.js';
import { getModels } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

async function resolveUserFromRequest(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw ApiError.unauthorized();

  const payload = verifyJwt(token);
  const { User, Role } = getModels();
  const user = await User.findByPk(payload.id, {
    include: [{ model: Role, as: 'role', attributes: ['id', 'name', 'type'] }],
  });
  if (!user || user.blocked) throw ApiError.unauthorized();
  return user;
}

export const authenticate = asyncHandler(async (req, _res, next) => {
  try {
    req.user = await resolveUserFromRequest(req);
    next();
  } catch (err) {
    if (err instanceof ApiError) next(err);
    else next(ApiError.unauthorized());
  }
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
