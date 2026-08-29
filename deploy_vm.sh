#!/usr/bin/env bash
# iSafeDrive one-shot deploy for a Ubuntu VPS (Oracle / OneNetwork / any cloud).
# Usage:
#   bash deploy_vm.sh                      # assumes code already in ~/isafedrive
#   bash deploy_vm.sh https://github.com/you/isafedrive.git   # git clone instead
# Requires in ~/isafedrive: credentials.json + cloudflared-ingress.yml
set -e
REPO_URL="${1:-}"
APP_DIR="$HOME/isafedrive"
mkdir -p "$APP_DIR"

if [ -n "$REPO_URL" ]; then
  echo "[0/8] Cloning repo..."
  rm -rf "$APP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
elif [ ! -f "$APP_DIR/package.json" ]; then
  echo "ERROR: no code in $APP_DIR and no repo URL given. Upload the source tarball or pass a git URL."
  exit 1
fi
cd "$APP_DIR"

echo "[1/8] System packages..."
sudo apt-get update -y
sudo apt-get install -y curl unzip build-essential python3 postgresql postgresql-contrib redis-server git

echo "[2/8] Node 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2

echo "[3/8] cloudflared..."
ARCH=$(uname -m)
if [ "$ARCH" = "aarch64" ]; then CFARCH=arm64; else CFARCH=amd64; fi
sudo curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${CFARCH}" -o /usr/local/bin/cloudflared
sudo chmod +x /usr/local/bin/cloudflared

echo "[4/8] PostgreSQL + Redis..."
sudo systemctl enable --now postgresql
sudo systemctl enable --now redis-server
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'postgres';" || true
sudo -u postgres psql -c "CREATE DATABASE isafedrive;" || true

echo "[5/8] Install + build..."
npm install
npm run build -w packages/shared
npm run build -w apps/api
npm run build -w apps/admin-dashboard

cat > apps/api/.env <<EOF
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/isafedrive
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
REDIS_URL=redis://localhost:6379
GOOGLE_MAPS_API_KEY=
PAYSTACK_SECRET_KEY=
FLUTTERWAVE_SECRET_KEY=
EOF

echo "[6/8] Start app services (pm2)..."
pm2 delete all 2>/dev/null || true
pm2 start "npm run start -w apps/api" --name isafe-api
pm2 start "npm run start -w apps/admin-dashboard" --name isafe-admin
pm2 start "npm run start -w apps/passenger-web" --name isafe-pax
pm2 start "npm run start -w apps/driver-web" --name isafe-driver
pm2 save

echo "[7/8] Start Cloudflare tunnel (URLs unchanged)..."
pm2 start "cloudflared tunnel --no-autoupdate --config $APP_DIR/cloudflared-ingress.yml --credentials-file $APP_DIR/credentials.json run" --name isafe-tunnel
pm2 save

echo "[8/8] DONE."
echo "Verify: pm2 status  &&  pm2 logs isafe-api"
echo "Public URLs: https://pax.isafedrive.com  https://driver.isafedrive.com  https://admin.isafedrive.com"
