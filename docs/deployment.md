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
3. `vercel.json` вже налаштовує `api/index.js` як serverless handler.
4. Environment variables:

| Variable | Опис |
|----------|------|
| DATABASE_URL | PostgreSQL connection string (pooler) |
| JWT_SECRET | Довгий випадковий рядок |
| CORS_ORIGINS | https://rok-mentalhealth.com,… |
| WAYFORPAY_* | Merchant keys, return/service URLs |
| BREVO_* / SENDGRID_API_KEY | Email |

5. `WAYFORPAY_SERVICE_URL` = `https://<project>.vercel.app/api/payments/wayforpay-callback`

## 3. Міграції на production

```bash
DATABASE_URL="postgresql://..." pnpm db:migrate
DATABASE_URL="postgresql://..." pnpm db:seed
```

Виконуйте з локальної машини або CI, не з runtime функції.

## 4. Типові проблеми

| Проблема | Рішення |
|----------|---------|
| 500 при першому запиті | Cold start + перевірте DATABASE_URL |
| Too many connections | Використовуйте pooler URL, зменшіть `DATABASE_POOL_MAX` |
| WayForPay invalid signature | Перевірте secret key, raw callback route |
| CORS blocked | Додайте origin у `CORS_ORIGINS` |
| 404 /api/api/... | У фронті не дублюйте `/api` в `VITE_API_URL` |

## 5. Локальний production-like запуск

```bash
NODE_ENV=production node src/server.js
```

## 6. Docker

```bash
docker build -t rok-m-backend .
docker run -p 3000:3000 --env-file .env rok-m-backend
```
