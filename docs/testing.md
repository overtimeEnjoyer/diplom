# Тестування

> **Повний розділ для диплома (тестування + продуктивність):** [`thesis-testing-performance.md`](thesis-testing-performance.md)

## Стек

- **Jest** — test runner
- **Supertest** — HTTP integration tests проти Express app

## Файли

| Файл | Що перевіряє |
|------|----------------|
| tests/auth.test.js | register, login, /me, валідація, 401 |
| tests/materials.test.js | method-sections, methods filter, pricing, MAK favorites |
| tests/users.test.js | user-method-sections, feedback |
| tests/progress.test.js | запис перегляду, історія |

## Запуск

```bash
createdb rok_m_test
export DATABASE_URL=postgresql://user:pass@localhost:5432/rok_m_test
pnpm test
```

Тести використовують `sequelize.sync({ force: true })` для ізольованої БД (не заміна production migrations, але достатньо для CI).

## Очікувані результати

- Усі suites **passed** при доступному PostgreSQL (**22 тести**: auth, materials, users, progress, admin, payments).
- CI: `.github/workflows/ci.yml` (GitHub Actions + Postgres service).
- CD: `.github/workflows/cd.yml` (після успішного CI на `main`: migrate → Vercel deploy → smoke test).
- Без БД — `SequelizeConnectionError` (потрібен test database).

```bash
createdb rok_m_test
DATABASE_URL=postgresql://127.0.0.1:5432/rok_m_test pnpm test
# Test Suites: 5 passed, 16 passed
```

## Що покрито

- ✅ Успішні сценарії auth і контенту
- ✅ 400 валідація реєстрації
- ✅ 401 без токена
- ✅ CRUD-операції рівня API (читання, favorites toggle)
- ✅ Робота з БД через реальний PostgreSQL

## Що додати в CI

1. Service container `postgres:16`.
2. `pnpm db:migrate` або sync у `tests/helpers.js`.
3. `pnpm test` на pull request.

## Розширення

- Додаткові e2e для premium tariff, section assign + admin confirm
