> У цьому файлі наведено лише приклади заповнення readme.md, кожен пункт потрібно відредагувати під Ваш проєкт. Для якісного редагування readme.md файлу рекомендується [readme.so](https://readme.so/)

# 📘 ROK Mental Health — Backend API

> *REST API освітньої платформи психологічної підтримки ROK Mental Health: каталог методик, авторизація, платежі, прогрес користувача та адмін-панель.*

---

## 👤 Автор

- **ПІБ**: Прізвище Ім’я *(відредагуйте)*
- **Група**: ФЕІ-__ *(відредагуйте)*
- **Керівник**: Прізвище Ім’я, науковий ступінь, посада *(відредагуйте)*
- **Дата виконання**: [дд.мм.рррр]

---

## 📌 Загальна інформація

- **Тип проєкту**: REST API (backend) + статична адмін-панель
- **Мова програмування**: JavaScript (Node.js 18+, ES modules)
- **Фреймворки / Бібліотеки**: Express 4, Sequelize 6, PostgreSQL, JWT, Swagger UI, Redis (опційно)
- **Розгортання**: локально (`pnpm dev`) або serverless (Vercel — `api/index.js`)
- **Репозиторій**: `rok-m-backend`

---

## 🧠 Опис функціоналу

- 🔐 Реєстрація, логін, JWT, MFA, скидання пароля, інтеграція Supabase Auth
- 📚 Каталог розділів і методик (пошук, фільтр за симптоматикою, full-text search)
- ⭐ Обрані методики та МАК-картки
- 💳 Платежі (WayForPay / mock), активація тарифів і доступу до розділів
- 📈 Прогрес: історія переглядів матеріалів, збереження результатів тестів
- 📤 Presigned upload медіа (Supabase Storage / AWS S3)
- 🛠️ Адмін-панель: користувачі, ціни, контент, зворотний зв’язок
- 📖 OpenAPI-документація на `/api-docs`
- ⚡ Кеш каталогу (Redis або in-memory), read replica для читання

---

## 🧱 Опис основних класів / файлів

| Клас / Файл | Призначення |
|-------------|-------------|
| `src/server.js` | Точка входу — запуск HTTP-сервера локально |
| `api/index.js` | Точка входу Vercel serverless handler |
| `src/app.js` | Створення Express-додатку, middleware, підключення маршрутів |
| `src/routes/index.js` | Збірка всіх API-маршрутів під `/api` |
| `src/routes/auth.routes.js` | Маршрути авторизації та профілю |
| `src/routes/content.routes.js` | Публічний каталог методик і розділів |
| `src/controllers/*.controller.js` | HTTP-обробники запитів |
| `src/services/*.service.js` | Бізнес-логіка (auth, content, payments, …) |
| `src/models/index.js` | Ініціалізація Sequelize-моделей і зв’язків |
| `src/models/User.js` | Модель користувача |
| `src/models/Method.js` | Модель методики |
| `src/middlewares/auth.middleware.js` | Перевірка JWT / Supabase Bearer |
| `src/config/database.js` | Підключення PostgreSQL, пул з’єднань |
| `src/migrations/*.cjs` | Міграції схеми бази даних |
| `public/admin/` | Статична веб-адмін-панель |

---

## ▶️ Як запустити проєкт «з нуля»

### 1. Встановлення інструментів

- [Node.js 18+](https://nodejs.org) (рекомендовано LTS)
- [pnpm](https://pnpm.io/installation) (`npm install -g pnpm`)
- PostgreSQL — локально через Docker **або** хмарна БД (Neon / Supabase)

### 2. Клонування репозиторію

```bash
git clone https://github.com/your-user/rok-m-backend.git
cd rok-m-backend
```

### 3. Встановлення залежностей

```bash
pnpm install
```

### 4. Створення `.env` файлу

```bash
cp .env.example .env
```

Мінімальний приклад для локальної розробки:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/rok_m_dev
JWT_SECRET=change-me-in-production
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

Опційно: `REDIS_URL`, `SUPABASE_JWT_SECRET`, `WAYFORPAY_MERCHANT_SECRET`, `BREVO_API_KEY`.

### 5. База даних і перший запуск

```bash
# Перший раз: Docker (якщо немає хмарної DATABASE_URL) + міграції + seed
pnpm start:here

# Або вручну:
pnpm docker:up          # лише для локальної БД
pnpm db:setup           # migrate + seed (ролі, ціни, адмін)
pnpm dev                # сервер з hot-reload
```

### 6. Перевірка

| Що | URL |
|----|-----|
| Адмін-панель | http://localhost:3000/admin |
| API | http://localhost:3000/api |
| Swagger | http://localhost:3000/api-docs |
| Health | http://localhost:3000/health |

**Тестовий адмін** (після `pnpm db:seed`):  
`admin@rok-mentalhealth.local` / `Admin123!ChangeMe`

### 7. Тести

```bash
pnpm test
```

---

## 🔌 API приклади

Базовий шлях: `http://localhost:3000/api`  
Повний контракт — у Swagger: `/api-docs`.

### 🔐 Авторизація

**POST /api/auth/register**

```json
{
  "email": "user@example.com",
  "username": "user123",
  "password": "securePass1"
}
```

**POST /api/auth/local**

```json
{
  "identifier": "user@example.com",
  "password": "securePass1"
}
```

**Response:**

```json
{
  "jwt": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "username": "user123"
  }
}
```

**GET /api/auth/me** — профіль (заголовок `Authorization: Bearer <jwt>`).

---

### 📚 Каталог методик

**GET /api/method-sections** — список розділів.

**GET /api/methods** — список методик.

**GET /api/methods?symptom=тривога** — фільтр за симптоматикою.

**GET /api/methods/search?q=дихання** — пошук (FTS).

**GET /api/methods/:id** — одна методика (id або slug).

**GET /api/pricing** — актуальні ціни тарифів.

---

### ⭐ Обране (потрібен JWT)

**GET /api/methods/favorites**

**POST /api/methods/favorites**

```json
{
  "methodId": 42
}
```

---

### 📈 Прогрес (потрібен JWT)

**POST /api/progress/methods/:methodId/view** — зафіксувати перегляд.

**GET /api/progress/me** — історія переглядів.

**POST /api/progress/tests** — зберегти результат тесту.

---

### 💬 Зворотний зв’язок

**POST /api/feedback**

```json
{
  "name": "Олена",
  "email": "olena@example.com",
  "message": "Питання щодо тарифу",
  "tariff": "premium"
}
```

---

## 🖱️ Інструкція для користувача (адмін-панель)

1. Відкрийте **http://localhost:3000/admin** (або головну `/` — редірект на адмінку).
2. Увійдіть обліковими даними адміністратора.
3. У панелі можна:
   - переглядати та обробляти звернення (feedback);
   - керувати цінами тарифів;
   - переглядати користувачів і змінювати тариф;
   - додавати та редагувати розділи і методики.
4. Клієнтський фронтенд (SPA) працює через REST API з JWT у заголовку `Authorization`.

---

## 📷 Приклади / скриншоти

- Головна сторінка / адмін-панель
- Swagger UI (`/api-docs`)
- Список методик у API-відповіді

*(додайте зображення у папку `/screenshots/`)*

---

## 🧪 Проблеми і рішення

| Проблема | Рішення |
|----------|---------|
| `DATABASE_URL is required` | Заповніть `.env`, запустіть `pnpm db:setup` |
| Порт 3000 зайнятий | Змініть `PORT` у `.env` або зупиніть інший процес |
| `EADDRINUSE` / не стартує сервер | `lsof -i :3000 -sTCP:LISTEN -t \| xargs kill` |
| 401 Unauthorized | Перевірте JWT у заголовку `Authorization: Bearer ...` |
| CORS помилка | Додайте origin фронтенду в `CORS_ORIGINS` |
| Міграція падає на старій БД | Створіть окрему порожню БД (`pnpm db:prepare-new`) |
| Повільний cold start на Vercel | Перший `/api/*` ініціалізує БД; pool `max=1` на serverless |

---

## 🧾 Використані джерела / література

- [Express.js](https://expressjs.com/) — офіційна документація
- [Sequelize](https://sequelize.org/) — ORM для PostgreSQL
- [PostgreSQL](https://www.postgresql.org/docs/) — документація СУБД
- [JWT.io](https://jwt.io/) — JSON Web Tokens
- [OpenAPI / Swagger](https://swagger.io/specification/)
- [Vercel Serverless Functions](https://vercel.com/docs/functions)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [WayForPay API](https://wiki.wayforpay.com/)

---

## 📎 Додаткова документація (диплом)

| Файл | Зміст |
|------|--------|
| `docs/ДОДАТОК_A_блок_схема.md` | Основний код backend |
| `docs/ДОДАТОК_B_ERD_база_даних.md` | ERD, індекси, SQL |
| `docs/UML_структура_проекту.md` | UML-діаграми (PlantUML / Mermaid) |
| `docs/rok-m-backend-structure.puml` | Діаграма компонентів |
| `docs/rok-m-vercel-deployment.puml` | Deployment Client → Vercel → Express → PostgreSQL |

---

## Screenshots

<!-- Додайте скриншоти:
![Admin panel](./screenshots/admin.png)
![Swagger](./screenshots/swagger.png)
-->
