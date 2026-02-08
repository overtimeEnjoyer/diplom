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
  /** 1. Register: create user (confirmed=false), send email with code. No JWT. */
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

    const code = generateCode();
    const hashedCode = hashCode(code);
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await strapi.query('plugin::users-permissions.user').create({
      data: {
        username,
        email,
        password: hashedPassword,
        provider: 'local',
        confirmed: false,
        blocked: false,
        role: defaultRole.id,
        emailConfirmationCode: hashedCode,
        emailConfirmationExpires: new Date(Date.now() + CODE_TTL_MS),
      },
    });

    await strapi.plugin('email').service('email').send({
      to: email,
      subject: 'Your confirmation code',
      text: `Your confirmation code is: ${code}`,
    });

    return ctx.send({ ok: true, message: 'Check your email for the confirmation code' });
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

    await strapi.plugin('email').service('email').send({
      to: email,
      subject: 'Your confirmation code',
      text: `Your confirmation code is: ${code}`,
    });

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

    await strapi.plugin('email').service('email').send({
      to: email,
      subject: 'Password reset code',
      text: `Your password reset code is: ${code}`,
    });

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
};
