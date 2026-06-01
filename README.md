# rok-m-backend

REST API платформи ROK Mental Health.

## Запуск

Потрібно: [Node.js 18+](https://nodejs.org) · [pnpm](https://pnpm.io/installation).  
Docker — лише якщо в `.env` немає хмарної `DATABASE_URL` (Neon/Supabase).

```bash
pnpm install
pnpm start:here
pnpm dev
```

| Що | URL |
|----|-----|
| Адмін-панель | http://localhost:3000/ (відкривається одразу) |
| API | http://localhost:3000/api |
| Документація | http://localhost:3000/api-docs |
| Перевірка | http://localhost:3000/health |

**Адмін:** `admin@rok-mentalhealth.local` / `Admin123!ChangeMe`

## Щодня

```bash
pnpm dev
```

Локальна БД: Docker увімкнений. Хмарна БД у `.env` — Docker не потрібен.

## Тести

```bash
pnpm test
```

## Диплом (реалізовано в API)

| Тема диплому | Реалізація |
|--------------|------------|
| Обрані методики | `GET/PUT/POST /api/methods/favorites`, alias `GET/POST /api/user/methods/favorites` (МАК — `/api/mak-cards/favorites`) |
| Фільтр за симптоматикою | `?symptom=` / `?approach=` на `GET /api/methods`, `GET /api/methods/search` |
| Promise.all каталогу | паралельне завантаження у `getMethodBySlug` |
| AbortController | `fetchWithTimeout` для email і Supabase presign |
| Supabase Auth | якщо задано `SUPABASE_JWT_SECRET` — Bearer перевіряється спочатку Supabase, потім локальний JWT |
| Read replica | `DATABASE_READ_REPLICA_URL` + `catalogQueryOptions()` |
| Redis / кеш | `REDIS_URL` або in-memory; `docker compose --profile cache up -d redis` |
| BRIN analytics | індекс `material_views_viewed_at_brin` (міграція `20260602120000`) |

Prod: `SUPABASE_JWT_SECRET` + `POST /api/auth/sync` для зв’язку з локальним профілем.

`docs/thesis-testing-performance.md`
