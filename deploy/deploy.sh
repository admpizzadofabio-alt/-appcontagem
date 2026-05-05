#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# APPCONTAGEM — Script de Deploy na VPS (Ubuntu 22.04)
# Execute como root ou usuário com sudo
# Uso: bash deploy.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

DOMINIO="SEU_DOMINIO.com"
APP_DIR="/var/www/appcontagem"
DB_USER="appcontagem"
DB_NAME="appcontagem"
DB_PASS="TROQUE_POR_SENHA_FORTE"

echo "========================================"
echo "  APPCONTAGEM — Deploy VPS"
echo "========================================"

# ── 1. Atualizar sistema ──────────────────────────────────────────────────────
echo "[1/9] Atualizando sistema..."
apt-get update -qq && apt-get upgrade -y -qq

# ── 2. Instalar Node.js 22 LTS ───────────────────────────────────────────────
echo "[2/9] Instalando Node.js 22..."
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# ── 3. Instalar PM2, Nginx, Certbot ──────────────────────────────────────────
echo "[3/9] Instalando PM2, Nginx, Certbot..."
npm install -g pm2
apt-get install -y nginx certbot python3-certbot-nginx

# ── 4. Instalar e configurar PostgreSQL ──────────────────────────────────────
echo "[4/9] Configurando PostgreSQL..."
apt-get install -y postgresql postgresql-contrib

sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null || echo "Usuário já existe"
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || echo "Banco já existe"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

# ── 5. Copiar aplicação ───────────────────────────────────────────────────────
echo "[5/9] Copiando arquivos da aplicação..."
mkdir -p $APP_DIR
cp -r ./backend $APP_DIR/
mkdir -p $APP_DIR/backend/logs

# Copiar .env de produção
if [ ! -f "$APP_DIR/backend/.env" ]; then
  cp ./deploy/.env.production $APP_DIR/backend/.env
  echo ""
  echo "  ATENÇÃO: Edite o arquivo $APP_DIR/backend/.env antes de continuar!"
  echo "  Use: nano $APP_DIR/backend/.env"
  echo ""
  read -p "  Pressione ENTER após editar o .env..."
fi

# ── 6. Instalar dependências e build ─────────────────────────────────────────
echo "[6/9] Instalando dependências e compilando TypeScript..."
cd $APP_DIR/backend
npm ci --omit=dev
npm run build
npx prisma generate
npx prisma migrate deploy

# ── 7. Configurar Nginx ───────────────────────────────────────────────────────
echo "[7/9] Configurando Nginx..."
sed "s/SEU_DOMINIO.com/$DOMINIO/g" /var/www/appcontagem/../deploy/nginx.conf \
  > /etc/nginx/sites-available/appcontagem 2>/dev/null || \
  cp ./deploy/nginx.conf /etc/nginx/sites-available/appcontagem

# Substitui domínio no arquivo
sed -i "s/SEU_DOMINIO.com/$DOMINIO/g" /etc/nginx/sites-available/appcontagem

ln -sf /etc/nginx/sites-available/appcontagem /etc/nginx/sites-enabled/appcontagem
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ── 8. Certificado SSL (Let's Encrypt) ───────────────────────────────────────
echo "[8/9] Obtendo certificado SSL..."
certbot --nginx -d $DOMINIO --non-interactive --agree-tos -m admin@$DOMINIO || \
  echo "  AVISO: Certbot falhou. Configure SSL manualmente depois."

# ── 9. Iniciar app com PM2 ────────────────────────────────────────────────────
echo "[9/9] Iniciando aplicação com PM2..."
cd $APP_DIR/backend
pm2 start ecosystem.config.cjs --env production --only appcontagem-prod
pm2 save
pm2 startup systemd -u root --hp /root

echo ""
echo "========================================"
echo "  Deploy concluído!"
echo "  API: https://$DOMINIO/api/v1/health"
echo "========================================"
