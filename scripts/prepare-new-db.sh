#!/usr/bin/env bash
# Створює порожню БД для Express backend і запускає міграції.
# Дані зі старої CMS-БД — LEGACY_DATABASE_URL (за замовчуванням rok_m_dev).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

NEW_DB="${1:-rok_m_new}"
LEGACY_DB="${2:-rok_m_dev}"
PG_URL="${PG_URL:-postgresql://postgres:postgres@127.0.0.1:5432}"

export DATABASE_URL="${PG_URL}/${NEW_DB}"
export LEGACY_DATABASE_URL="${PG_URL}/${LEGACY_DB}"

if command -v createdb >/dev/null 2>&1; then
  createdb "${NEW_DB}" 2>/dev/null || true
fi

echo "Target (new API):    ${DATABASE_URL}"
echo "Source (legacy DB):  ${LEGACY_DATABASE_URL}"
echo ""

pnpm db:migrate
pnpm db:seed

echo ""
echo "Next — copy data from legacy database:"
echo "  LEGACY_DATABASE_URL=\"${LEGACY_DATABASE_URL}\" DATABASE_URL=\"${DATABASE_URL}\" pnpm migrate:legacy-db -- --truncate"
echo ""
echo "Optional content from git:"
echo "  DATABASE_URL=\"${DATABASE_URL}\" pnpm import:methodics"
echo ""
echo "Update .env:"
echo "  DATABASE_URL=${DATABASE_URL}"
