#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

say() { printf '\n▸ %s\n' "$*"; }
die() { printf '\n✗ %s\n' "$*" >&2; exit 1; }

read_database_url_from_env_file() {
  [ -f .env ] || return 0
  local line
  line=$(grep -E '^DATABASE_URL=' .env | head -1 || true)
  [ -n "$line" ] || return 0
  local url="${line#DATABASE_URL=}"
  url="${url%\"}"
  url="${url#\"}"
  url="${url%\'}"
  url="${url#\'}"
  printf '%s' "$url"
}

is_local_database_url() {
  case "$1" in
    ''|*localhost*|*127.0.0.1*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

say "Перевірка Node та pnpm..."
command -v node >/dev/null || die "Встановіть Node.js 18+: https://nodejs.org"
command -v pnpm >/dev/null || die "Встановіть pnpm: npm install -g pnpm"

say "Встановлення пакетів..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

if [ ! -f .env ]; then
  say "Створення .env з .env.example..."
  cp .env.example .env
fi

FILE_DATABASE_URL="$(read_database_url_from_env_file)"
export DATABASE_URL="${DATABASE_URL:-$FILE_DATABASE_URL}"

if is_local_database_url "$DATABASE_URL"; then
  export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:5432/rok_m_dev}"
  export DATABASE_SSL=false

  command -v docker >/dev/null || die "Для локальної БД потрібен Docker: https://www.docker.com/products/docker-desktop/"
  docker info >/dev/null 2>&1 || die "Запустіть Docker Desktop і повторіть pnpm start:here"

  say "Локальна БД: PostgreSQL у Docker..."
  pnpm docker:up

  say "Очікування бази даних..."
  ready=0
  for _ in $(seq 1 40); do
    if docker compose exec -T postgres pg_isready -U postgres >/dev/null 2>&1; then
      ready=1
      break
    fi
    sleep 1
  done
  [ "$ready" -eq 1 ] || die "PostgreSQL не відповідає. Перевірте: docker compose logs postgres"
else
  say "Хмарна БД з .env (Docker не потрібен)..."
fi

say "Таблиці та початкові дані..."
pnpm db:migrate
pnpm db:seed

METHOD_COUNT="$(node --import dotenv/config -e "
import pg from 'pg';
const u = process.env.DATABASE_URL;
const ssl = /neon|supabase|sslmode=require/i.test(u) ? { rejectUnauthorized: false } : false;
const c = new pg.Client({ connectionString: u, ssl });
await c.connect();
const r = await c.query('SELECT COUNT(*)::int AS n FROM methods');
console.log(r.rows[0].n);
await c.end();
" 2>/dev/null || echo "0")"

if [ "${METHOD_COUNT:-0}" -lt 100 ]; then
  say "Імпорт методик (~750, 2–5 хв)..."
  pnpm import:methodics
else
  say "Методики вже в БД ($METHOD_COUNT шт.) — імпорт пропущено."
fi

printf '\n✓ Готово. Запустіть сервер:\n\n    pnpm dev\n\n'
printf '  API:        http://localhost:3000/api\n'
printf '  Перевірка:  http://localhost:3000/health\n'
printf '  Swagger:    http://localhost:3000/api-docs\n\n'
printf '  Адмін: admin@rok-mentalhealth.local / Admin123!ChangeMe\n\n'
