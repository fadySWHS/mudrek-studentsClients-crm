#!/bin/bash
# Mudrek CRM — Deployment Script
# Run on the VPS after git pull:  bash /var/www/mudrek/server/deploy.sh
# First-time setup: see FIRST_DEPLOY below

set -e  # exit on any error

APP_DIR="/var/www/mudrek"
LOG_DIR="$APP_DIR/logs"

echo "=============================="
echo "  Mudrek CRM — Deploy Script  "
echo "=============================="

mkdir -p "$LOG_DIR"

# ── 1. Pull latest code ────────────────────────────────────────────────────────
echo "[1/6] Pulling latest code..."
cd "$APP_DIR"
git pull origin main

# ── 2. Backend: install deps ───────────────────────────────────────────────────
echo "[2/6] Installing backend dependencies..."
cd "$APP_DIR/backend"
npm install --production

# ── 3. Backend: run DB migrations ─────────────────────────────────────────────
echo "[3/6] Running database migrations..."
npx prisma migrate deploy
npx prisma generate

# ── 4. Frontend: install deps + build ─────────────────────────────────────────
echo "[4/6] Building frontend..."
cd "$APP_DIR/frontend"
npm install
npm run build

# ── 5. Restart PM2 processes ──────────────────────────────────────────────────
echo "[5/6] Restarting PM2..."
cd "$APP_DIR"
pm2 reload ecosystem.config.js --env production
pm2 save

# ── 6. Reload Nginx ───────────────────────────────────────────────────────────
echo "[6/6] Reloading Nginx..."
sudo nginx -t && sudo systemctl reload nginx

echo ""
echo "✅ Deploy complete!"
echo "  Backend  → http://127.0.0.1:4000/api/health"
echo "  Frontend → https://yourdomain.com"
echo "=============================="

# ══════════════════════════════════════════════════════════════════════════════
# FIRST-TIME SETUP (run once on a fresh VPS)
# ══════════════════════════════════════════════════════════════════════════════
# 1. Install Node.js 20+ via nvm:
#      curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
#      nvm install 20 && nvm use 20 && nvm alias default 20
#
# 2. Install PM2 and PostgreSQL:
#      npm install -g pm2
#      sudo apt install postgresql postgresql-contrib nginx -y
#
# 3. Create PostgreSQL database:
#      sudo -u postgres psql
#      CREATE USER mudrek WITH PASSWORD 'your_password';
#      CREATE DATABASE mudrek_db OWNER mudrek;
#      \q
#
# 4. Clone repo:
#      mkdir -p /var/www/mudrek && cd /var/www/mudrek
#      git clone https://github.com/YOUR_ORG/mudrek-crm.git .
#
# 5. Create env files:
#      cp backend/.env.example backend/.env   # then fill in values
#      cp frontend/.env.local.example frontend/.env.local  # then fill in values
#
# 6. Set NEXT_PUBLIC_API_URL in frontend/.env.local:
#      NEXT_PUBLIC_API_URL=https://yourdomain.com/api
#
# 7. Run first deploy:
#      bash server/deploy.sh
#
# 8. Start PM2 and save:
#      pm2 start ecosystem.config.js --env production
#      pm2 save
#      pm2 startup  # follow the printed command to enable on reboot
#
# 9. Setup Nginx:
#      sudo cp server/nginx/mudrek.conf /etc/nginx/sites-available/mudrek
#      sudo ln -s /etc/nginx/sites-available/mudrek /etc/nginx/sites-enabled/
#      sudo nginx -t && sudo systemctl reload nginx
#
# 10. Get free SSL with Certbot:
#       sudo apt install certbot python3-certbot-nginx -y
#       sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
