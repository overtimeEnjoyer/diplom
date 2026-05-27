# Проєктування бази даних

## Окрема БД для нового backend (важливо)

**Не** запускайте `pnpm db:migrate` у тій самій PostgreSQL-базі, де лишилась **стара CMS-схема** (`up_users`, `methods` без `method_section_id`).

| База | Призначення |
|------|-------------|
| `rok_m_dev` (або стара) | Джерело: `LEGACY_DATABASE_URL` для `pnpm migrate:legacy-db` |
| `rok_m_new` (нова, порожня) | Ціль: `DATABASE_URL` → `pnpm db:migrate` + API |

```bash
createdb rok_m_new
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/rok_m_new"
pnpm db:migrate
pnpm db:seed

export LEGACY_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/rok_m_dev"
pnpm migrate:legacy-db -- --truncate
```

Помилка `column "method_section_id" does not exist` означає, що міграцію запустили в БД зі старою схемою.

---

## ERD

```mermaid
erDiagram
    roles ||--o{ users : has
    users ||--o{ user_method_sections : purchases
    method_sections ||--o{ user_method_sections : ""
    method_sections ||--o{ methods : contains
    users ||--o{ material_views : views
    methods ||--o{ material_views : ""

    roles {
        int id PK
        string type UK
    }
    users {
        int id PK
        uuid document_id UK
        string email UK
        boolean mak_cards_access
        boolean is_medium
        boolean is_premium
        jsonb mak_favorite_card_ids
    }
    method_sections {
        int id PK
        uuid document_id UK
        string slug UK
        timestamp published_at
    }
    methods {
        int id PK
        uuid document_id UK
        string slug UK
        int method_section_id FK
        jsonb purpose
    }
    user_method_sections {
        int id PK
        int user_id FK
        int method_section_id FK
        boolean is_paid
    }
    pricings {
        int id PK
        int medium_price
    }
    feedbacks {
        int id PK
        boolean is_processed
    }
    material_views {
        int id PK
        int user_id FK
        int method_id FK
        timestamp viewed_at
    }
```

## Таблиці

### users

Користувачі платформи. Пароль — bcrypt. Тарифні прапорці та JSON favorites для МАК-карток.

### method_sections / methods

Освітні розділи та матеріали (методики). Rich content у JSONB (`purpose`, `instruction`, …). `published_at` — чернетка / опубліковано (null = не показувати).

### user_method_sections

Зв’язок many-to-many з атрибутом `is_paid` (оплата окремого розділу або bulk через Medium/Premium).

### pricings

Single-row (перший запис) — ціни для UI та WayForPay.

### material_views

Історія переглядів (нова сутність для дослідження progress/read-heavy).

## Індекси

| Таблиця | Індекс | Навіщо |
|---------|--------|--------|
| users | email, username | логін, унікальність |
| method_sections | slug, published_at | фільтрація публічного каталогу |
| methods | slug, method_section_id, published_at | списки + populate |
| user_method_sections | (user_id, method_section_id) UNIQUE | швидка перевірка доступу |
| material_views | (user_id, method_id), viewed_at | історія переглядів |
| feedbacks | is_processed | адмін-черга |

## Масштабування

1. **Connection pooling** — Neon/Supabase pooler або PgBouncer; у Sequelize `pool.max` налаштований консервативно для serverless.
2. **Read replicas** — `DATABASE_READ_REPLICA_URL`; read-only запити каталогу через `getReadSequelize()`.
3. **Кеш** (майбутнє) — CDN/Redis для `GET /method-sections` без зміни API.
4. **Партиціонування** — `material_views` за `viewed_at` при великих обсягах.

## Міграції

Файл: `src/migrations/20260526100000-init-schema.cjs`  
Seed: `src/seeders/20260526100001-roles-pricing.cjs`, `20260526100002-admin-user.cjs`

---

## Робота з базою даних через Sequelize

### Підключення

- Конфіг: `src/config/database.js`, змінні — `DATABASE_URL`, pool, SSL.
- **Singleton** `getSequelize()` — одне підключення на warm instance Vercel.
- **Read replicas:** `DATABASE_READ_REPLICA_URL` (через кому) → `replication: { read, write }` у Sequelize; read-запити каталогу йдуть на репліки автоматично.

### Моделі та зв’язки

- Файли: `src/models/*.js`, реєстрація в `src/models/index.js`.
- `camelCase` у коді ↔ `snake_case` у PostgreSQL (`field: 'document_id'`).
- **JSONB** — контент методик, MAK-favorites.
- **Associations** — `MethodSection.hasMany(Method)`, `User` ↔ `UserMethodSection`, тощо.

### Шар доступу

```
controller → service → getModels() → Model.findOne / create / update
```

Паролі приховані **defaultScope** на `User`; для логіну — `User.unscoped()`.

### Транзакції

Операції надання доступу після оплати (`payments.service.js`) виконуються в `sequelize.transaction()` — атомарне оновлення `users` і `user_method_sections`.

### CLI

| Команда | Дія |
|---------|-----|
| `pnpm db:migrate` | схема |
| `pnpm db:seed` | ролі, ціни, admin |
| `pnpm import:methodics` | контент (Sequelize upsert) |

У production **не** використовується `sync()` — лише міграції.
