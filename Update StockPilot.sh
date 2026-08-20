#!/bin/bash
# Linux: chmod +x once, then double-click or run from a terminal.
# Downloads the latest app into THIS folder; keeps your data.
set -e
cd "$(dirname "$0")"
chmod +x "$0" 2>/dev/null || true

echo ""
echo "=== StockPilot — Update ==="
echo "Downloads the latest app into THIS folder and keeps your data."
echo ""

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed or not on PATH."
  echo "Install Docker Engine + the Compose plugin (or Docker Desktop), start it, then try again."
  echo "Docs: https://docs.docker.com/engine/install/"
  read -n 1 -s -r -p "Press any key to close…"
  exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose plugin is missing. Install it, then try again."
  echo "Docs: https://docs.docker.com/compose/install/linux/"
  read -n 1 -s -r -p "Press any key to close…"
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed or not on PATH. Install Node LTS (≥ 20), then try again."
  read -n 1 -s -r -p "Press any key to close…"
  exit 1
fi

npm run second-pc:update

UI_PORT="8080"
if [ -f .env ]; then
  P=$(grep -E '^STOCKPILOT_UI_PORT=' .env | head -1 | cut -d= -f2- | tr -d '\r')
  if [ -n "$P" ]; then UI_PORT="$P"; fi
fi

echo ""
echo "Serving app on http://localhost:${UI_PORT}"
echo "Sign in: admin / devpass123"
echo ""
npx --yes serve -s dist -l "$UI_PORT"
