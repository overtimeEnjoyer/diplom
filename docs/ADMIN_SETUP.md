# Перший admin-користувач

## Автоматично (seeder)

Після міграцій:

```bash
pnpm db:seed
# або повний цикл:
pnpm db:setup
```

Змінні (`.env`):

| Variable | Default |
|----------|---------|
| `ADMIN_EMAIL` | admin@rok-mentalhealth.local |
| `ADMIN_USERNAME` | admin |
| `ADMIN_PASSWORD` | Admin123!ChangeMe |

Seeder: `src/seeders/20260526100002-admin-user.cjs` — не дублює користувача, якщо email/username вже існують.

## Логін

```http
POST /api/auth/local
Content-Type: application/json

{
  "identifier": "admin@rok-mentalhealth.local",
  "password": "Admin123!ChangeMe"
}
```

Відповідь: `{ "jwt": "..." }` — використовуйте в заголовку `Authorization: Bearer <jwt>` для `/api/admin/*`.

## Приклад admin-запиту

```http
GET /api/admin/feedbacks
Authorization: Bearer <jwt>
```

## Production

Обов’язково задайте сильний `ADMIN_PASSWORD` у Vercel env перед `pnpm db:seed` на production БД.
