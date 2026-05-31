# Performance testing & serverless analysis (thesis)

> **Повний розділ українською (тестування + продуктивність + скріншоти):** [`thesis-testing-performance.md`](thesis-testing-performance.md)

This document provides a **reproducible performance testing methodology** and a **serverless architecture analysis** for the hybrid backend:

- Express.js + Sequelize + PostgreSQL
- Vercel Functions deployment model (single function entry)
- JWT auth, layered routes/controllers/services

> **No synthetic/fake benchmark numbers are included.** Run the scripts below to generate results on your machine (local Docker Postgres) and/or on a Vercel preview with a Neon/Supabase pooler.

---

## 1) Critical performance endpoints (classification)

### Public / read-heavy
- `GET /api/method-sections`  
  - **Read-heavy**, DB-heavy (pagination, optional include `methods`)
  - Typical workload: catalog browsing
- `GET /api/methods?filters[...]`  
  - **Read-heavy**, DB-heavy (filtering + pagination)
- `GET /api/pricing`  
  - **Read-heavy**, DB-light (single row)

### Authenticated / mixed
- `GET /api/auth/me`  
  - Read-heavy, DB-heavy (user + role + user sections join)
- `POST /api/progress/methods/:id/view`  
  - **Write-heavy**, DB write (upsert-ish: `findOrCreate` + `update`)

### Payment flow (provider-agnostic)
- `POST /api/tariffs/*/activate` and `POST /api/mak-cards/access`  
  - CPU-light, DB-light (read pricing), returns **payment_required**
- `POST /api/payments/confirm` (JWT required)  
  - **Transactional**, write-heavy: grants flags + section access
- `GET /api/payments/status?orderReference=...`  
  - DB read (access check)

### Admin (JWT + role=admin)
- feedback queue, pricing, users, content CRUD  
  - Mostly DB reads/writes; not typically high-RPS compared to public catalog.

---

## 2) Load testing (autocannon) — reproducible scripts

Tool: **autocannon** (Node-based, minimal overhead).

### Prerequisites (local benchmark)

```bash
pnpm docker:up

# Use dev DB (docker-compose)
cp .env.example .env
# set DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/rok_m_dev

pnpm db:migrate
pnpm db:seed

pnpm dev
```

### Scripts

All scripts target `LOAD_BASE_URL` (default `http://localhost:3000`).

```bash
pnpm load:auth
pnpm load:content
pnpm load:progress
pnpm load:payments
pnpm load:peak
```

Environment knobs:

```bash
LOAD_BASE_URL=http://localhost:3000
LOAD_DURATION_SEC=30
LOAD_CONNECTIONS=100
LOAD_PIPELINING=1

# Auth user (seeded in tests/dev)
LOAD_USER_EMAIL=test@example.com
LOAD_USER_PASSWORD=password123

# For progress endpoint
LOAD_METHOD_ID=1
```

### Scenarios required by thesis

- **Normal load**: `LOAD_CONNECTIONS=25`, `LOAD_DURATION_SEC=20`
- **Peak academic load**: `LOAD_CONNECTIONS=100..300` depending on DB
- **Burst traffic**: run multiple scripts back-to-back; or increase `connections`
- **Authenticated concurrency**: `progress-load.js`, `payments-load.js`
- **Read-heavy (95/5)**: `peak-load.js` (probabilistic mix)

---

## 3) Serverless architecture analysis (Vercel Functions)

### Request lifecycle

1. Vercel invokes `api/index.js`
2. On warm instance: cached Express handler is reused
3. Lazy DB init happens on first `/api/*` request via a single shared promise
4. Sequelize uses a **singleton connection pool**

### Why singleton `createApp()` matters

- Avoids re-registering routes/middleware on every invocation
- Minimizes cold-start work on warm invocations

### Why lazy DB init matters

- `/health` does not need DB and stays fast
- First `/api/*` request pays the initialization cost

### Connection pooling & Vercel concurrency model

- In serverless, **each concurrent instance may create its own pool**.
- If `pool.max` is large, bursts can exhaust Postgres connections.
- This project uses conservative pool sizing on Vercel (see `src/config/database.js`).

**Thesis conclusion:** serverless scaling shifts bottlenecks to Postgres connection limits; use Neon/Supabase pooler or PgBouncer.

### Cold starts (how to measure)

Measure P95/P99 for the first request after inactivity:

- `GET /health` (baseline, no DB)
- `GET /api/pricing` (forces DB init)

On Vercel: compare “first invocation after deploy/idle” vs steady-state.

---

## 4) Database performance analysis (PostgreSQL + Sequelize)

### Index usage (expected)

- `method_sections.slug`, `method_sections.published_at`
- `methods.slug`, `methods.method_section_id`, `methods.published_at`
- `user_method_sections (user_id, method_section_id) UNIQUE`
- `material_views (user_id, method_id)`, `material_views.viewed_at`

### Query patterns

- Catalog endpoints use pagination + optional include:
  - `findAndCountAll` with `distinct: true` for accurate counts with joins
- Progress write uses:
  - `findOrCreate` + `update`
- Payment confirmation uses a transaction with batch operations:
  - updates user flags
  - bulk upsert-like operations in `user_method_sections`

### Read-heavy optimization levers (thesis-ready)

- Use published-only filtering (`published_at IS NOT NULL`)
- Add/keep indexes for `published_at` and `slug`
- Prefer brief attribute selection on includes to reduce payload/IO
- Optional: read replicas for public catalog (already supported by config)

---

## 5) Scalability evaluation (engineering estimates + how to validate)

### What scales well

- Stateless HTTP API (JWT), horizontally scalable
- Read-heavy catalog endpoints can scale with replicas and caching (future)
- Payment confirmation is transactional and safe (bounded by DB)

### Likely bottlenecks

- PostgreSQL connection limits under burst + serverless scaling
- Sequelize initialization overhead on cold starts
- Bcrypt compare cost under login storms (CPU)

### Simulation targets

Run `load:peak` at increasing concurrency (100 → 500 → 1000 “users”).

> In practice, with serverless, “users” translate to concurrent requests across instances; the DB is the limiter.

---

## 6) Benchmark results (fill by running scripts)

Run each script and paste the autocannon summaries here.

### Normal load (example commands)

```bash
LOAD_CONNECTIONS=25 LOAD_DURATION_SEC=20 pnpm load:content
LOAD_CONNECTIONS=25 LOAD_DURATION_SEC=20 pnpm load:auth
```

### Peak load (read-heavy 95/5)

```bash
LOAD_CONNECTIONS=200 LOAD_DURATION_SEC=30 pnpm load:peak
```

### Recommended metrics to report

- Requests/sec (avg)
- Latency avg / p50 / p95 / p99
- Error rate, non-2xx
- DB: max connections observed (from provider metrics)

---

## 7) Visualizations (thesis-ready, reproducible)

Generate charts from your run outputs:

- Latency vs concurrency (p95)
- Throughput vs concurrency (RPS)
- Cold start vs warm latency (first vs steady request)
- Read/write mix diagram
- Serverless request lifecycle diagram

Store generated images under `docs/images/`.

---

## 8) Thesis-quality conclusions (short)

- **Hybrid serverless choice**: simplifies ops, enables auto-scaling; DB becomes the main stateful scaling axis.
- **Express**: minimal overhead, easy to reason about middleware and contracts.
- **Sequelize**: acceptable for thesis scale; overhead mitigated by singleton + conservative pooling.
- **PostgreSQL**: strong indexing, transactional safety for paid access, good fit for read-heavy catalogs.
- **Main limitation**: serverless concurrency can amplify DB connection pressure; pooler is mandatory for real-world bursts.

