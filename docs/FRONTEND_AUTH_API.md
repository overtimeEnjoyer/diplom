# Auth API — інструкція для фронтенду

## Як підключитися до бекенду

### 1. URL бекенду

- **Локально:** бекенд запускається на `http://localhost:1337`
- **API-префікс:** усі ендпоінти починаються з `http://localhost:1337/api`

На фронті краще винести базовий URL в змінну оточення, щоб на прод підставити інший домен:

```env
# .env (React / Vite / Next тощо)
VITE_API_URL=http://localhost:1337
# або NEXT_PUBLIC_API_URL=... / REACT_APP_API_URL=...
```

У коді:

```ts
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:1337';
// запити: `${API_URL}/api/auth/register`, `${API_URL}/api/auth/local` тощо
```

### 2. Що має бути зроблено на бекенді

- Бекенд запущений: у папці проєкту `pnpm develop` (або `npm run develop`).
- CORS: за замовчуванням дозволено тільки **`http://localhost:3000`**. Якщо фронт на іншому порту (наприклад 5173) або домені — бекенд-розробник має додати його в `config/middlewares.ts`:

```ts
// config/middlewares.ts — на бекенді
{
  name: 'strapi::cors',
  config: {
    enabled: true,
    origin: ['http://localhost:3000', 'http://localhost:5173'], // додати свій URL
  },
},
```

### 3. Приклад запиту з фронту (fetch)

Усі auth-запити — **POST**, тіло — **JSON**.

```ts
const res = await fetch(`${API_URL}/api/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    username: 'myuser',
    password: 'password123',
  }),
});
const data = await res.json();
if (!res.ok) {
  // data.error?.message або data.message — текст помилки
  throw new Error(data.error?.message || data.message || 'Request failed');
}
// успіх: data.jwt, data.user (реєстрація) або data.ok (інші)
```

Після реєстрації, логіну або verify-code зберігай `data.jwt` і для захищених запитів додавай заголовок:

```ts
headers: {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${jwt}`,
}
```

---

## CORS (деталі)

За замовчуванням дозволено тільки `http://localhost:3000`.  
Якщо фронт на іншому порту/домені — бекенд має додати його в `config/middlewares.ts` (cors.origin), інакше браузер заблокує запити.

---

## 1. Реєстрація (одразу повертає JWT)

**POST** `/api/auth/register`

**Body:**
```json
{
  "email": "user@example.com",
  "username": "username",
  "password": "password123"
}
```

**Валідація:** username ≥ 3 символи, password ≥ 6 символів. Підтвердження email не потрібне.

**Успіх (200):**
```json
{
  "jwt": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "documentId": "xxx",
    "username": "username",
    "email": "user@example.com",
    "confirmed": true,
    "blocked": false,
    "provider": "local"
  }
}
```

**Що робити:** зберегти `jwt` і вважати користувача залогіненим (редирект у додаток тощо).

**Помилки (400):**  
- "Email, username and password are required"  
- "User with this email or username already exists"  
- "Username must be at least 3 characters"  
- "Password must be at least 6 characters"

---

## 2. Логін

Стандартний Strapi-ендпоінт:

**POST** `/api/auth/local`

**Body:**
```json
{
  "identifier": "user@example.com",
  "password": "password123"
}
```

**identifier** — email або username.

**Успіх (200):** `{ "jwt": "...", "user": { ... } }` — зберігати `jwt` і використовувати в `Authorization: Bearer <jwt>`.

---

## 3. Забув пароль — запит коду на email

**POST** `/api/auth/password/request-code`

**Body:**
```json
{
  "email": "user@example.com"
}
```

**Успіх (200):** `{ "ok": true }` (завжди, з міркувань безпеки).

Показати екран введення коду з листа та нового пароля, потім викликати **password/reset**. Код на email використовується **тільки для скидання пароля**, не для підтвердження реєстрації.

---

## 4. Скидання пароля за кодом

**POST** `/api/auth/password/reset`

**Body:**
```json
{
  "email": "user@example.com",
  "code": "123456",
  "password": "newPassword123"
}
```

**Валідація:** password ≥ 6 символів.

**Успіх (200):**
```json
{
  "ok": true,
  "message": "Password has been reset"
}
```

**Помилки (400):**  
- "Email, code and password are required"  
- "Password must be at least 6 characters"  
- "Invalid email or code"  
- "No pending password reset for this email"  
- "Code expired"  
- "Invalid code"

Код дійсний **10 хвилин**.

---

## 5. Поточний користувач і оновлення профілю

**GET** `/api/auth/me` — отримати профіль поточного користувача (ендпоінт з розширення users-permissions).

**Заголовок:** `Authorization: Bearer <jwt>` (обов’язково).

**Успіх (200):** тіло з полями `id`, `documentId`, `username`, `email`, `confirmed`, `blocked`, `provider`, `role`, `createdAt`, `updatedAt`.

---

**POST** `/api/auth/profile` — оновити профіль поточного користувача (тільки свій акаунт; ендпоінт з розширення users-permissions).

**Заголовок:** `Authorization: Bearer <jwt>` (обов’язково).

**Body (будь-яке поєднання полів):**
```json
{
  "username": "newusername",
  "email": "new@example.com",
  "password": "newPassword123"
}
```

**Валідація:** username ≥ 3 символи, email валідний, password ≥ 6 символів (якщо передано).

**Успіх (200):** оновлений об’єкт користувача (без пароля).

**Помилки (400):** "Username already taken", "Email already taken", "Username must be at least 3 characters" тощо. **401** — немає або невалідний JWT.

На фронті використовуй саме цей ендпоінт для форми «Редагувати профіль» — користувач може змінювати лише свої дані.

---

## Налаштування пошти на бекенді (код для скидання пароля)

Щоб листи з кодом **реально відправлялись**, на бекенді має бути налаштована пошта. **Рекомендовано:** SendGrid через HTTP API (не SMTP) — працює на Render, де порт 587 часто блокують. Достатньо змінних `SENDGRID_API_KEY` або `EMAIL_SMTP_PASS` (SendGrid API key) та `EMAIL_FROM`. Якщо API key задано, бекенд автоматично використовує SendGrid API замість SMTP.

Альтернатива (SMTP): `EMAIL_SMTP_HOST`, `EMAIL_SMTP_PORT`, `EMAIL_SMTP_USER`, `EMAIL_SMTP_PASS`, `EMAIL_FROM`. При "Connection timeout" варто перейти на SendGrid API (змінні вище).

| Змінна | Опис |
|--------|------|
| `SENDGRID_API_KEY` або `EMAIL_SMTP_PASS` | SendGrid API key |
| `EMAIL_FROM` | Адреса відправника |

- **Локально:** додай їх у `.env` у корені проєкту бекенду.
- **Render:** у Web Service → Environment додай ці змінні (значення з SendGrid, Gmail тощо).

Якщо змінні порожні або невалідні, ендпоінт **POST /api/auth/password/request-code** все одно поверне **200** (з міркувань безпеки), але лист не полетить. У логах Strapi з’явиться: `RequestPasswordCode: email send failed — check EMAIL_SMTP_* env`.

**Фронт:** після відправки форми «Забули пароль» потрібно робити саме **POST** на бекенд, наприклад  
`POST ${API_URL}/api/auth/password/request-code` з тілом `{ "email": "user@example.com" }`. Запит на саму сторінку (GET `/auth/forgot-password`) листи не відправляє — це лише відкриття форми.

---

## Схема флоу

### Реєстрація (без підтвердження email)
1. Форма: email, username, password → **POST /api/auth/register**
2. У відповіді одразу `jwt` + `user` → вважати залогіненим, зберегти JWT

### Логін
1. Форма: identifier (email/username) + password → **POST /api/auth/local**
2. Отримали `jwt` + `user` → зберегти JWT

### Забув пароль (код тільки тут)
1. Форма: email → **POST /api/auth/password/request-code**
2. Екран: email (можна показати readonly) + код + новий пароль
3. **POST /api/auth/password/reset** з email, code, password
4. Показати успіх і перехід на логін

---

## Захищені запити

Після логіну для будь-якого захищеного запиту до Strapi додавати заголовок:

```
Authorization: Bearer <jwt>
```

При 401 — видалити JWT і перенаправити на логін.

---

## Форма зворотного зв'язку

**POST** `/api/feedback`

Надсилання даних форми зворотного зв'язку (ім'я, повідомлення, email, опційно тариф). Лист відправляється на пошту, задану в `FEEDBACK_EMAIL` (або `EMAIL_FROM`) на бекенді. Для відправки потрібен **SendGrid**: у `.env` має бути `SENDGRID_API_KEY`.

**Body:**
```json
{
  "name": "Ім'я та Прізвище",
  "message": "Текст повідомлення від користувача",
  "email": "user@example.com",
  "tariff": "Назва тарифу (опційно)"
}
```

| Поле      | Обов'язкове | Валідація                    |
|-----------|-------------|------------------------------|
| name      | так         | мін. 2 символи               |
| message   | так         | мін. 10 символів             |
| email     | так         | валідний email                |
| tariff    | ні          | рядок (наприклад вибраний тариф) |

**Успіх (200):**
```json
{
  "ok": true,
  "message": "Повідомлення надіслано"
}
```

**Помилки (400):** повідомлення українською (наприклад "Ім'я та прізвище обов'язкові (мін. 2 символи)").

**Приклад з фронту:**
```ts
const res = await fetch(`${API_URL}/api/feedback`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: formData.name,
    message: formData.message,
    email: formData.email,
    tariff: formData.tariff || undefined, // опційно
  }),
});
```

**Бекенд (.env):** вказати `FEEDBACK_EMAIL` — куди приходитимуть листи (наприклад `admin@yoursite.com`). Для SendGrid також потрібен `SENDGRID_API_KEY`.

---

## Підсумок ендпоінтів

| Дія               | Method | URL                              | Auth |
|-------------------|--------|-----------------------------------|------|
| Реєстрація        | POST   | /api/auth/register                | Ні   |
| Логін             | POST   | /api/auth/local                   | Ні   |
| Профіль (мене)    | GET    | /api/auth/me                      | JWT  |
| Оновити профіль   | POST   | /api/auth/profile                 | JWT  |
| Код для скидання  | POST   | /api/auth/password/request-code   | Ні   |
| Скинути пароль    | POST   | /api/auth/password/reset          | Ні   |
| Зворотний зв'язок | POST   | /api/feedback                    | Ні   |

Ендпоінти `/api/auth/email/request-code` та `/api/auth/email/verify-code` залишені для сумісності; для нових користувачів підтвердження email не використовується — код на email лише для **скидання пароля**. Код завжди **6 цифр**, дійсний **10 хвилин**.
