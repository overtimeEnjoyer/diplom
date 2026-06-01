#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DB_NAME="${1:-rok_m_dev}"
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:5432/${DB_NAME}}"

if ! command -v psql >/dev/null 2>&1 || ! pg_isready -q 2>/dev/null; then
  echo "Starting PostgreSQL via Docker..."
  pnpm docker:up
  echo "Waiting for Postgres..."
  sleep 3
fi

if command -v createdb >/dev/null 2>&1; then
  createdb "${DB_NAME}" 2>/dev/null || true
fi

echo "Migrate + seed..."
pnpm db:setup

echo "Import methodics..."
pnpm import:methodics

echo ""
echo "Done."
echo "  pnpm dev"
echo "  API: http://localhost:3000/api"
echo "  Admin: admin@rok-mentalhealth.local / Admin123!ChangeMe (after seed)"
