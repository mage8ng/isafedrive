#!/usr/bin/env bash
# Kamatera deploy for iSafeDrive — single Ubuntu 22.04 VPS with a PUBLIC IP.
# Run as root on a fresh server:
#   GITHUB_PAT=ghp_xxxx bash deploy_kamatera.sh
# The script self-detects the public IP, so no args needed.
# Services: API :3000 | Admin :3100 | Passenger :3200 | Driver :3300
set -euo pipefail

GITHUB_PAT="${GITHUB_PAT:?ERROR: run with GITHUB_PAT=your_github_pat}"
REPO="https://${GITHUB_PAT}@github.com/mage8ng/isafedrive.git"
APP_DIR="/opt/isafedrive"
PG_USER="isafedrive"
PG_PASS="isafedrive"
PG_DB="isafedrive"

export DEBIAN_FRONTEND=noninteractive

PUBLIC_IP="$(curl -s --max-time 10 ifconfig.me || curl -s --max-time 10 icanhazip.com)"
echo ">> Public IP detected: ${PUBLIC_IP}"

# ----- 1. swap (small instances OOM on next build) -----
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile; mkswap /swapfile; swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# ----- 2. system packages -----
apt-get update -y
apt-get install -y curl git build-essential ca-certificates gnupg ufw redis-server

# ----- 3. Node 20 -----
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
node -v; npm -v

# ----- 4. Postgres 16 -----
if ! command -v psql >/dev/null; then
  apt-get install -y postgresql postgresql-contrib
fi
systemctl enable --now postgresql
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${PG_USER}'" | grep -q 1 || sudo -u postgres createuser -s "${PG_USER}"
sudo -u postgres psql -c "ALTER USER ${PG_USER} WITH PASSWORD '${PG_PASS}';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${PG_DB}'" | grep -q 1 || sudo -u postgres createdb -O "${PG_USER}" "${PG_DB}"

# ----- 5. clone / pull -----
if [ -d "${APP_DIR}/.git" ]; then
  git -C "${APP_DIR}" pull --ff-only
else
  git clone "${REPO}" "${APP_DIR}"
fi
cd "${APP_DIR}"

# ----- 6. install + build -----
npm install
npm run build -w packages/shared
npm run build -w apps/api
# admin needs the API URL baked in at BUILD time
export NEXT_PUBLIC_API_URL="http://${PUBLIC_IP}:3000/api/v1"
npm run build -w apps/admin-dashboard

# ----- 7. API env -----
cat > apps/api/.env <<EOF
PORT=3000
DATABASE_URL=postgresql://${PG_USER}:${PG_PASS}@127.0.0.1:5432/${PG_DB}
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
REDIS_URL=redis://127.0.0.1:6379
EOF

# ----- 8. pm2 -----
npm install -g pm2
pm2 delete all 2>/dev/null || true
pm2 start "npm run start -w apps/api" --name isafe-api
pm2 start "npm run start -w apps/admin-dashboard" --name isafe-admin
pm2 start "node apps/passenger-web/server.mjs" --name isafe-pax --env API_URL=http://127.0.0.1:3000
pm2 start "node apps/driver-web/server.mjs" --name isafe-driver --env API_URL=http://127.0.0.1:3000
pm2 save

# ----- 9. firewall (also open these in the Kamatera console) -----
ufw allow 22/tcp 3000/tcp 3100/tcp 3200/tcp 3300/tcp 80/tcp 443/tcp || true
ufw --force enable || true

echo "============================================================"
echo "iSafeDrive deployed on Kamatera."
echo "  API health : http://${PUBLIC_IP}:3000/health"
echo "  Admin      : http://${PUBLIC_IP}:3100"
echo "  Passenger  : http://${PUBLIC_IP}:3200"
echo "  Driver     : http://${PUBLIC_IP}:3300"
echo "============================================================"
