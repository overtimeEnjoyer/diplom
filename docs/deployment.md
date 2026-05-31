# Розгортання

## 0. Локально через Docker

```bash
pnpm docker:up
# у .env:
# DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/rok_m_dev
pnpm setup:local
```

## 1. PostgreSQL (BaaS)

1. Створіть проєкт у [Neon](https://neon.tech) або [Supabase](https://supabase.com).
2. Скопіюйте `DATABASE_URL` (pooler URL для serverless — **рекомендовано**).
3. Увімкніть SSL: `DATABASE_SSL=true`.

## 2. Vercel

1. Import Git repository.
2. Framework Preset: **Other** (або Node).
3. `vercel.json` — serverless handler `api/index.js`, `pnpm install`.
4. **Рекомендовано:** вимкніть **Auto-Deploy** у Vercel (Settings → Git), якщо деплой іде через GitHub Actions (`.github/workflows/cd.yml`) — інакше буде подвійний deploy.
5. **Обов’язкові** Environment variables (Production + Preview):

| Variable | Опис |
|----------|------|
| DATABASE_URL | Neon **pooler** URL з `?sslmode=require` |
| JWT_SECRET | Довгий випадковий рядок (як у локальному `.env`) |
| NODE_ENV | `production` |
| CORS_ORIGINS | `https://rok-mentalhealth.com,https://www.rok-mentalhealth.com` |
| PAYMENT_PROVIDER | `mock` (dev) or `manual` (prod) |
| PAYMENT_MOCK_CONFIRM | `true` only for demo prod confirm endpoint |
| BREVO_* / SENDGRID_API_KEY | Email |

6. У production підтверджуйте оплати через `POST /api/admin/payments/confirm` (admin JWT).

## 3. CD (GitHub Actions)

Після успішного **CI** на гілці `main` автоматично запускається **CD** (`.github/workflows/cd.yml`):

1. `pnpm db:migrate` — міграції production БД
2. `vercel deploy --prod` — деплой на Vercel
3. Smoke test `GET /health` та `/health/db`

Ручний redeploy: **Actions → CD → Run workflow**.

### Secrets (Settings → Secrets and variables → Actions)

| Secret | Опис |
|--------|------|
| `DATABASE_URL` | Production PostgreSQL (Neon pooler URL з `?sslmode=require`) |
| `VERCEL_TOKEN` | [Vercel → Account → Tokens](https://vercel.com/account/tokens) |
| `VERCEL_ORG_ID` | Vercel → Project → Settings → General → **Org ID** |
| `VERCEL_PROJECT_ID` | Vercel → Project → Settings → General → **Project ID** |

Опційно створіть GitHub **Environment** `production` з protection rules (required reviewers).

## 4. Міграції на production (локально)

```bash
DATABASE_URL="postgresql://..." pnpm db:migrate
DATABASE_URL="postgresql://..." pnpm db:seed
```

У звичайному flow міграції виконує CD; seed — один раз вручну після першого деплою.

## 5. Типові проблеми

| Проблема | Рішення |
|----------|---------|
| `FUNCTION_INVOCATION_FAILED` | Vercel → **Logs** → Runtime. Зазвичай немає `DATABASE_URL`, SSL, або не запущені міграції |
| 503 `service_unavailable` | Див. лог: `DATABASE_URL is not set` або `Database tables are missing` |
| 500 при першому запиті | Cold start + перевірте DATABASE_URL |
| Too many connections | Використовуйте **pooler** URL (Neon `-pooler`), `DATABASE_POOL_MAX=1` на Vercel |
| Оплата не застосувала доступ | Перевірте `orderReference`, admin/mock confirm |
| CORS blocked | Додайте origin у `CORS_ORIGINS` |
| 404 /api/api/... | У фронті не дублюйте `/api` в `VITE_API_URL` |

## 6. Локальний production-like запуск

```bash
NODE_ENV=production node src/server.js
```

## 7. Docker

```bash
docker build -t rok-m-backend .
docker run -p 3000:3000 --env-file .env rok-m-backend
```
