/**
 * Копіювання даних зі Strapi 5 PostgreSQL → нова схема (Express/Sequelize).
 *
 * STRAPI_DATABASE_URL — стара БД (Render / Neon / local Strapi Postgres)
 * DATABASE_URL — нова prod/dev БД (після pnpm db:migrate)
 *
 * Запуск:
 *   pnpm db:migrate
 *   STRAPI_DATABASE_URL="postgresql://..." DATABASE_URL="postgresql://..." pnpm migrate:from-strapi
 *   # повна перезапись даних (не чіпає sequelize_migrations):
 *   ... pnpm migrate:from-strapi -- --truncate
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const { Client } = pg;

const truncate = process.argv.includes('--truncate');
const strapiUrl = process.env.STRAPI_DATABASE_URL || process.env.OLD_DATABASE_URL;
const targetUrl = process.env.DATABASE_URL;

function inferSslFromUrl(url: string) {
  if (/sslmode=disable/i.test(url)) return false;
  return /sslmode=require|ssl=true|neon\.tech|supabase\.co|vercel-storage\.com|render\.com|railway\.app/i.test(
    url,
  );
}

function useSslForUrl(url: string) {
  if (/sslmode=disable/i.test(url)) return false;
  if (/sslmode=require|sslmode=verify-full|sslmode=verify-ca/i.test(url)) return true;
  try {
    const host = new URL(url.replace(/^postgres(ql)?:/, 'http:')).hostname;
    if (host === 'localhost' || host === '127.0.0.1') return false;
  } catch {
    /* ignore */
  }
  if (process.env.DATABASE_SSL === 'false') return false;
  if (process.env.DATABASE_SSL === 'true') return true;
  return inferSslFromUrl(url);
}

function pgClientOptions(connectionString: string) {
  if (!useSslForUrl(connectionString)) return { connectionString };
  return {
    connectionString,
    ssl: {
      rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
    },
  };
}

if (!strapiUrl || !targetUrl) {
  console.error('Потрібні STRAPI_DATABASE_URL (джерело) та DATABASE_URL (ціль).');
  process.exit(1);
}

async function tableExists(client: pg.Client, table: string) {
  const r = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
    [table],
  );
  return r.rowCount > 0;
}

async function getColumns(client: pg.Client, table: string) {
  const r = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
    [table],
  );
  return new Set(r.rows.map((x) => x.column_name));
}

function pick(row: Record<string, unknown>, ...names: string[]) {
  for (const n of names) {
    if (row[n] !== undefined && row[n] !== null) return row[n];
  }
  return null;
}

function asUuid(val: unknown) {
  if (!val) return randomUUID();
  return String(val);
}

/** Normalize Strapi JSON / JSONB / rich-text for PostgreSQL jsonb columns. */
function toJsonParam(val: unknown): string | null {
  if (val === undefined || val === null) return null;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch {
      return JSON.stringify({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: trimmed }] }],
      });
    }
  }
  if (typeof val === 'object') return JSON.stringify(val);
  return JSON.stringify(val);
}

async function resolveMethodSectionId(
  src: pg.Client,
  methodRow: Record<string, unknown>,
): Promise<number | null> {
  const direct = pick(methodRow, 'method_section_id');
  if (direct) return Number(direct);

  const methodId = Number(methodRow.id);
  const linkNames = [
    'methods_method_section_lnk',
    'method_section_id_methods_lnk',
    'methods_method_sections_lnk',
  ];
  for (const table of linkNames) {
    if (!(await tableExists(src, table))) continue;
    const cols = await getColumns(src, table);
    const methodCol = cols.has('method_id') ? 'method_id' : null;
    const sectionCol = cols.has('method_section_id') ? 'method_section_id' : null;
    if (!methodCol || !sectionCol) continue;
    const r = await src.query(
      `SELECT ${sectionCol} AS section_id FROM ${table} WHERE ${methodCol} = $1 LIMIT 1`,
      [methodId],
    );
    if (r.rows[0]?.section_id) return Number(r.rows[0].section_id);
  }
  return null;
}

async function resolveUmsRelations(
  src: pg.Client,
  umsId: number,
): Promise<{ userId: number | null; sectionId: number | null }> {
  let userId: number | null = null;
  let sectionId: number | null = null;

  const userLinks = ['user_method_sections_user_lnk', 'user_method_sections_user_links'];
  for (const table of userLinks) {
    if (!(await tableExists(src, table))) continue;
    const r = await src.query(
      `SELECT user_id FROM ${table} WHERE user_method_section_id = $1 LIMIT 1`,
      [umsId],
    );
    if (r.rows[0]?.user_id) {
      userId = Number(r.rows[0].user_id);
      break;
    }
  }

  const sectionLinks = [
    'user_method_sections_method_section_lnk',
    'user_method_sections_method_sections_lnk',
  ];
  for (const table of sectionLinks) {
    if (!(await tableExists(src, table))) continue;
    const r = await src.query(
      `SELECT method_section_id FROM ${table} WHERE user_method_section_id = $1 LIMIT 1`,
      [umsId],
    );
    if (r.rows[0]?.method_section_id) {
      sectionId = Number(r.rows[0].method_section_id);
      break;
    }
  }

  const cols = await getColumns(src, 'user_method_sections');
  if (!userId && cols.has('user_id')) {
    const r = await src.query(`SELECT user_id FROM user_method_sections WHERE id = $1`, [umsId]);
    userId = r.rows[0]?.user_id ? Number(r.rows[0].user_id) : null;
  }
  if (!sectionId && cols.has('method_section_id')) {
    const r = await src.query(`SELECT method_section_id FROM user_method_sections WHERE id = $1`, [
      umsId,
    ]);
    sectionId = r.rows[0]?.method_section_id ? Number(r.rows[0].method_section_id) : null;
  }

  return { userId, sectionId };
}

async function loadReflectionQuestions(src: pg.Client, methodId: number) {
  const cmpTable = 'methods_cmps';
  if (!(await tableExists(src, cmpTable))) return null;

  const r = await src.query(
    `SELECT c.text
     FROM methods_cmps mc
     JOIN components_methods_reflection_questions c ON c.id = mc.cmp_id
     WHERE mc.entity_id = $1 AND mc.component_type LIKE '%reflection%'
     ORDER BY mc."order"`,
    [methodId],
  );
  const items = r.rows.map((row) => ({ text: row.text })).filter((x) => x.text);
  return items.length ? items : null;
}

async function main() {
  const src = new Client(pgClientOptions(strapiUrl));
  const dst = new Client(pgClientOptions(targetUrl));

  await src.connect();
  await dst.connect();

  console.log('Source OK:', strapiUrl.replace(/:[^:@]+@/, ':***@'));
  console.log('Target OK:', targetUrl.replace(/:[^:@]+@/, ':***@'));

  if (truncate) {
    console.log('Truncating target tables...');
    await dst.query(`
      TRUNCATE material_views, user_method_sections, methods, method_sections,
        feedbacks, users, pricings, roles RESTART IDENTITY CASCADE
    `);
  }

  // --- roles ---
  const roleMap = new Map<number, number>();
  if (await tableExists(src, 'up_roles')) {
    const roles = await src.query(`SELECT id, name, type, description FROM up_roles`);
    for (const row of roles.rows) {
      const ins = await dst.query(
        `INSERT INTO roles (name, type, description, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         ON CONFLICT (type) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [row.name, row.type, row.description],
      );
      roleMap.set(Number(row.id), Number(ins.rows[0].id));
    }
    console.log(`roles: ${roles.rowCount}`);
  } else {
    await dst.query(`INSERT INTO roles (name, type, created_at, updated_at) VALUES
      ('Public','public',NOW(),NOW()), ('Authenticated','authenticated',NOW(),NOW()), ('Admin','admin',NOW(),NOW())
      ON CONFLICT (type) DO NOTHING`);
    const r = await dst.query(`SELECT id, type FROM roles`);
    for (const row of r.rows) roleMap.set(row.type, row.id);
  }

  const defaultAuthRole = await dst.query(`SELECT id FROM roles WHERE type = 'authenticated' LIMIT 1`);

  // --- method_sections ---
  const sectionIdMap = new Map<number, number>();
  if (await tableExists(src, 'method_sections')) {
    const rows = await src.query(`SELECT * FROM method_sections ORDER BY id`);
    for (const row of rows.rows) {
      const ins = await dst.query(
        `INSERT INTO method_sections (
          document_id, slug, title, subtitle, mobtitle, published_at, locale, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (slug) DO UPDATE SET
          title = EXCLUDED.title, subtitle = EXCLUDED.subtitle, mobtitle = EXCLUDED.mobtitle,
          published_at = EXCLUDED.published_at, updated_at = EXCLUDED.updated_at
        RETURNING id`,
        [
          asUuid(pick(row, 'document_id', 'documentId')),
          row.slug,
          row.title,
          row.subtitle,
          row.mobtitle,
          pick(row, 'published_at', 'publishedAt'),
          row.locale,
          row.created_at || row.createdAt || new Date(),
          row.updated_at || row.updatedAt || new Date(),
        ],
      );
      sectionIdMap.set(Number(row.id), Number(ins.rows[0].id));
    }
    console.log(`method_sections: ${rows.rowCount}`);
  }

  // --- methods ---
  if (await tableExists(src, 'methods')) {
    const rows = await src.query(`SELECT * FROM methods ORDER BY id`);
    let ok = 0;
    let skip = 0;
    for (const row of rows.rows) {
      const oldSectionId = await resolveMethodSectionId(src, row);
      const newSectionId = oldSectionId ? sectionIdMap.get(oldSectionId) : null;
      const reflection =
        (await loadReflectionQuestions(src, Number(row.id))) ||
        pick(row, 'reflection_questions', 'reflectionQuestions');

      try {
        await dst.query(
          `INSERT INTO methods (
            document_id, method_section_id, title, slug, author_source, approach, target_audience,
            goal, purpose, therapeutic_effect, time, materials, short_instruction, instruction,
            interpretation, completion, reflection_questions, published_at, locale, created_at, updated_at
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21
          )
          ON CONFLICT (slug) DO UPDATE SET
            method_section_id = EXCLUDED.method_section_id,
            title = EXCLUDED.title,
            purpose = EXCLUDED.purpose,
            instruction = EXCLUDED.instruction,
            reflection_questions = EXCLUDED.reflection_questions,
            published_at = EXCLUDED.published_at,
            updated_at = EXCLUDED.updated_at`,
          [
            asUuid(pick(row, 'document_id', 'documentId')),
            newSectionId,
            row.title,
            row.slug,
            pick(row, 'author_source', 'authorSource'),
            row.approach,
            pick(row, 'target_audience', 'targetAudience'),
            row.goal,
            toJsonParam(pick(row, 'purpose')),
            toJsonParam(pick(row, 'therapeutic_effect', 'therapeuticEffect')),
            row.time,
            row.materials,
            toJsonParam(pick(row, 'short_instruction', 'shortInstruction')),
            toJsonParam(pick(row, 'instruction')),
            toJsonParam(pick(row, 'interpretation')),
            toJsonParam(pick(row, 'completion')),
            toJsonParam(reflection),
            pick(row, 'published_at', 'publishedAt'),
            row.locale,
            row.created_at || row.createdAt || new Date(),
            row.updated_at || row.updatedAt || new Date(),
          ],
        );
        ok += 1;
      } catch (e) {
        skip += 1;
        console.warn(`  skip method ${row.slug}:`, (e as Error).message);
      }
    }
    console.log(`methods: ok=${ok}, skip=${skip}`);
  }

  // --- users ---
  const userIdMap = new Map<number, number>();
  if (await tableExists(src, 'up_users')) {
    const userCols = await getColumns(src, 'up_users');
    const rows = await src.query(`SELECT * FROM up_users ORDER BY id`);
    for (const row of rows.rows) {
      let roleId = defaultAuthRole.rows[0]?.id;
      if (userCols.has('role_id') && row.role_id) {
        roleId = roleMap.get(Number(row.role_id)) ?? roleId;
      }

      const ins = await dst.query(
        `INSERT INTO users (
          document_id, username, email, password, provider, confirmed, blocked, role_id,
          email_confirmation_code, email_confirmation_expires, password_reset_code, password_reset_expires,
          mak_cards_access, is_medium, is_premium, mak_favorite_card_ids, created_at, updated_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
        )
        ON CONFLICT (email) DO UPDATE SET
          username = EXCLUDED.username,
          mak_cards_access = EXCLUDED.mak_cards_access,
          is_medium = EXCLUDED.is_medium,
          is_premium = EXCLUDED.is_premium,
          mak_favorite_card_ids = EXCLUDED.mak_favorite_card_ids,
          updated_at = EXCLUDED.updated_at
        RETURNING id`,
        [
          asUuid(pick(row, 'document_id', 'documentId')),
          row.username,
          String(row.email).toLowerCase(),
          row.password,
          row.provider || 'local',
          row.confirmed ?? true,
          row.blocked ?? false,
          roleId,
          pick(row, 'email_confirmation_code', 'emailConfirmationCode'),
          pick(row, 'email_confirmation_expires', 'emailConfirmationExpires'),
          pick(row, 'password_reset_code', 'passwordResetCode'),
          pick(row, 'password_reset_expires', 'passwordResetExpires'),
          pick(row, 'mak_cards_access', 'makCardsAccess') === true,
          pick(row, 'is_medium', 'isMedium') === true,
          pick(row, 'is_premium', 'isPremium') === true,
          row.mak_favorite_card_ids ?? row.makFavoriteCardIds
            ? JSON.stringify(row.mak_favorite_card_ids ?? row.makFavoriteCardIds)
            : null,
          row.created_at || row.createdAt || new Date(),
          row.updated_at || row.updatedAt || new Date(),
        ],
      );
      userIdMap.set(Number(row.id), Number(ins.rows[0].id));
    }
    console.log(`users: ${rows.rowCount}`);
  }

  // --- user_method_sections ---
  if (await tableExists(src, 'user_method_sections')) {
    const rows = await src.query(`SELECT * FROM user_method_sections ORDER BY id`);
    let ok = 0;
    for (const row of rows.rows) {
      const { userId, sectionId } = await resolveUmsRelations(src, Number(row.id));
      const newUserId = userId ? userIdMap.get(userId) : null;
      const newSectionId = sectionId ? sectionIdMap.get(sectionId) : null;
      if (!newUserId || !newSectionId) continue;

      await dst.query(
        `INSERT INTO user_method_sections (document_id, user_id, method_section_id, is_paid, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (user_id, method_section_id) DO UPDATE SET is_paid = EXCLUDED.is_paid`,
        [
          asUuid(pick(row, 'document_id', 'documentId')),
          newUserId,
          newSectionId,
          pick(row, 'is_paid', 'isPaid') === true,
          row.created_at || row.createdAt || new Date(),
          row.updated_at || row.updatedAt || new Date(),
        ],
      );
      ok += 1;
    }
    console.log(`user_method_sections: ${ok}/${rows.rowCount}`);
  }

  // --- pricings ---
  if (await tableExists(src, 'pricings')) {
    const row = (await src.query(`SELECT * FROM pricings ORDER BY id LIMIT 1`)).rows[0];
    if (row) {
      await dst.query(`DELETE FROM pricings`);
      await dst.query(
        `INSERT INTO pricings (
          document_id, mak_cards_price, medium_price, premium_price, section_price, currency, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())`,
        [
          asUuid(pick(row, 'document_id', 'documentId')),
          pick(row, 'mak_cards_price', 'makCardsPrice') ?? 1890,
          pick(row, 'medium_price', 'mediumPrice') ?? 3990,
          pick(row, 'premium_price', 'premiumPrice') ?? 4990,
          pick(row, 'section_price', 'sectionPrice') ?? 890,
          row.currency || 'UAH',
        ],
      );
      console.log('pricings: 1');
    }
  }

  // --- feedbacks ---
  if (await tableExists(src, 'feedbacks')) {
    const rows = await src.query(`SELECT * FROM feedbacks ORDER BY id`);
    for (const row of rows.rows) {
      await dst.query(
        `INSERT INTO feedbacks (document_id, name, email, message, tariff, is_processed, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (document_id) DO NOTHING`,
        [
          asUuid(pick(row, 'document_id', 'documentId')),
          row.name,
          row.email,
          row.message,
          row.tariff,
          pick(row, 'is_processed', 'isProcessed') === true,
          row.created_at || row.createdAt || new Date(),
          row.updated_at || row.updatedAt || new Date(),
        ],
      );
    }
    console.log(`feedbacks: ${rows.rowCount}`);
  }

  await dst.query(`
    SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1));
    SELECT setval(pg_get_serial_sequence('method_sections', 'id'), COALESCE((SELECT MAX(id) FROM method_sections), 1));
    SELECT setval(pg_get_serial_sequence('methods', 'id'), COALESCE((SELECT MAX(id) FROM methods), 1));
  `);

  await src.end();
  await dst.end();
  console.log('\nMigration finished.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
