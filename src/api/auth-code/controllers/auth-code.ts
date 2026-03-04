'use strict';

import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const CODE_TTL_MS = 10 * 60 * 1000; // 10 min

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function hashCode(code: string) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

export default {
  /** 1. Register: create user (confirmed=true), no email. Return JWT immediately. */
  async register(ctx) {
    const { email, username, password } = ctx.request.body;

    if (!email || !username || !password) {
      return ctx.badRequest('Email, username and password are required');
    }
    if (username.length < 3) {
      return ctx.badRequest('Username must be at least 3 characters');
    }
    if (password.length < 6) {
      return ctx.badRequest('Password must be at least 6 characters');
    }

    const existingByEmail = await strapi.query('plugin::users-permissions.user').findOne({
      where: { email },
    });
    const existingByUsername = await strapi.query('plugin::users-permissions.user').findOne({
      where: { username },
    });
    if (existingByEmail || existingByUsername) {
      return ctx.badRequest('User with this email or username already exists');
    }

    const defaultRole = await strapi.query('plugin::users-permissions.role').findOne({
      where: { type: 'authenticated' },
    });
    if (!defaultRole) {
      return ctx.internalServerError('Default role not found');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await strapi.query('plugin::users-permissions.user').create({
      data: {
        username,
        email,
        password: hashedPassword,
        provider: 'local',
        confirmed: true,
        blocked: false,
        role: defaultRole.id,
      },
    });

    const jwt = strapi.plugin('users-permissions').service('jwt').issue({ id: user.id });
    const sanitizedUser = {
      id: user.id,
      documentId: user.documentId,
      username: user.username,
      email: user.email,
      confirmed: true,
      blocked: user.blocked,
      provider: user.provider,
    };
    return ctx.send({ jwt, user: sanitizedUser });
  },

  /** 2. Request email code (existing flow). */
  async requestEmailCode(ctx) {
    const { email } = ctx.request.body;

    if (!email) {
      return ctx.badRequest('Email is required');
    }

    const user = await strapi.query('plugin::users-permissions.user').findOne({
      where: { email },
    });

    if (!user) {
      return ctx.send({ ok: true });
    }

    const code = generateCode();
    const hashedCode = hashCode(code);

    await strapi.query('plugin::users-permissions.user').update({
      where: { id: user.id },
      data: {
        emailConfirmationCode: hashedCode,
        emailConfirmationExpires: new Date(Date.now() + CODE_TTL_MS),
      },
    });

    try {
      await strapi.plugin('email').service('email').send({
        to: email,
        subject: 'Your confirmation code',
        text: `Your confirmation code is: ${code}`,
      });
    } catch (err) {
      strapi.log.warn('RequestEmailCode: email send failed', { email, err });
    }
    return ctx.send({ ok: true });
  },

  /** 3. Verify email code → set confirmed, clear code, return JWT. */
  async verifyCode(ctx) {
    const { email, code } = ctx.request.body;

    if (!email || !code) {
      return ctx.badRequest('Email and code are required');
    }

    const user = await strapi.query('plugin::users-permissions.user').findOne({
      where: { email },
    });

    if (!user) {
      return ctx.badRequest('Invalid email or code');
    }

    if (!user.emailConfirmationCode || !user.emailConfirmationExpires) {
      return ctx.badRequest('No pending confirmation for this email');
    }

    const now = new Date();
    if (user.emailConfirmationExpires < now) {
      return ctx.badRequest('Code expired');
    }

    const hashedInput = hashCode(code);
    if (hashedInput !== user.emailConfirmationCode) {
      return ctx.badRequest('Invalid code');
    }

    await strapi.query('plugin::users-permissions.user').update({
      where: { id: user.id },
      data: {
        confirmed: true,
        emailConfirmationCode: null,
        emailConfirmationExpires: null,
      },
    });

    const jwt = strapi.plugin('users-permissions').service('jwt').issue({ id: user.id });
    const sanitizedUser = {
      id: user.id,
      documentId: user.documentId,
      username: user.username,
      email: user.email,
      confirmed: true,
      blocked: user.blocked,
      provider: user.provider,
    };

    return ctx.send({ jwt, user: sanitizedUser });
  },

  /** 4. Forgot password: send code to email. */
  async requestPasswordCode(ctx) {
    const { email } = ctx.request.body;

    if (!email) {
      return ctx.badRequest('Email is required');
    }

    const user = await strapi.query('plugin::users-permissions.user').findOne({
      where: { email },
    });

    if (!user) {
      return ctx.send({ ok: true });
    }

    const code = generateCode();
    const hashedCode = hashCode(code);

    await strapi.query('plugin::users-permissions.user').update({
      where: { id: user.id },
      data: {
        passwordResetCode: hashedCode,
        passwordResetExpires: new Date(Date.now() + CODE_TTL_MS),
      },
    });

    try {
      await strapi.plugin('email').service('email').send({
        to: email,
        subject: 'Password reset code',
        text: `Your password reset code is: ${code}`,
      });
      strapi.log.info('RequestPasswordCode: email sent', { to: email });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      strapi.log.error(`RequestPasswordCode: email send failed — ${msg}. Check EMAIL_SMTP_HOST, EMAIL_SMTP_PORT, EMAIL_SMTP_USER, EMAIL_SMTP_PASS in .env`);
    }
    return ctx.send({ ok: true });
  },

  /** 5. Reset password with code. */
  async resetPassword(ctx) {
    const { email, code, password } = ctx.request.body;

    if (!email || !code || !password) {
      return ctx.badRequest('Email, code and password are required');
    }
    if (password.length < 6) {
      return ctx.badRequest('Password must be at least 6 characters');
    }

    const user = await strapi.query('plugin::users-permissions.user').findOne({
      where: { email },
    });

    if (!user) {
      return ctx.badRequest('Invalid email or code');
    }

    if (!user.passwordResetCode || !user.passwordResetExpires) {
      return ctx.badRequest('No pending password reset for this email');
    }

    const now = new Date();
    if (user.passwordResetExpires < now) {
      return ctx.badRequest('Code expired');
    }

    const hashedInput = hashCode(code);
    if (hashedInput !== user.passwordResetCode) {
      return ctx.badRequest('Invalid code');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await strapi.query('plugin::users-permissions.user').update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetCode: null,
        passwordResetExpires: null,
      },
    });

    return ctx.send({ ok: true, message: 'Password has been reset' });
  },

  /** Ensure ctx.state.user is set from JWT when route uses auth: false. */
  async ensureUserFromJwt(ctx: { state: { user?: unknown }; request?: { header?: { authorization?: string } } }) {
    if (ctx.state.user) return;
    try {
      const jwtService = strapi.plugin('users-permissions').service('jwt') as { getToken: (ctx: unknown) => Promise<{ id?: number } | null> };
      const payload = await jwtService.getToken(ctx);
      if (payload?.id == null) return;
      const userService = strapi.plugin('users-permissions').service('user') as { fetchAuthenticatedUser: (id: number) => Promise<unknown> };
      const user = await userService.fetchAuthenticatedUser(Number(payload.id));
      if (user) (ctx.state as { user?: unknown }).user = user;
    } catch {
      // invalid or missing token — leave ctx.state.user unset
    }
  },

  /** 6. Get current user (requires JWT). */
  async me(ctx) {
    await this.ensureUserFromJwt(ctx);
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized();
    }
    const full = await strapi.query('plugin::users-permissions.user').findOne({
      where: { id: user.id },
      populate: ['role'],
    });
    if (!full) {
      return ctx.notFound();
    }
    return ctx.send({
      id: full.id,
      documentId: full.documentId,
      username: full.username,
      email: full.email,
      confirmed: full.confirmed,
      blocked: full.blocked,
      provider: full.provider,
      role: full.role,
      createdAt: full.createdAt,
      updatedAt: full.updatedAt,
    });
  },

  /** 7. Update current user profile (requires JWT). Only username, email, password. */
  async updateMe(ctx) {
    await this.ensureUserFromJwt(ctx);
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized();
    }
    const { username, email, password } = ctx.request.body || {};
    const updateData: Record<string, unknown> = {};

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
  },
};
