# REST API

Base URL: `https://<host>/api` (локально: `http://localhost:3000/api`)

## Auth

| Method | URL | Auth | Body | Success |
|--------|-----|------|------|---------|
| POST | /auth/register | — | email, username, password | `{ jwt, user }` |
| POST | /auth/local | — | identifier, password | `{ jwt, user }` |
| POST | /auth/email/request-code | — | email | `{ ok: true }` |
| POST | /auth/email/verify-code | — | email, code | `{ jwt, user }` |
| POST | /auth/password/request-code | — | email | `{ ok: true }` |
| POST | /auth/password/reset | — | email, code, password | `{ ok: true }` |
| GET | /auth/me | JWT | — | профіль + methodSections |
| PUT | /auth/profile | JWT | username?, email?, password? | user |

**Помилки:** 400 валідація, 401 без JWT, 409 конфлікт email/username.

## Контент (публічний)

| Method | URL | Auth | Query |
|--------|-----|------|-------|
| GET | /method-sections | — | filters, populate, pagination |
| GET | /method-sections/:id | — | populate |
| GET | /methods | — | filters[slug][$eq], populate |
| GET | /methods/:id | — | populate |
| GET | /pricing | — | — |

**Відповідь:** `{ data, meta }` (Strapi-сумісно).

## Оплата та доступ

| Method | URL | Auth | Body |
|--------|-----|------|------|
| POST | /tariffs/medium/activate | JWT | — |
| POST | /tariffs/premium/activate | JWT | — |
| POST | /user-method-sections/assign | JWT | methodSectionId, categorySlug?, methodicSlug? |
| GET | /user-method-sections/me | JWT | — |
| POST | /mak-cards/access | JWT | — |
| GET | /payments/status | — | orderReference |
| POST | /payments/wayforpay-callback | — | WayForPay payload |

**Успіх оплати (ініціалізація):** `{ status: "payment_required", paymentUrl, orderReference, amount, currency, ... }`

## MAK favorites

| Method | URL | Auth |
|--------|-----|------|
| GET | /mak-cards/favorites | JWT |
| PUT | /mak-cards/favorites | JWT |
| POST | /mak-cards/favorites/toggle | JWT |

## Feedback

| Method | URL | Auth | Body |
|--------|-----|------|------|
| POST | /feedback | — | name, email, message, tariff? |

Помилки українською (400).

## Progress (нове)

| Method | URL | Auth |
|--------|-----|------|
| POST | /progress/methods/:methodId/view | JWT |
| GET | /progress/me | JWT |

## Admin

| Method | URL | Auth |
|--------|-----|------|
| GET | /admin/feedbacks | admin |
| PATCH | /admin/feedbacks/:id/processed | admin |
| GET | /admin/pricing | admin |
| PUT | /admin/pricing | admin |
| GET | /admin/users | admin |
| PATCH | /admin/users/:id/tariff | admin |
| GET | /admin/method-sections | admin |
| POST | /admin/method-sections | admin |
| PATCH | /admin/method-sections/:id | admin |
| GET | /admin/methods | admin |
| POST | /admin/methods | admin |
| PATCH | /admin/methods/:id | admin |

Формат відповідей контенту та pricing: `{ data, meta }` (сумісно з попереднім Strapi API).
