#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════════╗
# ║  Mudrek CRM — Safe Deployment Script                                ║
# ║  Designed for VPS that also runs WordPress                          ║
# ║                                                                      ║
# ║  WHAT THIS SCRIPT TOUCHES:                                          ║
# ║    /var/www/mudrek/     ← CRM app files only                        ║
# ║    PM2 processes:  mudrek-backend, mudrek-frontend                  ║
# ║    Nginx:          reload only (zero downtime, WordPress stays up)  ║
# ║    PostgreSQL:     mudrek_db only                                    ║
# ║                                                                      ║
# ║  WHAT THIS SCRIPT NEVER TOUCHES:                                    ║
# ║    /var/www/html/       ← WordPress files                           ║
# ║    MySQL / MariaDB      ← WordPress database                        ║
# ║    WordPress Nginx conf ← your existing sites-available files       ║
# ║    Apache (if used)     ← untouched                                 ║
# ╚══════════════════════════════════════════════════════════════════════╝

set -e

APP_DIR="/var/www/mudrek"
LOG_DIR="$APP_DIR/logs"
BRANCH="master"

echo "======================================"
echo "  Mudrek CRM — Deploy  "
echo "======================================"

mkdir -p "$LOG_DIR"

# ── Safety: test Nginx config BEFORE making any changes ───────────────────────
echo "[SAFETY] Testing current Nginx config before deploy..."
if ! sudo nginx -t 2>/dev/null; then
  echo "❌ Nginx config already broken before deploy. Fix it first. Aborting."
  exit 1
fi
echo "  ✓ Nginx OK"

# ── Safety: confirm we are in the right directory ─────────────────────────────
if [ ! -f "$APP_DIR/ecosystem.config.js" ]; then
  echo "❌ Cannot find $APP_DIR/ecosystem.config.js — wrong directory? Aborting."
  exit 1
fi

# ── 1. Pull latest code ───────────────────────────────────────────────────────
echo "[1/6] Pulling latest code (branch: $BRANCH)..."
cd "$APP_DIR"
git pull origin "$BRANCH"

# ── 2. Backend: install deps ──────────────────────────────────────────────────
echo "[2/6] Installing backend dependencies..."
cd "$APP_DIR/backend"
npm install --omit=dev

# ── 3. DB migrations ──────────────────────────────────────────────────────────
echo "[3/6] Running database migrations (PostgreSQL — mudrek_db only)..."
npx prisma migrate deploy
npx prisma generate

# ── 4. Frontend: build ────────────────────────────────────────────────────────
echo "[4/6] Building frontend..."
cd "$APP_DIR/frontend"
npm install
npm run build

# ── 5. Restart only Mudrek PM2 processes ──────────────────────────────────────
echo "[5/6] Reloading Mudrek PM2 processes..."
cd "$APP_DIR"
# reload = zero-downtime restart for each process
# Only restarts mudrek-backend and mudrek-frontend — not any other PM2 apps
pm2 reload ecosystem.config.js --env production --only mudrek-backend,mudrek-frontend
pm2 save

# ── 6. Reload Nginx (NOT restart — reload keeps WordPress running) ─────────────
echo "[6/6] Reloading Nginx (zero downtime — WordPress stays live)..."
# Test config first — if broken, abort without touching Nginx
if sudo nginx -t 2>/dev/null; then
  sudo systemctl reload nginx
  echo "  ✓ Nginx reloaded"
else
  echo "  ⚠️  Nginx config test failed after deploy. Nginx NOT reloaded."
  echo "      Run: sudo nginx -t   to see the error."
  echo "      WordPress is unaffected — running on old config."
  exit 1
fi

echo ""
echo "✅ Deploy complete!"
echo "  CRM App  → https://crm.yourdomain.com"
echo "  API      → https://crm.yourdomain.com/api/health"
echo "  WordPress → unchanged and running"
echo "======================================"


# ══════════════════════════════════════════════════════════════════════════════
# FIRST-TIME SETUP — run these steps ONCE on the VPS
# (Your WordPress install is never touched by any of these steps)
# ══════════════════════════════════════════════════════════════════════════════
#
# ── STEP 1: DNS ───────────────────────────────────────────────────────────────
#   In your domain registrar (or Cloudflare), add:
#     Type: A
#     Name: crm          (creates crm.yourdomain.com)
#     Value: <your VPS IP>
#   Wait for DNS to propagate (usually 5–15 minutes).
#
# ── STEP 2: Check what's already on your VPS ──────────────────────────────────
#   pm2 list                          # see existing PM2 processes
#   sudo nginx -t                     # confirm WordPress Nginx config is healthy
#   ls /etc/nginx/sites-enabled/      # list existing Nginx sites (DON'T edit them)
#   node --version || echo "no node"  # check if Node.js is installed
#
# ── STEP 3: Install Node.js 20 (if not installed) ─────────────────────────────
#   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
#   source ~/.bashrc
#   nvm install 20 && nvm use 20 && nvm alias default 20
#   node --version   # should print v20.x.x
#
# ── STEP 4: Install PM2 (if not installed) ────────────────────────────────────
#   npm install -g pm2
#
# ── STEP 5: Install PostgreSQL (WordPress uses MySQL — no conflict) ────────────
#   sudo apt update
#   sudo apt install postgresql postgresql-contrib -y
#   sudo systemctl start postgresql
#   sudo systemctl enable postgresql
#
#   # Create the CRM database (completely separate from WordPress MySQL)
#   sudo -u postgres psql <<SQL
#     CREATE USER mudrek WITH PASSWORD 'CHOOSE_A_STRONG_PASSWORD';
#     CREATE DATABASE mudrek_db OWNER mudrek;
#     \q
#   SQL
#
# ── STEP 6: Clone the CRM repo ────────────────────────────────────────────────
#   mkdir -p /var/www/mudrek
#   cd /var/www/mudrek
#   git clone https://github.com/fadySWHS/mudrek-studentsClints-crm.git .
#   mkdir -p logs
#
# ── STEP 7: Create .env files ─────────────────────────────────────────────────
#   cp backend/.env.example backend/.env
#   nano backend/.env
#   # Fill in:
#   #   DATABASE_URL="postgresql://mudrek:CHOOSE_A_STRONG_PASSWORD@localhost:5432/mudrek_db"
#   #   JWT_SECRET="run: node -e \"require('crypto').randomBytes(64).toString('hex')\""
#   #   NODE_ENV="production"
#   #   PORT=4000
#   #   FRONTEND_URL="https://crm.yourdomain.com"
#   #   APP_BASE_URL="https://crm.yourdomain.com"
#   # (Leave TWOCHAT / GOOGLE keys blank — set them from the CRM admin UI later)
#
#   cp frontend/.env.local.example frontend/.env.local
#   nano frontend/.env.local
#   # Set:
#   #   NEXT_PUBLIC_API_URL=https://crm.yourdomain.com/api
#
# ── STEP 8: Install deps + migrate + seed ─────────────────────────────────────
#   cd /var/www/mudrek/backend
#   npm install
#   npx prisma migrate deploy
#   npx prisma generate
#   npm run db:seed         # creates admin@mudrek.com / admin123
#                           # ⚠️  CHANGE THIS PASSWORD after first login!
#
#   cd /var/www/mudrek/frontend
#   npm install
#   npm run build
#
# ── STEP 9: Start PM2 ─────────────────────────────────────────────────────────
#   cd /var/www/mudrek
#   pm2 start ecosystem.config.js --env production
#   pm2 save
#   pm2 startup   # copy and run the printed command to survive reboots
#
# ── STEP 10: Add Nginx config for the CRM subdomain ──────────────────────────
#   # Copy config (does NOT touch your WordPress nginx file)
#   sudo cp /var/www/mudrek/server/nginx/mudrek.conf /etc/nginx/sites-available/mudrek-crm
#
#   # Replace 'crm.yourdomain.com' with your actual subdomain
#   sudo nano /etc/nginx/sites-available/mudrek-crm
#
#   # Enable it (your WordPress site config is untouched)
#   sudo ln -s /etc/nginx/sites-available/mudrek-crm /etc/nginx/sites-enabled/mudrek-crm
#
#   # Test — if this fails, DO NOT reload nginx
#   sudo nginx -t
#
#   # Only reload if test passed
#   sudo systemctl reload nginx
#
# ── STEP 11: SSL for the CRM subdomain only ───────────────────────────────────
#   sudo apt install certbot python3-certbot-nginx -y
#
#   # Issues a certificate ONLY for crm.yourdomain.com
#   # Does NOT touch your main domain's certificate
#   sudo certbot --nginx -d crm.yourdomain.com
#
#   # Test renewal (safe to run anytime)
#   sudo certbot renew --dry-run
#
# ── STEP 12: Verify everything ────────────────────────────────────────────────
#   curl https://crm.yourdomain.com/api/health   # should return {"status":"ok"}
#   curl https://yourdomain.com                  # WordPress should still work
#   pm2 list                                     # mudrek-backend + mudrek-frontend = online
#   sudo nginx -t                                # config should be valid
#
# ── Future deploys ────────────────────────────────────────────────────────────
#   cd /var/www/mudrek && bash server/deploy.sh
