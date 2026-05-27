import { ApiError } from '../utils/ApiError.js';

export function requireRole(...types) {
  return (req, _res, next) => {
    const roleType = req.user?.role?.type;
    if (!roleType || !types.includes(roleType)) {
      return next(ApiError.forbidden('Insufficient permissions'));
    }
    next();
  };
}
