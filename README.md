# rok-m-backend — серверна частина освітньої платформи

Практична імплементація **гібридної serverless/BaaS архітектури** для поширення освітніх матеріалів (дипломна робота).

**Стек:** Node.js, Express.js, Sequelize, PostgreSQL, Vercel Functions, JWT, Jest/Supertest.

> Міграція зі старої БД: [`docs/MIGRATE_LEGACY_DATA.md`](docs/MIGRATE_LEGACY_DATA.md).

## Архітектура (коротко)

```text
Frontend (rok-mentalhealth.com)
        │  REST /api/*
        ▼
Vercel Functions  →  Express app (src/app.js)
        │                  │
        │                  ├── routes → controllers → services
        ▼                  ▼
   PostgreSQL (Neon/Supabase)  ← Sequelize ORM
```

**Чому саме цей стек** — детально в [`docs/architecture.md`](docs/architecture.md) та [`docs/comparison.md`](docs/comparison.md).

## Структура проєкту

```text
api/index.js              # Vercel serverless entry
src/
  config/                 # env, database (pool + read replicas)
  models/                 # Sequelize models (User, Method, MethodSection, …)
  migrations/ seeders/
  routes/ controllers/ services/
  middlewares/ validators/ utils/
  app.js server.js
tests/                    # Jest + Supertest
docs/                     # Матеріали для захисту
methodics-sections/       # Статичний контент для імпорту
scripts/                  # import:methodics, migrate:legacy-db
```

## API (збережений контракт для фронтенду)

| Група | Приклади |
|-------|----------|
| Auth | `POST /api/auth/register`, `/api/auth/local`, `/api/auth/me` |
| Профіль / пароль | `/api/auth/profile`, `/api/auth/password/*`, `/api/auth/email/*` |
| Контент | `GET /api/method-sections`, `/api/methods`, `/api/pricing` |
| Доступ / оплата | `/api/tariffs/*`, `/api/user-method-sections/*`, `/api/mak-cards/*`, `/api/payments/*` |
| Інше | `POST /api/feedback`, `POST /api/progress/methods/:id/view` |

Повний опис: [`docs/api.md`](docs/api.md). Для фронтенду змініть базовий URL:

```env
VITE_API_URL=http://localhost:3000
```

(за замовчуванням у `.env` можна **1337** для сумісності з фронтом)

## Змінні середовища

Скопіюйте `.env.example` → `.env`. Обов’язкові для запуску:

- `DATABASE_URL` — PostgreSQL
- `JWT_SECRET`
- Оплати (опційно): `PAYMENT_PROVIDER`, `PAYMENT_MOCK_CONFIRM`

## Локальний запуск

```bash
pnpm install
cp .env.example .env

# Варіант A — Docker Postgres
pnpm docker:up
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/rok_m_dev pnpm setup:local

# Варіант B — локальний Postgres
createdb rok_m_dev
pnpm setup:local

pnpm dev
```

**Admin після seed:** `admin@rok-mentalhealth.local` / `Admin123!ChangeMe` (змініть через `ADMIN_*` у `.env`) — деталі: [`docs/ADMIN_SETUP.md`](docs/ADMIN_SETUP.md).

API: `http://localhost:3000/api` · Health: `GET /health`

## Міграції

```bash
pnpm db:migrate
pnpm db:seed
pnpm db:reset    # undo all + migrate + seed
```

## Тести

```bash
createdb rok_m_test
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/rok_m_test pnpm test
```

Деталі: [`docs/testing.md`](docs/testing.md)

## Деплой на Vercel

1. Підключіть репозиторій до Vercel.
2. Додайте env: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`.
3. Після деплою виконайте міграції на production БД (`pnpm db:migrate` локально з prod `DATABASE_URL`).

Покроково: [`docs/deployment.md`](docs/deployment.md)

## Функціонал платформи

✅ Реєстрація / логін / JWT / профіль / скидання пароля  
✅ Методики (sections + methods) з `filters` / `populate` у query  
✅ Ціни, оплата (provider-agnostic), тарифи Medium/Premium, розділи, МАК-картки  
✅ Feedback, favorites МАК  

➕ **Додатково:** історія переглядів (`/api/progress/*`), admin REST, read-replica config  

Чеклист ендпоінтів: [`docs/MIGRATION_INVENTORY.md`](docs/MIGRATION_INVENTORY.md)  
Копіювання зі старої БД: [`docs/MIGRATE_LEGACY_DATA.md`](docs/MIGRATE_LEGACY_DATA.md)

## Документація для захисту

| Файл | Зміст |
|------|--------|
| [architecture.md](docs/architecture.md) | Архітектура, рішення, BaaS-гібрид |
| [comparison.md](docs/comparison.md) | Порівняльні таблиці підходів і технологій |
| [database.md](docs/database.md) | ERD, індекси, масштабування |
| [api.md](docs/api.md) | Endpoints, ролі, помилки |
| [deployment.md](docs/deployment.md) | Vercel + PostgreSQL |
| [testing.md](docs/testing.md) | Jest, покриття |
| [thesis-testing-performance.md](docs/thesis-testing-performance.md) | Тестування + аналіз продуктивності (диплом) |

## Ліцензія

Приватний проєкт (дипломна робота).
