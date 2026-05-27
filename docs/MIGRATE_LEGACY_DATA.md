# Перенесення даних зі старої PostgreSQL у нову схему

Скрипт копіює дані з **попередньої CMS-схеми** (таблиці `up_users`, `*_lnk`, …) у таблиці Express + Sequelize.

## Що переноситься

| Стара таблиця | Нова таблиця | Примітка |
|---------------|--------------|----------|
| `up_roles` | `roles` | мапінг за `type` |
| `up_users` | `users` | паролі (bcrypt) зберігаються |
| `method_sections` | `method_sections` | `document_id`, publish |
| `methods` | `methods` | blocks → JSONB; зв’язок через FK або `*_lnk` |
| `user_method_sections` | `user_method_sections` | доступи / оплати |
| `pricings` | `pricings` | один запис |
| `feedbacks` | `feedbacks` | форма зв’язку |

**Не переноситься:** адмін-панель старого стеку, API tokens, неопубліковані чернетки, історія платежів (якщо її не було).

---

## Кроки (PostgreSQL → PostgreSQL)

### 1. URL старої БД

```bash
# Локально (приклад):
export LEGACY_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/rok_m_dev"
```

Не комітьте URL у git.

### 2. Нова порожня БД

Не запускайте `pnpm db:migrate` у тій самій БД, що й стара CMS — імена таблиць збігаються, структура різна.

```bash
createdb rok_m_new
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/rok_m_new"
pnpm db:migrate
```

### 3. Копіювання

```bash
pnpm migrate:legacy-db -- --truncate
```

Без `--truncate` — upsert за `slug` / `email`.

### 4. Контент з git (за потреби)

```bash
pnpm import:methodics
```

### 5. Перевірка

```bash
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM methods;"
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM users;"
```

---

## Змінні середовища

| Змінна | Опис |
|--------|------|
| `LEGACY_DATABASE_URL` | Джерело (стара PostgreSQL) |
| `DATABASE_URL` | Ціль (нова БД після `db:migrate`) |
| `OLD_DATABASE_URL` | Альтернативна назва для джерела |

Скрипт: `scripts/migrate-legacy-db.ts` · команда: `pnpm migrate:legacy-db`

---

## Типові проблеми

| Проблема | Рішення |
|----------|---------|
| SSL error | `?sslmode=require` у URL |
| 0 methods | `pnpm import:methodics` |
| Паролі не входять | Перевірте імпорт `up_users` → `users` |
| `method_section_id` does not exist при `db:migrate` | Окрема порожня БД, див. `docs/database.md` |
