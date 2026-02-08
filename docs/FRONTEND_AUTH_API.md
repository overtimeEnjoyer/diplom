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
// успіх: data.ok, data.message тощо
```

Після логіну або verify-code зберігай `data.jwt` і для захищених запитів додавай заголовок:

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

## 1. Реєстрація (без JWT)

**POST** `/api/auth/register`

**Body:**
```json
{
  "email": "user@example.com",
  "username": "username",
  "password": "password123"
}
```

**Валідація:** username ≥ 3 символи, password ≥ 6 символів.

**Успіх (200):**
```json
{
  "ok": true,
  "message": "Check your email for the confirmation code"
}
```

**Помилки (400):**  
- "Email, username and password are required"  
- "User with this email or username already exists"  
- "Username must be at least 3 characters"  
- "Password must be at least 6 characters"

Після успіху — показати екран «Введіть код з email» і викликати **verify-code**.

---

## 2. Підтвердження email (код з листа) → отримати JWT

**POST** `/api/auth/email/verify-code`

**Body:**
```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

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

**Що робити:** зберегти `jwt` (наприклад в localStorage / cookie) і використовувати в заголовку для захищених запитів:
```
Authorization: Bearer <jwt>
```

**Помилки (400):**  
- "Email and code are required"  
- "Invalid email or code"  
- "No pending confirmation for this email"  
- "Code expired"  
- "Invalid code"

Код дійсний **10 хвилин**.

---

## 3. Запит коду на email (для підтвердження / повторна відправка)

**POST** `/api/auth/email/request-code`

**Body:**
```json
{
  "email": "user@example.com"
}
```

**Успіх (200):** завжди `{ "ok": true }` (навіть якщо email не знайдено — з міркувань безпеки).

Використовувати: повторна відправка коду після реєстрації або окремий флоу «підтвердити email».

---

## 4. Логін (якщо вже підтверджений)

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

**Успіх (200):** `{ "jwt": "...", "user": { ... } }` — так само зберігати `jwt` і далі використовувати в `Authorization: Bearer <jwt>`.

---

## 5. Забув пароль — запит коду

**POST** `/api/auth/password/request-code`

**Body:**
```json
{
  "email": "user@example.com"
}
```

**Успіх (200):** `{ "ok": true }` (завжди, з міркувань безпеки).

Показати екран введення коду з листа та нового пароля, потім викликати **password/reset**.

---

## 6. Скидання пароля за кодом

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

## Схема флоу

### Реєстрація
1. Форма: email, username, password → **POST /api/auth/register**
2. Екран «Введіть код з email»
3. Форма: email + код → **POST /api/auth/email/verify-code**
4. Отримали `jwt` + `user` → вважати користувача залогіненим, зберегти JWT

### Логін (вже підтверджений)
1. Форма: identifier (email/username) + password → **POST /api/auth/local**
2. Отримали `jwt` + `user` → зберегти JWT

### Забув пароль
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

## Підсумок ендпоінтів

| Дія              | Method | URL                              | Auth |
|------------------|--------|-----------------------------------|------|
| Реєстрація       | POST   | /api/auth/register                | Ні   |
| Підтвердити email| POST   | /api/auth/email/verify-code       | Ні   |
| Код на email     | POST   | /api/auth/email/request-code     | Ні   |
| Логін            | POST   | /api/auth/local                   | Ні   |
| Код для скидання | POST   | /api/auth/password/request-code  | Ні   |
| Скинути пароль   | POST   | /api/auth/password/reset         | Ні   |

Код (email/password) завжди **6 цифр**, дійсний **10 хвилин**.
