# Архітектура системи

## Мета дипломного проєкту

Сайт ROK Mental Health — **демонстраційна імплементація** дослідженої серверної архітектури, а не самоціль. Основний результат:

- обґрунтована гібридна **serverless + BaaS** модель;
- власний **API-шар** (Express) поверх керованої **PostgreSQL**;
- чітке розділення шарів (routes / controllers / services / models);
- готовність до деплою на **Vercel Functions** та масштабування read-heavy навантаження.

## Загальна схема

```mermaid
flowchart TB
  subgraph client [Клієнт]
    FE[Frontend SPA]
    WFP[WayForPay]
  end

  subgraph vercel [Vercel]
    VF[Vercel Function api/index.js]
    EX[Express Application]
    VF --> EX
  end

  subgraph baas [BaaS шар]
    PG[(PostgreSQL Neon/Supabase)]
    POOL[Connection Pool / PgBouncer]
    PG --- POOL
  end

  subgraph app [Application layers]
    R[routes]
    C[controllers]
    S[services]
    M[Sequelize models]
    EX --> R --> C --> S --> M
  end

  FE -->|REST JWT| VF
  WFP -->|callback| VF
  M --> POOL
```

## Шари відповідальності

| Шар | Відповідальність |
|-----|------------------|
| **routes** | HTTP-метод, шлях, middleware (auth, validation) |
| **controllers** | Парсинг запиту, статус-код, формат відповіді |
| **services** | Бізнес-логіка, транзакції, інтеграції (WayForPay, email) |
| **models** | Схема БД, associations, індекси |
| **middlewares** | JWT, ролі, помилки, raw body для WayForPay |

Бізнес-логіка **не** знаходиться в routes — це спрощує тестування та зміну транспорту (локальний сервер ↔ serverless).

## Гібрид BaaS + власний API

| Компонент | Роль |
|-----------|------|
| **PostgreSQL (Neon/Supabase)** | BaaS: керована БД, бекапи, pooling |
| **Express API** | Повний контроль над правилами доступу, оплатою, валідацією |
| **Vercel Functions** | Serverless runtime без окремого VPS |

**Чому не чистий BaaS (Firebase/Supabase Auth only):** складні транзакції доступу, кастомний WayForPay, зменшення vendor lock-in для бізнес-правил.

**Чому не класичний моноліт на VPS:** вищий DevOps overhead, гірше масштабування піків без додаткової інфраструктури.

**Чому не microservices:** надмірна складність для обсягу дипломного проєкту.

## Serverless і підключення до БД

- Один singleton `Sequelize` на warm instance Vercel (`src/config/database.js`).
- Pool з обмеженим `max` (5) — не відкривати нове підключення на кожен запит без контролю.
- Опційно `DATABASE_READ_REPLICA_URL` для read-heavy запитів (списки методик).

## Авторизація

JWT (Bearer). Ролі: `authenticated`, `admin`. Патерн збережено з Strapi-проєкту: кастомні маршрути перевіряють JWT у middleware, а не через зовнішній permission engine.

## Інтеграції

- **WayForPay:** HMAC-MD5, offline invoice, callback з raw body parser.
- **Email:** Brevo (пріоритет) або SendGrid для password reset.

## Висновок для захисту

Архітектура демонструє **практичний компроміс**: швидкий деплой і масштабування serverless + надійні реляційні дані BaaS + повний контроль над доменною логікою освітньої платформи.
