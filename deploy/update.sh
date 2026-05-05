#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# APPCONTAGEM — Script de Atualização (após deploy inicial)
# Execute na VPS quando tiver novas versões do código
# Uso: bash update.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

APP_DIR="/var/www/appcontagem/backend"

echo "[1/4] Copiando novos arquivos..."
cp -r ./backend/src       $APP_DIR/
cp -r ./backend/prisma    $APP_DIR/
cp    ./backend/package*.json $APP_DIR/

echo "[2/4] Instalando dependências e compilando..."
cd $APP_DIR
npm ci --omit=dev
npm run build
npx prisma generate
npx prisma migrate deploy

echo "[3/4] Reiniciando app (zero downtime)..."
pm2 reload appcontagem-prod

echo "[4/4] Status:"
pm2 status appcontagem-prod

echo ""
echo "Atualização concluída!"
