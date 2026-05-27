import { verifyJwt } from '../services/auth.service.js';
import { getModels } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';

export async function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw ApiError.unauthorized();

    const payload = verifyJwt(token);
    const { User, Role } = getModels();
    const user = await User.findByPk(payload.id, { include: [{ model: Role, as: 'role' }] });
    if (!user || user.blocked) throw ApiError.unauthorized();

    req.user = user;
    next();
  } catch (err) {
    if (err instanceof ApiError) next(err);
    else next(ApiError.unauthorized());
  }
}

export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();
  authenticate(req, _res, next).catch(() => next());
}
