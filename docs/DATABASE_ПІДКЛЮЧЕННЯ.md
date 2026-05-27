# Що не так і як підключити базу даних

> Схема таблиць, моделі та зв’язки: [DATABASE_DESIGN_UA.md](./DATABASE_DESIGN_UA.md).

## Що означає помилка

**"Connection terminated unexpectedly"** — Strapi не може стабільно підключитися до PostgreSQL.

Зараз у тебе в `.env` вказано базу на **Render** (хмара). Часті причини помилки:

1. **Render “засинає”** — безкоштовна БД через неактивність вимикається, перше підключення обривається.
2. **Мережа** — з’єднання з хмарою нестабільне або щось блокує порт.
3. **SSL** — сервер очікує інший режим підключення.

Тобто проблема не в коді Strapi, а в тому, **до якої** бази він підключається і чи вона доступна.

---

## Варіант 1: Локальна база (найпростіше для розробки)

Підключаємо Strapi до PostgreSQL на твоєму комп’ютері. Тоді Render не потрібен під час роботи локально.

### Крок 1. Встановити PostgreSQL

- **macOS (Homebrew):**  
  `brew install postgresql@15`  
  Потім: `brew services start postgresql@15`
- Або встанови з офіційного сайту: https://www.postgresql.org/download/

### Крок 2. Створити базу і користувача

У терміналі:

```bash
# Зайти в psql (часто користувач postgres, пароль порожній або той, що ставив при встановленні)
psql postgres

# В консолі psql:
CREATE DATABASE strapi;
CREATE USER strapi_user WITH PASSWORD 'strapi_pass';
GRANT ALL PRIVILEGES ON DATABASE strapi TO strapi_user;
\q
```

(Якщо вже є база/користувач — використовуй свої ім’я та пароль.)

### Крок 3. Змінити .env

Відкрий `.env` і замість поточного `DATABASE_URL` з Render постав **один** рядок (підстав свій пароль і порт, якщо не 5432):

```env
DATABASE_URL=postgresql://strapi_user:strapi_pass@127.0.0.1:5432/strapi
```

Збережи файл.

### Крок 4. Запустити Strapi

```bash
pnpm develop
```

Після першого запуску Strapi створить таблиці сам. Далі працюй з локальною базою; Render можна використовувати тільки для продакшену (деплой).

---

## Варіант 2: Залишитися на Render

Якщо хочеш саме хмарну базу вже зараз:

1. Зайди в **Render Dashboard** → твій **PostgreSQL** сервіс.
2. Переконайся, що він у статусі **Available** (не Paused).
3. В **Info** скопіюй **Internal Database URL** (або External) і в `.env` задай: `DATABASE_CLIENT=postgres`, `DATABASE_URL=<URL>`, `DATABASE_SSL=true`, `DATABASE_SSL_REJECT_UNAUTHORIZED=false`.
4. Збережи і запусти `pnpm develop`.

Якщо помилка повторюється — часто це саме через “засипання” або нестабільне з’єднання з Render; для щоденної розробки надійніше використовувати **варіант 1** (локальний PostgreSQL).

---

## Підсумок

| Що хочеш              | Дія |
|-----------------------|-----|
| Спокійно кодити локально | Встанови Postgres на комп, створи базу `strapi`, в `.env` постав `DATABASE_URL=postgresql://...@127.0.0.1:5432/strapi`. |
| Деплой на Render      | У Web Service → Environment вкажи **Internal Database URL** (не External) у `DATABASE_URL`. |

### Важливо для Render (деплой)

Конфіг бази зроблено за [офіційною документацією Strapi](https://docs.strapi.io/dev-docs/configurations/database). У **Web Service** → **Environment** на Render задай:

| Змінна | Значення |
|--------|----------|
| `DATABASE_CLIENT` | `postgres` |
| `DATABASE_URL` | **Internal Database URL** з інфо PostgreSQL (не External) |
| `DATABASE_SSL` | `true` |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | `false` (для self-signed сертифікатів Render) |
| `DATABASE_POOL_MIN` | `0` (рекомендовано для Docker/Render, щоб не тримати idle-з’єднання) |

- **Internal Database URL** стабільніший, бо йде по внутрішній мережі Render.
- Без `DATABASE_SSL=true` і `DATABASE_SSL_REJECT_UNAUTHORIZED=false` можлива помилка про self-signed certificate.

Локально в `.env` можна мати SQLite або локальний Postgres; для продакшену в Render — тільки ці змінні вище.
