# Перенесення даних зі старої БД (Strapi) у нову (Express + Sequelize)

## Що переноситься

| Strapi (джерело) | Нова таблиця | Примітка |
|------------------|--------------|----------|
| `up_roles` | `roles` | мапінг за `type` |
| `up_users` | `users` | паролі (bcrypt) зберігаються |
| `method_sections` | `method_sections` | `document_id`, publish |
| `methods` | `methods` | blocks → JSONB; зв’язок через FK або `*_lnk` |
| `user_method_sections` | `user_method_sections` | доступи / оплати |
| `pricings` | `pricings` | один запис |
| `feedbacks` | `feedbacks` | форма зв’язку |

**Не переноситься:** Strapi Admin, API tokens, чернетки без `published_at` (якщо не опубліковані), історія платежів (її не було в Strapi).

---

## Варіант 1 — PostgreSQL → PostgreSQL (рекомендовано для prod)

Якщо старий Strapi на **Render / Neon** з PostgreSQL.

### 1. Отримайте URL старої БД

- Render: Dashboard → Postgres → **Internal Database URL** або External  
- Локально Strapi з Postgres: з `.env` старого проєкту `DATABASE_URL`

Збережіть як `STRAPI_DATABASE_URL` (тільки для міграції, не комітьте в git).

### 2. Підготуйте нову БД

```bash
# Нова БД (Vercel Postgres / Neon) — у .env:
# DATABASE_URL=postgresql://...

pnpm db:migrate
```

Не запускайте `db:seed`, якщо хочете перенести **реальних** користувачів і ціни зі Strapi.  
Або seed лише ролі вручну, потім міграція перезапише users/pricing.

### 3. Запустіть скрипт

```bash
export STRAPI_DATABASE_URL="postgresql://user:pass@old-host:5432/strapi"
export DATABASE_URL="postgresql://user:pass@new-host:5432/rok_m"

# Повна заміна бізнес-даних у новій БД:
pnpm migrate:from-strapi -- --truncate
```

Без `--truncate` — upsert (оновлення за `slug` / `email`, конфлікти пропускаються).

### 4. Перевірка

```bash
# кількість методик
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM methods;"
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM users;"
```

API:

```http
GET https://your-api.vercel.app/api/method-sections
GET https://your-api.vercel.app/api/pricing
```

---

## Варіант 2 — SQLite (локальний Strapi `.tmp/data.db`)

Strapi локально часто використовує **SQLite**. Прямого скрипта для SQLite немає — виберіть один із шляхів:

### A. Тимчасово підняти Strapi на Postgres і експортувати

1. Експортуйте prod Postgres з Render (якщо prod уже Postgres — використовуйте варіант 1).  
2. Локальний SQLite → підключіть Strapi до тимчасового Postgres, імпорт через адмінку / `migrateAllMethodics` / REST.

### B. Тільки контент з файлів (якщо БД порожня)

Якщо в Strapi не було унікальних змін у адмінці, а контент = `methodics-sections/`:

```bash
pnpm import:methodics
```

Користувачів і доступи — тоді лише з prod Postgres (варіант 1).

### C. Експорт через Strapi REST (старий сервер ще працює)

1. Запустіть старий Strapi (`legacy/strapi`, `pnpm develop`).  
2. Експортуйте JSON: `GET /api/method-sections?pagination[pageSize]=100&populate=methods` тощо.  
3. Напишіть one-off import у нову БД (або зверніться до `import:methodics` для контенту).

---

## Варіант 3 — Змішаний (найчастіший на практиці)

| Дані | Джерело |
|------|---------|
| Методики (750+) | `pnpm import:methodics` з git |
| Користувачі, доступи, ціни, feedback | `pnpm migrate:from-strapi` з prod Postgres |
| Admin | `pnpm db:seed` лише якщо немає admin у Strapi |

```bash
pnpm db:migrate
STRAPI_DATABASE_URL="..." DATABASE_URL="..." pnpm migrate:from-strapi -- --truncate
# якщо methods порожні після міграції — додатково:
pnpm import:methodics
```

---

## Мапінг полів (Strapi → нова схема)

- `document_id` / `documentId` → `document_id` (UUID; якщо немає — генерується новий)  
- `mak_cards_access` / `makCardsAccess` → `mak_cards_access`  
- `is_medium` / `isMedium` → `is_medium`  
- Blocks (`purpose`, `instruction`, …) → JSONB як є  
- `reflection_questions` (component) → з таблиць `methods_cmps` + `components_methods_reflection_questions`, якщо є  

Зв’язки Strapi 5 часто в таблицях `*_lnk` — скрипт намагається їх знайти автоматично.

---

## Типові проблеми

| Проблема | Рішення |
|----------|---------|
| SSL error до Render | `?sslmode=require` у URL або `ssl: { rejectUnauthorized: false }` (у скрипті вже є) |
| Дублікати slug/email | Запуск без `--truncate` робить upsert; з `--truncate` — чиста копія |
| 0 methods після міграції | Зв’язки в `*_lnk` — перевірте таблиці в Strapi; fallback: `import:methodics` |
| Паролі не працюють | Має копіюватися поле `password` з `up_users` (bcrypt); перевірте, що users імпортовані |
| ID змінились | Нормально; фронт використовує `documentId` / `slug`, не старі numeric id |

---

## Безпека

- Не зберігайте `STRAPI_DATABASE_URL` у репозиторії.  
- Робіть **backup** нової БД перед `--truncate`.  
- На production міграцію краще виконати в maintenance window.

Скрипт: `scripts/migrate-from-strapi.ts`  
Команда: `pnpm migrate:from-strapi`
