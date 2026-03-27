'use strict';

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { createAccessPayment } from '../../payments/services/payments';

const CODE_TTL_MS = 10 * 60 * 1000; // 10 min

/** SendGrid dynamic template for password reset email (new design). */
const SENDGRID_TEMPLATE_PASSWORD_RESET = 'd-f428088d3f7743fe88ff7c3521e0e782';

/** SendGrid dynamic template for feedback form email (new design). */
const SENDGRID_TEMPLATE_FEEDBACK = 'd-d1aee82899404657bedb899dcb8e7c5d';

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function hashCode(code: string) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/** Блокування по user.id для toggle/set favorites — щоб паралельні запити не перезаписували список. */
const makFavoritesLocks = new Map<number, Promise<unknown>>();
function withMakFavoritesLock<T>(userId: number, fn: () => Promise<T>): Promise<T> {
  const prev = makFavoritesLocks.get(userId) ?? Promise.resolve();
  const promise = prev
    .then(() => fn())
    .finally(() => {
      if (makFavoritesLocks.get(userId) === promise) makFavoritesLocks.delete(userId);
    });
  makFavoritesLocks.set(userId, promise);
  return promise as Promise<T>;
}

/** Записати makFavoriteCardIds у БД напряму (Knex). strapi.query для users-permissions може не зберігати кастомні поля. */
async function writeMakFavoritesToDb(userId: number, favoriteCardIds: string[]): Promise<void> {
  const knex = strapi.db?.connection;
  console.log('knex exists?', !!strapi.db, !!strapi.db?.connection);
  if (!knex) {
    await strapi.query('plugin::users-permissions.user').update({
      where: { id: userId },
      data: { makFavoriteCardIds: favoriteCardIds },
    });
    return;
  }
  const isPg = knex.client?.config?.client === 'pg';
  const value = isPg ? favoriteCardIds : JSON.stringify(favoriteCardIds);
  const updated = await knex('up_users')
    .where('id', userId)
    .update({ mak_favorite_card_ids: value });
  if (process.env.NODE_ENV !== 'production') {
    console.log('[mak-favorites] writeMakFavoritesToDb userId=', userId, 'rowsAffected=', updated, 'value=', isPg ? value : (value as string).slice(0, 80));
  }
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
        // SQLite/Knex не завжди коректно біндіть json-дефолт `[]` (масив),
        // тому явно ставимо `null` — для першого рендеру favorites це норм.
        makFavoriteCardIds: null,
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
        templateId: SENDGRID_TEMPLATE_PASSWORD_RESET,
        dynamicTemplateData: { code },
      });
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
    const makFavoriteCardIds = this.normalizeFavoriteCardIds(full.makFavoriteCardIds);
    let makCardsAccess = full.makCardsAccess === true;
    let isMedium = (full as any).isMedium === true;
    let isPremium = (full as any).isPremium === true;
    const knex = strapi.db?.connection;
    if (knex) {
      try {
        const rows = await knex('up_users').select('mak_cards_access').where('id', full.id).limit(1);
        if (rows[0] && rows[0].mak_cards_access != null) makCardsAccess = !!rows[0].mak_cards_access;
      } catch {
        // колонка може ще не існувати до міграції
      }
      try {
        const rows2 = await knex('up_users').select('is_medium').where('id', full.id).limit(1);
        if (rows2[0] && rows2[0].is_medium != null) isMedium = !!rows2[0].is_medium;
      } catch {
        // колонка може ще не існувати до міграції
      }
      try {
        const rows3 = await knex('up_users').select('is_premium').where('id', full.id).limit(1);
        if (rows3[0] && rows3[0].is_premium != null) isPremium = !!rows3[0].is_premium;
      } catch {
        // колонка може ще не існувати до міграції
      }
    }
    let methodSections: unknown[] = [];
    try {
      const userDocId = (full as { documentId?: string }).documentId;
      if (userDocId && strapi.entityService) {
        const items = await strapi.entityService.findMany(
          'api::user-method-section.user-method-section',
          {
            filters: { user: { documentId: userDocId } },
            populate: { method_section: { fields: ['id', 'documentId', 'slug', 'title', 'subtitle', 'mobtitle'] } },
          } as Record<string, unknown>,
        );
        methodSections = Array.isArray(items) ? items : [];
      }
    } catch {
      // ігноруємо помилку (наприклад, контент-тип не знайдено)
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
      makCardsAccess,
      isMedium,
      isPremium,
      makFavoriteCardIds,
      methodSections,
      createdAt: full.createdAt,
      updatedAt: full.updatedAt,
    });
  },

  /** Ініціалізує оплату доступу до МАК-карток. Сам доступ вмикається тільки після callback від WayForPay. */
  async grantMakCardsAccess(ctx) {
    await this.ensureUserFromJwt(ctx);
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized();
    }

    const payment = await createAccessPayment('mak-cards', {
      id: Number((user as any).id),
      email: (user as any).email || undefined,
    });

    return ctx.send({
      status: 'payment_required',
      access: 'mak-cards',
      ...payment,
    });
  },

  /** Нормалізує makFavoriteCardIds з БД у масив рядків (плоский). */
  normalizeFavoriteCardIds(raw) {
    if (Array.isArray(raw)) {
      const out = [];
      for (const item of raw) {
        if (typeof item === 'string') out.push(item);
        else if (Array.isArray(item)) out.push(...item.filter((id) => typeof id === 'string'));
      }
      return out;
    }
    if (typeof raw === 'string' && raw.trim() !== '') {
      if (raw.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            return parsed.filter((id) => typeof id === 'string');
          }
        } catch (_) {}
      }
      return [raw];
    }
    return [];
  },

  /** Улюблені МАК-картки: отримати список id. Читаємо з БД напряму (як і запис), щоб обійти можливе ігнорування кастомних полів у strapi.query. */
  async getMakFavorites(ctx) {
    await this.ensureUserFromJwt(ctx);
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized();
    }
    let raw: unknown;
    const knex = strapi.db?.connection;
    if (knex) {
      const rows = await knex('up_users').select('mak_favorite_card_ids').where('id', user.id).limit(1);
      raw = rows[0]?.mak_favorite_card_ids;
    }
    if (raw === undefined) {
      const full = await strapi.query('plugin::users-permissions.user').findOne({
        where: { id: user.id },
      });
      raw = full?.makFavoriteCardIds;
    }
    const favoriteCardIds = this.normalizeFavoriteCardIds(raw);
    if (process.env.NODE_ENV !== 'production') console.log('[mak-favorites GET] returning favoriteCardIds=', JSON.stringify(favoriteCardIds));
    return ctx.send({ favoriteCardIds });
  },

  /** Улюблені МАК-картки: повністю замінити список. */
  async setMakFavorites(ctx) {
    await this.ensureUserFromJwt(ctx);
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized();
    }
    const { favoriteCardIds } = ctx.request.body || {};
    if (!Array.isArray(favoriteCardIds)) {
      return ctx.badRequest('favoriteCardIds must be an array');
    }
    const toStore = favoriteCardIds.filter((id) => typeof id === 'string');
    if (process.env.NODE_ENV !== 'production') console.log('[mak-favorites PUT] toStore=', toStore);
    await withMakFavoritesLock(user.id, async () => {
      await writeMakFavoritesToDb(user.id, toStore);
    });
    return ctx.send({ favoriteCardIds: toStore });
  },

  /** Улюблені МАК-картки: додати або прибрати одну картку за id. Завжди повертає поточний список після toggle. */
  async toggleMakFavorite(ctx) {
    await this.ensureUserFromJwt(ctx);
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized();
    }
    const { cardId } = ctx.request.body || {};
    if (typeof cardId !== 'string' || cardId.trim() === '') {
      return ctx.badRequest('cardId must be a non-empty string');
    }
    const toStore = await withMakFavoritesLock(user.id, async () => {
      const full = await strapi.query('plugin::users-permissions.user').findOne({
        where: { id: user.id },
      });
      const raw = full?.makFavoriteCardIds;
      if (process.env.NODE_ENV !== 'production') console.log('[mak-favorites TOGGLE] read raw=', JSON.stringify(raw));
      let list = this.normalizeFavoriteCardIds(raw);
      const idx = list.indexOf(cardId);
      if (idx === -1) {
        list = [...list, cardId];
      } else {
        list = list.filter((_, i) => i !== idx);
      }
      const result = [...list];
      if (process.env.NODE_ENV !== 'production') console.log('[mak-favorites TOGGLE] toStore=', result);
      await writeMakFavoritesToDb(user.id, result);
      return result;
    });
    return ctx.send({ favoriteCardIds: toStore });
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

  /** 8. Form зворотного зв'язку: ім'я, повідомлення, email, тариф (опційно). Надсилає лист на FEEDBACK_EMAIL. */
  async sendFeedback(ctx) {
    const body = ctx.request.body || {};
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const tariff = body.tariff != null ? String(body.tariff).trim() : '';

    if (!name || name.length < 2) {
      return ctx.badRequest("Ім'я та прізвище обов'язкові (мін. 2 символи)");
    }
    if (!message || message.length < 10) {
      return ctx.badRequest('Повідомлення обов\'язкове (мін. 10 символів)');
    }
    if (!email) {
      return ctx.badRequest('Email обов\'язковий');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return ctx.badRequest('Невірний формат email');
    }

    const to =
      process.env.FEEDBACK_EMAIL ||
      process.env.EMAIL_FROM ||
      'no-reply@example.com';

    try {
      strapi.log.info('Feedback email sending', { to });
      await strapi.plugin('email').service('email').send({
        to,
        replyTo: email,
        subject: `Зворотний зв'язок: ${name}`,
        templateId: SENDGRID_TEMPLATE_FEEDBACK,
        dynamicTemplateData: {
          name,
          message,
          email,
          tariff: tariff || '—',
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      strapi.log.error('Feedback email send failed', { to, err: msg });
      return ctx.internalServerError('Не вдалося надіслати повідомлення. Спробуйте пізніше.');
    }

    return ctx.send({ ok: true, message: 'Повідомлення надіслано' });
  },
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
