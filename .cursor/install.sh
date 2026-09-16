#!/usr/bin/env bash
# Idempotent repository bootstrap for the FenceOS console Cloud Agent.
# Installs system + node dependencies. Safe to re-run; baked into builds.
set -euo pipefail

cd "$(dirname "$0")/.."

# --- System dependencies: PostgreSQL server + client ---------------------
if ! command -v pg_ctlcluster >/dev/null 2>&1; then
  echo "[install] Installing PostgreSQL..."
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql postgresql-contrib
else
  echo "[install] PostgreSQL already present."
fi

# --- Node dependencies ---------------------------------------------------
echo "[install] Installing node dependencies with pnpm..."
pnpm install --frozen-lockfile

echo "[install] Done."
