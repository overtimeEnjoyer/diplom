# Інвентаризація функціоналу: Strapi → Express

## Ролі

| Strapi | Новий backend |
|--------|----------------|
| Public | Не потрібен JWT; публічні GET контенту |
| Authenticated | `role.type = authenticated` + JWT |
| Strapi Admin | `role.type = admin` + JWT + `/api/admin/*` |

## Сутності

| Strapi content type | Sequelize model | Таблиця |
|----------------------|-----------------|---------|
| users-permissions.user | User | users |
| method-section | MethodSection (Category) | method_sections |
| method | Method (Material) | methods |
| user-method-section | UserMethodSection | user_method_sections |
| pricing | Pricing | pricings |
| feedback | Feedback | feedbacks |
| — | MaterialView (Progress) | material_views |

## Endpoints — збережено

| Method | Path | Статус |
|--------|------|--------|
| POST | /api/auth/register | ✅ |
| POST | /api/auth/local | ✅ |
| POST | /api/auth/email/request-code | ✅ (legacy) |
| POST | /api/auth/email/verify-code | ✅ (legacy) |
| POST | /api/auth/password/request-code | ✅ |
| POST | /api/auth/password/reset | ✅ |
| GET | /api/auth/me | ✅ |
| PUT/POST | /api/auth/profile | ✅ |
| GET/PUT/POST | /api/mak-cards/favorites* | ✅ |
| POST | /api/mak-cards/access | ✅ |
| POST | /api/tariffs/medium/activate | ✅ |
| POST | /api/tariffs/premium/activate | ✅ |
| POST | /api/user-method-sections/assign | ✅ |
| GET | /api/user-method-sections/me | ✅ |
| POST | /api/payments/wayforpay-callback | ✅ |
| GET | /api/payments/status | ✅ |
| GET | /api/method-sections | ✅ (Strapi-подібна відповідь) |
| GET | /api/methods | ✅ |
| GET | /api/pricing | ✅ |
| POST | /api/feedback | ✅ |

## Додано для дипломної роботи

| Method | Path | Примітка |
|--------|------|----------|
| POST | /api/progress/methods/:methodId/view | Історія переглядів (не було в Strapi) |
| GET | /api/progress/me | |
| * | /api/admin/* | Admin REST замість Strapi Admin UI |

## Не перенесено автоматично

| Функція | Причина |
|---------|---------|
| Strapi Admin Panel (React) | Замінено admin API; контент — міграція з `methodics-sections/` або legacy |
| Strapi Media Library | Не використовувалась у custom API |
| Plugin Cloud / EE flags | Не стосується нової архітектури |
| `migrateAllMethodics.ts` | Замінено на `pnpm import:methodics` (Sequelize) |

## Зміна для фронтенду

- **Порт:** `1337` → `3000` (або Vercel URL)
- **`documentId`:** зберігається (UUID) для сумісності
- **Формат відповіді:** `{ data, meta }` для контенту та pricing — як у Strapi 5
