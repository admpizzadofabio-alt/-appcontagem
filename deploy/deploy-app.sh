#!/usr/bin/env bash
# deploy-app.sh — Roda na VPS para fazer deploy/atualizar o backend
# Uso: bash deploy/deploy-app.sh
set -euo pipefail

APP_DIR="/opt/appcontagem"
REPO="https://github.com/admpizzadofabio-alt/-appcontagem.git"

echo "=== [1/6] Clonando / atualizando repositório ==="
if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR" && git pull origin main
else
  git clone "$REPO" "$APP_DIR"
  cd "$APP_DIR"
fi

echo "=== [2/6] Copiando .env.production ==="
# O arquivo .env.production NÃO está no repo (gitignored).
# Copie manualmente para /opt/appcontagem/backend/.env.production antes de rodar este script.
[ -f "$APP_DIR/backend/.env.production" ] || { echo "ERRO: $APP_DIR/backend/.env.production não encontrado!"; exit 1; }

echo "=== [3/6] Subindo banco (Docker) ==="
cd "$APP_DIR"
docker compose up -d postgres
echo "Aguardando PostgreSQL ficar pronto..."
until docker exec appcontagem-db pg_isready -U postgres -d appcontagem 2>/dev/null; do
  sleep 2
done
echo "PostgreSQL pronto."

echo "=== [4/6] Build do backend ==="
cd "$APP_DIR/backend"
npm ci --omit=dev
npm run build
NODE_ENV=production npx dotenv -e .env.production -- npx prisma migrate deploy || \
  NODE_ENV=production npx dotenv -e .env.production -- npx prisma db push

echo "=== [5/6] Iniciando / reiniciando PM2 ==="
pm2 describe appcontagem > /dev/null 2>&1 && \
  pm2 reload appcontagem || \
  pm2 start dist/server.js \
    --name appcontagem \
    --env production \
    -- --env-file .env.production

pm2 save

echo "=== [6/6] Status ==="
pm2 status
curl -s http://localhost:3333/api/v1/health | head -c 200 || true
echo ""
echo "=== Deploy concluido! ==="
