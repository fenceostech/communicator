#!/usr/bin/env bash
# Per-boot reconciliation. If an external DATABASE_URL (e.g. Supabase) is
# injected, apply the schema there. Otherwise bring up a local PostgreSQL
# and seed it. Idempotent either way.
set -euo pipefail

cd "$(dirname "$0")/.."

DEFAULT_LOCAL="postgresql://fenceos:fenceos@localhost:5432/fenceos"
TARGET_URL="${DATABASE_URL:-$DEFAULT_LOCAL}"
HOST="$(T="$TARGET_URL" python3 -c 'import os,urllib.parse as u; print(u.urlparse(os.environ["T"]).hostname or "")' 2>/dev/null || true)"

case "$HOST" in
  localhost|127.0.0.1|"")
    # ---- Local PostgreSQL flow ------------------------------------------
    PG_VER="$(ls /usr/lib/postgresql/ | sort -n | tail -1)"
    DB_NAME="fenceos"; DB_USER="fenceos"; DB_PASS="fenceos"

    if ! pg_lsclusters -h 2>/dev/null | awk '{print $4}' | grep -q '^online$'; then
      echo "[start] Starting PostgreSQL ${PG_VER}/main..."
      sudo pg_ctlcluster "${PG_VER}" main start
    fi

    for _ in $(seq 1 30); do
      if pg_isready -h localhost -p 5432 >/dev/null 2>&1; then break; fi
      sleep 1
    done
    pg_isready -h localhost -p 5432

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

    APPLY_URL="$DEFAULT_LOCAL"
    echo "[start] Using local PostgreSQL."
    ;;
  *)
    # ---- External database (e.g. Supabase) ------------------------------
    APPLY_URL="$TARGET_URL"
    echo "[start] Using external database at ${HOST} (skipping local PostgreSQL)."
    ;;
esac

# --- Apply migrations + (dev-only) seeds via the portable runner ---------
# migrate.mjs applies schema to any target, but only loads demo data / a
# default admin for a local DB unless SEED_DEMO=1 / SEED_ADMIN_PASSWORD are set,
# so a remote database (e.g. Supabase) is never populated with sample data.
echo "[start] Running migrations..."
DATABASE_URL="$APPLY_URL" node scripts/migrate.mjs

echo "[start] Database ready (host: ${HOST:-localhost})."
