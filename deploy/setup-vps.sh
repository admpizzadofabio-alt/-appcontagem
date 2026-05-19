#!/usr/bin/env bash
# setup-vps.sh — Roda UMA VEZ na VPS como root
# VPS: 191.252.93.209 | Domínio base: sistemaspizzafabio.com.br
set -euo pipefail

echo "=== [1/7] Atualizando sistema ==="
apt-get update -y && apt-get upgrade -y
apt-get install -y curl git nginx certbot python3-certbot-nginx ufw

echo "=== [2/7] Instalando Node 20 ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node -v && npm -v

echo "=== [3/7] Instalando PM2 ==="
npm install -g pm2
pm2 startup systemd -u root --hp /root | tail -1 | bash || true

echo "=== [4/7] Instalando Docker ==="
curl -fsSL https://get.docker.com | sh
systemctl enable docker && systemctl start docker

echo "=== [5/7] Configurando firewall ==="
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo "=== [6/7] Configurando Nginx multi-projeto ==="
cp /opt/appcontagem/deploy/nginx-multi-projeto.conf /etc/nginx/sites-available/pizzafabio
ln -sf /etc/nginx/sites-available/pizzafabio /etc/nginx/sites-enabled/pizzafabio
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "=== [7/7] SSL com Certbot (requer DNS já propagado) ==="
# Ajuste os -d conforme os subdomínios reais que você usar
certbot --nginx \
  -d sistemaspizzafabio.com.br \
  -d www.sistemaspizzafabio.com.br \
  -d app.sistemaspizzafabio.com.br \
  -d projeto2.sistemaspizzafabio.com.br \
  -d projeto3.sistemaspizzafabio.com.br \
  -d projeto4.sistemaspizzafabio.com.br \
  --non-interactive --agree-tos -m admin@pizzadofabio.com

echo ""
echo "=== Setup base concluido! ==="
echo "Agora rode: bash /opt/appcontagem/deploy/deploy-app.sh"
