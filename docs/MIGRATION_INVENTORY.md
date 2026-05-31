# Інвентаризація: попередній backend → Express

## Підсумок

| Було | Стало |
|------|--------|
| Headless CMS + custom API | Express + Sequelize + PostgreSQL |
| Адмін UI в CMS | `role.type = admin` + JWT + `/api/admin/*` |
| JWT users-permissions | `src/services/auth.service.js` + middleware |
| Оплати (provider-agnostic) | `src/services/payments.service.js` |

## Моделі

| Контент-тип (раніше) | Sequelize model | Таблиця |
|----------------------|-----------------|---------|
| method-section | MethodSection | method_sections |
| method | Method | methods |
| user (extended) | User | users |
| user-method-section | UserMethodSection | user_method_sections |
| pricing (single) | Pricing | pricings |
| feedback | Feedback | feedbacks |
| — | MaterialView | material_views |

## Ендпоінти (збережено для фронтенду)

| Method | Path | Статус |
|--------|------|--------|
| POST | /api/auth/register | ✅ |
| POST | /api/auth/local | ✅ |
| GET | /api/auth/me | ✅ |
| GET | /api/method-sections | ✅ `{ data, meta }` |
| GET | /api/methods | ✅ |
| GET | /api/pricing | ✅ |
| POST | /api/payments/confirm | ✅ mock/demo |
| POST | /api/admin/payments/confirm | ✅ admin manual |
| POST | /api/progress/methods/:methodId/view | ✅ нове |
| * | /api/admin/* | ✅ REST admin |

## Не переноситься

| Функція | Заміна |
|---------|--------|
| Вбудована адмін-панель CMS | Admin API + `pnpm import:methodics` |
| Media Library | Не використовувалась у custom API |
| `migrateAllMethodics.ts` | `pnpm import:methodics` |

## Контракт API

- Відповіді контенту: `{ data, meta }`, `documentId`, `filters[...]`, `populate` — як очікує існуючий фронтенд.
- Перенесення даних: [`MIGRATE_LEGACY_DATA.md`](./MIGRATE_LEGACY_DATA.md)
