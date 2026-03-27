'use strict';

const bcrypt = require('bcryptjs');

module.exports = (plugin) => {
  const toSessionVersion = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return Math.floor(parsed);
  };

  const rotateSessionAndIssueJwt = async (userId) => {
    const user = await strapi.query('plugin::users-permissions.user').findOne({
      where: { id: userId },
    });
    if (!user) return null;
    const nextSessionVersion = toSessionVersion(user.sessionVersion) + 1;
    await strapi.query('plugin::users-permissions.user').update({
      where: { id: userId },
      data: { sessionVersion: nextSessionVersion },
    });
    const jwt = strapi.plugin('users-permissions').service('jwt').issue({
      id: userId,
      sv: nextSessionVersion,
    });
    return { jwt };
  };

  const originalAuthCallback = plugin.controllers.auth.callback;
  plugin.controllers.auth.callback = async (ctx) => {
    await originalAuthCallback(ctx);

    if (typeof ctx.path !== 'string' || !ctx.path.endsWith('/auth/local')) return;

    const userId = ctx.body?.user?.id;
    const hasJwt = typeof ctx.body?.jwt === 'string' && ctx.body.jwt.length > 0;
    if (!userId || !hasJwt) return;

    const session = await rotateSessionAndIssueJwt(Number(userId));
    if (!session) return;
    ctx.body.jwt = session.jwt;
  };

  // updateProfile kept for compatibility; /auth/profile is served by api::auth-code with auth: false + JWT in controller
  plugin.controllers.user.updateProfile = async (ctx) => {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized();
    }
    const { username, email, password } = ctx.request.body || {};
    const updateData = {};

    if (username !== undefined) {
      if (typeof username !== 'string' || username.length < 3) {
        return ctx.badRequest('Username must be at least 3 characters');
      }
      const existing = await strapi.query('plugin::users-permissions.user').findOne({
        where: { username },
      });
      if (existing && Number(existing.id) !== Number(user.id)) {
        return ctx.badRequest('Username already taken');
      }
      updateData.username = username;
    }

    if (email !== undefined) {
      if (typeof email !== 'string' || email.length < 6) {
        return ctx.badRequest('Invalid email');
      }
      const existing = await strapi.query('plugin::users-permissions.user').findOne({
        where: { email: email.toLowerCase() },
      });
      if (existing && Number(existing.id) !== Number(user.id)) {
        return ctx.badRequest('Email already taken');
      }
      updateData.email = email.toLowerCase();
    }

    if (password !== undefined) {
      if (password !== null && (typeof password !== 'string' || password.length < 6)) {
        return ctx.badRequest('Password must be at least 6 characters');
      }
      if (password) {
        updateData.password = await bcrypt.hash(password, 10);
      }
    }

    if (Object.keys(updateData).length === 0) {
      return ctx.badRequest('Provide at least one of: username, email, password');
    }

    await strapi.query('plugin::users-permissions.user').update({
      where: { id: user.id },
      data: updateData,
    });

    const updated = await strapi.query('plugin::users-permissions.user').findOne({
      where: { id: user.id },
    });
    return ctx.send({
      id: updated.id,
      documentId: updated.documentId,
      username: updated.username,
      email: updated.email,
      confirmed: updated.confirmed,
      blocked: updated.blocked,
      provider: updated.provider,
    });
  };

  // Do NOT add /auth/me and /auth/profile here — they are served by api::auth-code
  // to avoid content-api permission checks (403). See src/api/auth-code.

  return plugin;
};
