#!/usr/bin/env bash
# iSafeDrive deploy for Google Colab (free, no card). Run as root in a Colab terminal/notebook.
# Requires in /content: isafedrive_colab.zip  and  credentials.json
set -e
export DEBIAN_FRONTEND=noninteractive
export LANG=C.UTF-8
cd /content

echo "[1/7] System packages..."
apt-get update -qq
apt-get install -y -qq curl unzip postgresql postgresql-contrib build-essential python3 >/dev/null 2>&1

echo "[2/7] Node 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
apt-get install -y -qq nodejs >/dev/null 2>&1
npm install -g pm2 >/dev/null 2>&1

echo "[3/7] cloudflared..."
curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared

echo "[4/7] Extract project..."
rm -rf /content/isafedrive
mkdir -p /content/isafedrive
unzip -o -q /content/isafedrive_colab.zip -d /content/isafedrive
cp /content/credentials.json /content/isafedrive/credentials.json

echo "[5/7] npm install + build..."
cd /content/isafedrive
npm install
npm run build -w packages/shared
npm run build -w apps/api
npm run build -w apps/admin-dashboard

cat > apps/admin-dashboard/next.config.mjs <<'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [{ source: '/api/:path*', destination: 'http://127.0.0.1:3000/api/:path*' }];
  },
};
export default nextConfig;
EOF

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

echo "[6/7] PostgreSQL..."
service postgresql start
su postgres -c "psql -c \"ALTER USER postgres WITH PASSWORD 'postgres';\"" || true
su postgres -c "psql -c \"CREATE DATABASE isafedrive;\"" || true

echo "[7/7] Start services (pm2)..."
pm2 delete all 2>/dev/null || true
pm2 start "npm run start -w apps/api" --name isafe-api
pm2 start "npm run start -w apps/admin-dashboard" --name isafe-admin
pm2 start "npm run start -w apps/passenger-web" --name isafe-pax
pm2 start "npm run start -w apps/driver-web" --name isafe-driver
pm2 start "cloudflared tunnel --no-autoupdate --config /content/isafedrive/cloudflared-ingress.yml --credentials-file /content/isafedrive/credentials.json run" --name isafe-tunnel
pm2 save

sleep 6
echo "=== pm2 status ==="
pm2 status
curl -s -o /dev/null -w "pax.isafedrive.com -> %{http_code}\n" --max-time 12 https://pax.isafedrive.com || echo "Tunnel still connecting; wait ~20s then run: pm2 logs isafe-tunnel"
