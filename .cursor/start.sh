#!/usr/bin/env bash
# Per-boot reconciliation: bring PostgreSQL online and ensure the
# FenceOS console database, role, and seed data exist. Idempotent.
set -euo pipefail

cd "$(dirname "$0")/.."

PG_VER="$(ls /usr/lib/postgresql/ | sort -n | tail -1)"
DB_NAME="fenceos"
DB_USER="fenceos"
DB_PASS="fenceos"

# --- Start the cluster if it is not already online -----------------------
if ! pg_lsclusters -h 2>/dev/null | awk '{print $4}' | grep -q '^online$'; then
  echo "[start] Starting PostgreSQL ${PG_VER}/main..."
  sudo pg_ctlcluster "${PG_VER}" main start
fi

# --- Wait for readiness --------------------------------------------------
for _ in $(seq 1 30); do
  if pg_isready -h localhost -p 5432 >/dev/null 2>&1; then break; fi
  sleep 1
done
pg_isready -h localhost -p 5432

# --- Ensure role + database exist ----------------------------------------
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';
  END IF;
END \$\$;
SQL
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"
fi

# --- Apply schema + seed (idempotent) ------------------------------------
echo "[start] Applying schema + seed..."
PGPASSWORD="${DB_PASS}" psql "postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}" \
  -v ON_ERROR_STOP=1 -f .cursor/db/schema.sql

echo "[start] Database ready at postgresql://${DB_USER}:***@localhost:5432/${DB_NAME}"
