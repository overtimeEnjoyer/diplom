type JwtPayload = {
  id?: number | string;
  sv?: number | string;
};

function parseSessionVersion(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
}

export default (_config, { strapi }) => {
  return async (ctx, next) => {
    const authHeader = ctx.request.header?.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const jwtService = strapi.plugin('users-permissions').service('jwt');
    let payload: JwtPayload | null = null;
    try {
      payload = await jwtService.getToken(ctx);
    } catch {
      return ctx.unauthorized('Invalid token');
    }

    if (!payload?.id) {
      return next();
    }

    if (payload.sv === undefined || payload.sv === null) {
      return ctx.unauthorized('Session expired. Please login again.');
    }

    const userId = Number(payload.id);
    if (!Number.isFinite(userId)) {
      return ctx.unauthorized('Invalid token');
    }

    const user = await strapi.query('plugin::users-permissions.user').findOne({
      where: { id: userId },
    });

    if (!user) {
      return ctx.unauthorized('User not found');
    }

    const dbSessionVersion = parseSessionVersion((user as { sessionVersion?: unknown }).sessionVersion);
    const tokenSessionVersion = parseSessionVersion(payload.sv);

    if (dbSessionVersion !== tokenSessionVersion) {
      return ctx.unauthorized('Session expired. Please login again.');
    }

    return next();
  };
};
