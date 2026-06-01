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

## Диплом

`docs/thesis-testing-performance.md`
