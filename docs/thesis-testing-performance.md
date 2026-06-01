# Тестування серверної частини та аналіз продуктивності

Матеріал для дипломної роботи: гібридний serverless backend (Express.js + Sequelize + PostgreSQL + Vercel Functions).

**Стек:** Node.js, Express, Sequelize, PostgreSQL (BaaS), JWT, Jest/Supertest, autocannon.

---

## 1. Мета та обсяг дослідження

Мета цього розділу — підтвердити, що серверна частина:

1. **коректно реалізує бізнес-логіку** (авторизація, контент, оплати, прогрес, адмін);
2. **стійка до типових навантажень** освітньої платформи (read-heavy каталог  + окремі write-операції);
3. **придатна до serverless-деплою** (Vercel) з урахуванням cold start, pooling і обмежень BaaS PostgreSQL.

Дослідження поєднує **функціональне інтеграційне тестування** та **навантажувальне тестування** з **архітектурним аналізом** serverless-моделі.

---

## 2. Функціональне тестування

### 2.1. Стек і підхід

| Інструмент | Роль |
|------------|------|
| **Jest** | test runner |
| **Supertest** | HTTP-запити до Express `app` без окремого процесу |
| **PostgreSQL (test DB)** | реальна БД, не моки ORM |

Тести перевіряють повний ланцюжок: `routes → controllers → services → Sequelize → PostgreSQL`.

### 2.2. Структура тестів

| Файл | Що перевіряє |
|------|----------------|
| `tests/auth.test.js` | реєстрація, логін, `/me`, валідація, 401 |
| `tests/materials.test.js` | method-sections, фільтр methods, pricing, MAK favorites |
| `tests/users.test.js` | user-method-sections, feedback |
| `tests/progress.test.js` | запис перегляду, історія |
| `tests/admin.test.js` | 401/403, admin pricing/feedbacks |
| `tests/payments.test.js` | `payment_required`, confirm + grant, 401 без JWT |
| `tests/thesis-features.test.js` | MFA, full-text search, presign, Supabase sync |
| `tests/swagger.test.js` | OpenAPI `/api-docs.json` |
| `tests/load-routes.test.js` | probe routes для load-тестів |

Допоміжні файли: `tests/setup.js`, `tests/helpers.js` (підняття app, seed, login).

### 2.3. Запуск

```bash
createdb rok_m_test
export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/rok_m_test
pnpm test
```

Тестова БД ініціалізується через `sequelize.sync({ force: true })` + seed у `helpers.js` — достатньо для CI та локальної перевірки API-контрактів.

### 2.4. Результати (автоматизовані)

При доступній PostgreSQL:

- **9 test suites, 35 tests — усі passed**
- Покрито: auth, контент, користувацькі розділи, progress, admin, payment flow (mock confirm), thesis-features (MFA/search/presign), Swagger

CI: `.github/workflows/ci.yml` (GitHub Actions + Postgres service).

### 2.5. Що підтверджено тестами

| Категорія | Сценарії |
|-----------|----------|
| Auth | JWT, 401 без токена, 400 при невалідній реєстрації |
| Контент | список секцій, фільтр methods, pricing |
| Доступ | user-method-sections (auth), MAK favorites toggle |
| Оплата | `payment_required` → confirm → `isMedium` / status |
| Admin | заборона без ролі admin, доступ з admin JWT |
| Безпека оплат | confirm без JWT → 401; confirm лише для власника orderReference |

### 2.6. Обмеження функціонального покриття

Не автоматизовано (рекомендовано для демо захисту вручну):

- premium tariff end-to-end;
- assign section + admin manual confirm;
- email-коди (Brevo/SendGrid);
- повний admin CRUD контенту.

---

## 3. Класифікація ендпоінтів за навантаженням

| Ендпоінт | Тип | Навантаження на БД |
|---------|-----|-------------------|
| `GET /api/method-sections` | read-heavy | pagination, optional include |
| `GET /api/methods?filters[...]` | read-heavy | фільтрація + pagination |
| `GET /api/pricing` | read-heavy | один рядок |
| `GET /api/auth/me` | read-heavy | user + role + joins |
| `POST /api/progress/.../view` | write | findOrCreate + update |
| `POST /api/tariffs/*/activate` | mixed | pricing read → pending payment |
| `POST /api/payments/confirm` | transactional | grants + bulk sections |
| `GET /api/payments/status` | read | перевірка доступу |
| Admin API | mixed | нижчий RPS, ніж каталог |

**Модель освітньої платформи:** ~95% reads / ~5% writes (перегляди, feedback, confirm).

![Read/write mix](images/read-heavy-mix.svg)

---

## 4. Навантажувальне тестування (autocannon)

### 4.1. Методологія

- Інструмент: **autocannon** (мінімальні накладні витрати, Node.js).
- Середовище: локальний API + PostgreSQL (у прикладах нижче — `LOAD_BASE_URL=http://localhost:1337`).
- Параметри за замовчуванням: `connections=25–80`, `duration=15–20s`, `pipelining=1`.
- Метрики: **req/s (avg)**, **latency avg / p50 / p99**, помилки/non-2xx.

> Результати залежать від CPU, розміру БД, наявності індексів і того, чи warm instance вже ініціалізував Sequelize. Нижче — **реальні знімки** одного прогону в репозиторії.

### 4.2. Скрипти (`tests/load/`)

| Команда | Скрипт | Сценарій |
|---------|--------|----------|
| `pnpm load:content` | `content-load.js` | каталог + фільтр |
| `pnpm load:auth` | `auth-load.js` | POST `/api/auth/local` |
| `pnpm load:progress` | `progress-load.js` | запис перегляду (JWT) |
| `pnpm load:payments` | `payments-load.js` | activate + confirm + status |
| `pnpm load:peak` | `peak-load.js` | пікове read-heavy (95/5) |

Змінні:

```bash
LOAD_BASE_URL=http://localhost:3000
LOAD_DURATION_SEC=30
LOAD_CONNECTIONS=100
LOAD_USER_EMAIL=loadtest@example.com
LOAD_USER_PASSWORD=password123
LOAD_METHOD_ID=1
```

Підготовка:

```bash
pnpm docker:up   # або локальний Postgres
pnpm db:migrate && pnpm db:seed
pnpm dev         # або pnpm start
```

### 4.3. Сценарії навантаження

| Сценарій | Параметри | Мета |
|----------|-----------|------|
| A. Нормальне | connections=25, 20s | щоденне користування |
| B. Пік (навчальний) | connections=80–200 | іспит/реліз матеріалів |
| C. Burst | кілька скриптів поспіль | короткий сплеск |
| D. Авторизовані | progress, payments | JWT + write |
| E. Read-heavy 95/5 | `load:peak` | модель каталогу |

---

## 5. Результати бенчмарків (локальний прогін)

### 5.1. Контент

![Autocannon: content](images/autocannon-content.png)

| Ендпоінт | connections | duration | req/s avg | latency avg | p50 | p99 |
|----------|-------------|----------|-----------|-------------|-----|-----|
| `GET /api/method-sections` | 30 | 15.05s | **2597.7** | 11ms | 10ms | 36ms |
| `GET /api/methods` (filter) | 30 | 15.01s | **529.7** | 56ms | 54ms | 78ms |

**Висновок:** список секцій значно швидший за запит із фільтром по `slug` (додаткове навантаження на WHERE + індекс).

### 5.2. Авторизація

![Autocannon: auth](images/autocannon-auth.png)

| Ендпоінт | connections | duration | req/s avg | latency avg | p50 | p99 |
|----------|-------------|----------|-----------|-------------|-----|-----|
| `POST /api/auth/local` | 20 | 15.02s | **4126.9** | 4ms | 4ms | 10ms |

> Примітка: при високому RPS на логіні домінує черга до bcrypt/БД; для «шторму логінів» bottleneck — **CPU (bcrypt)**. У production варто rate limiting / черга.

### 5.3. Пікове read-heavy навантаження

![Peak load](images/peak-load.png)

| Підсценарій | connections | duration | req/s avg | latency avg | p99 |
|-------------|-------------|----------|-----------|-------------|-----|
| method-sections | 80 | 11.01s | 2306.3 | 34ms | 95ms |
| methods filter | 80 | 6.01s | 474.8 | 166ms | 258ms |
| pricing | 80 | 2.01s | 3599.5 | 22ms | 173ms |
| progress view (write) | 80 | 1.01s | 719.0 | 107ms | 201ms |

**Висновок:** під високою конкуренцією (80 з’єднань) найповільніші — **фільтровані read-запити** та **write progress**; pricing і списки секцій залишаються прийнятними для thesis/demo масштабу.

### 5.4. Vercel / production metrics

![Vercel metrics — замінити реальним скріншотом](images/vercel-metrics.png)

#### Як наповнити графіки штучним навантаженням

1. Задеплой на **Vercel Preview** (або Production).
2. У Vercel → **Settings → Environment Variables** (Preview):
   - `ENABLE_LOAD_TEST_ROUTES=true` — ендпоінти для CPU/Memory/Errors (прибрати після знімків).
3. Локально запусти генератор:

```bash
LOAD_BASE_URL=https://your-app.vercel.app \
LOAD_DURATION_SEC=300 \
LOAD_CONNECTIONS=60 \
LOAD_BURST_CONNECTIONS=120 \
LOAD_IDLE_SEC=600 \
ENABLE_LOAD_TEST_ROUTES=true \
pnpm load:vercel-metrics
```

4. Через **1–5 хв** відкрий **Vercel → Project → Observability** (або Analytics на Pro).

| Метрика Vercel | Що генерує скрипт |
|----------------|-------------------|
| Function Invocations | read burst + auth + writes |
| Function Duration / Latency | mix `/api/method-sections`, filters, progress |
| Active CPU | `POST /api/auth/local` (bcrypt) + `/load-test/cpu` |
| Memory Usage | burst + `/load-test/memory` |
| Errors | `/load-test/simulate-error` (500) |
| Cold Starts | `LOAD_IDLE_SEC=600` → пауза → одиночні probes → burst |

**Cold starts:** Vercel тримає instances warm кілька хвилин; для видимих cold starts — `LOAD_IDLE_SEC=600` (10 хв) або повторити скрипт наступного дня.

#### Hobby (Free) plan — обмеження та обхід 403

На безкоштовному плані **немає доступу до Security/Firewall**. Після агресивного load test (~900 req/s) Vercel увімкне **Attack Challenge Mode** (HTTP 403) — це не баг API.

| Варіант | Дія |
|---------|-----|
| **Мʼякий load test** | `LOAD_GENTLE=true pnpm load:vercel-metrics` (≤15 req/s, ~10 хв) |
| **Інший IP** | mobile hotspot / інший Wi‑Fi після 30–60 хв паузи |
| **Runtime Logs** | Vercel → Deployments → Logs (є на Hobby) |
| **autocannon локально** | `docs/images/*.png` — основні графіки latency для диплому |
| **Перший прогон** | часткові метрики в Observability до блокування |

```bash
LOAD_BASE_URL=https://rok-m-backend.vercel.app LOAD_GENTLE=true pnpm load:vercel-metrics
```

**Якщо локальний IP у 403 (Hobby Attack Challenge):** GitHub → **Actions** → **Vercel gentle load** → **Run workflow**. Навантаження йде з IP GitHub, не з твого Mac.

Для захисту додайте скріншот з **Vercel → Observability**:

- p50/p95 latency функції;
- cold start / init (якщо доступно);
- memory;
- помилки підключення до БД.

---

## 6. Serverless-архітектура та продуктивність

### 6.1. Життєвий цикл запиту

![Serverless lifecycle](images/serverless-lifecycle.svg)

1. **Vercel** викликає `api/index.js`.
2. **Warm instance:** повторно використовується кешований Express (`createApp()`).
3. Перший запит на `/api/*` — **lazy DB init** (`initDatabase()` + `initModels()`).
4. **Sequelize singleton** + обмежений pool (`pool.max` менший на Vercel).
5. Відповідь чекає `res.finish` (коректно для serverless).

### 6.2. Чому singleton і lazy init

| Патерн | Ефект |
|--------|-------|
| `appReady` / `dbInitPromise` | не дублювати ініціалізацію на warm invocation |
| Lazy DB лише для `/api` | `/health` швидкий без PostgreSQL |
| `pool.max ≈ 1` на Vercel | менше ризику вичерпати connections при autoscale |

### 6.3. Cold start

Вимірювати окремо:

- `GET /health` — без БД (baseline);
- `GET /api/pricing` — з ініціалізацією Sequelize.

На Vercel порівняти перший запит після idle vs steady-state.

### 6.4. Обмеження serverless (для тези)

- Кожен concurrent instance → власний pool → **ризик connection storm** до Postgres.
- Рішення: **Neon/Supabase pooler**, `DATABASE_POOL_MAX=1`, без важких sync на cold path.
- In-memory lock (MAK favorites) — **не розподіляється** між instances (прийнятно для диплома; для prod — Redis).

---

## 7. Продуктивність бази даних

### 7.1. Індекси (з міграції)

| Таблиця | Індекс | Призначення |
|---------|--------|-------------|
| users | email, username | логін |
| method_sections | slug, published_at | каталог |
| methods | slug, method_section_id, published_at | списки, фільтри |
| user_method_sections | UNIQUE (user_id, method_section_id) | доступ |
| material_views | (user_id, method_id), viewed_at | progress |

### 7.2. Патерни Sequelize

- `findAndCountAll` + **`distinct: true`** при join (точний count).
- Brief `attributes` на include (менше overfetch).
- Транзакції в `payments.service.js` при наданні доступу.
- Batch-оновлення секцій для Medium/Premium (без N+1 у циклі).

### 7.3. Read-heavy оптимізація

- Фільтр `published_at IS NOT NULL`.
- Опційно `DATABASE_READ_REPLICA_URL` для каталогу (конфіг у `database.js`).
- Майбутнє (теоретично): CDN/Redis для `GET /method-sections` без зміни API.

---

## 8. Масштабованість

### 8.1. Що масштабується добре

- Stateless API (JWT) — горизонтально через Vercel autoscale.
- Read-heavy каталог — репліки + кеш (майбутнє).
- Транзакційні оплати — обмежені write, передбачувані.

### 8.2. Вузькі місця

| Bottleneck | Причина | Мітигація |
|------------|---------|-----------|
| PostgreSQL connections | N instances × pool | pooler, max=1 |
| Cold start | import + Sequelize init | lazy init, мінімум deps |
| Login RPS | bcrypt | rate limit, окремий auth-сервіс (майбутнє) |
| Filtered reads | WHERE + join | індекси, репліки |

### 8.3. Цільові рівні (орієнтири для експерименту)

| «Користувачі» (concurrent connections) | Що перевіряти |
|----------------------------------------|----------------|
| 100 | `load:peak`, стабільність latency p99 |
| 500 | зростання latency на methods filter |
| 1000 | помилки БД / timeouts (якщо з’являться) |

У serverless «1000 users» ≈ concurrent requests across instances; **ліміт — БД**, не Express.

---

## 9. Висновки для дипломної роботи

1. **Гібрид serverless + BaaS PostgreSQL** зменшує DevOps-навантаження і дає autoscale; ціною є cold start і connection management.
2. **Express.js** достатній для REST API thesis-масштабу: низькі накладні витрати, зрозуміла структура шарів.
3. **Sequelize** прийнятний за умови singleton, lazy init і обмеженого pool; overhead компенсується простотою розробки.
4. **PostgreSQL** відповідає read-heavy каталогу (індекси, транзакції для paid access).
5. **Функціональні тести (22)** підтверджують коректність контрактів; **autocannon** — відтворювані метрики для розділу продуктивності.
6. **Головне обмеження production:** connection limits + cold start; **pooler обов’язковий** для реального трафіку.

---

## 10. Додаткові матеріали в репозиторії

| Шлях | Зміст |
|------|--------|
| `docs/testing.md` | коротка довідка з тестів |
| `docs/performance-report.md` | методологія (англ., для розробників) |
| `docs/images/*.png` | скріншоти бенчмарків |
| `tests/load/` | скрипти autocannon |
| `docs/architecture.md` | загальна архітектура |
| `docs/database.md` | ERD, індекси |

**Повторення бенчмарків:**

```bash
pnpm start   # або pnpm dev
LOAD_BASE_URL=http://localhost:3000 pnpm load:content
```

---

*Документ згенеровано для дипломного проєкту rok-m-backend. Оновлюйте таблиці в §5 після нових прогонів autocannon.*
