#!/bin/bash
# ============================================================
# RecipeLog — Script d'installation
# Exécuter dans le conteneur LXC Debian 12
# ============================================================
set -e

APP_DIR="/opt/recipelog"
UPLOAD_DIR="/var/lib/recipelog/uploads"
LOG_DIR="/var/log/recipelog"
DB_NAME="recipelog"
DB_USER="recipelog"
DB_PASS="$(openssl rand -hex 16)"
REPO_URL="https://github.com/supernon0/recipelog.git"

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${YELLOW}▶ $1${NC}"; }
ok()  { echo -e "${GREEN}✓ $1${NC}"; }

log "Mise à jour du système..."
apt-get update -qq && apt-get upgrade -y -qq

# ── Node.js 20 LTS ────────────────────────────────────────
log "Installation de Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - -qq
apt-get install -y nodejs -qq
ok "Node.js $(node -v) installé"

# ── PostgreSQL 15 ─────────────────────────────────────────
log "Installation de PostgreSQL 15..."
apt-get install -y postgresql-15 -qq
systemctl enable --now postgresql
ok "PostgreSQL installé"

# ── Nginx ─────────────────────────────────────────────────
log "Installation de Nginx..."
apt-get install -y nginx -qq
ok "Nginx installé"

# ── Outils ────────────────────────────────────────────────
apt-get install -y git curl openssl -qq

# ── Clone du dépôt ────────────────────────────────────────
log "Clonage du dépôt RecipeLog..."
if [ -d "$APP_DIR" ]; then
  cd "$APP_DIR" && git pull
else
  git clone "$REPO_URL" "$APP_DIR"
fi
ok "Dépôt cloné dans $APP_DIR"

# ── Dossiers ──────────────────────────────────────────────
mkdir -p "$UPLOAD_DIR" "$LOG_DIR"
chown -R www-data:www-data "$UPLOAD_DIR"
ok "Dossiers créés"

# ── Base de données ───────────────────────────────────────
log "Configuration de PostgreSQL..."
su - postgres -c "psql -c \"CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';\"" 2>/dev/null || true
su - postgres -c "psql -c \"CREATE DATABASE $DB_NAME OWNER $DB_USER;\"" 2>/dev/null || true
su - postgres -c "psql -d $DB_NAME -c \"CREATE EXTENSION IF NOT EXISTS pg_trgm;\"" 2>/dev/null || true
ok "Base de données $DB_NAME créée"

# ── Fichier .env ──────────────────────────────────────────
log "Création du fichier .env..."
cat > "$APP_DIR/.env" << EOF
DATABASE_URL=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME
PORT=3001
HOST=127.0.0.1
NODE_ENV=production
PUBLIC_URL=https://recipe.super-nono.cc
UPLOAD_DIR=$UPLOAD_DIR
MAX_FILE_SIZE_MB=10
PDF_TEMP_DIR=/tmp/recipelog-pdf
LOG_DIR=$LOG_DIR
LOG_LEVEL=info
CF_AUTH_EMAIL_HEADER=Cf-Access-Authenticated-User-Email
SHARE_TOKEN_LENGTH=12
EOF
chmod 600 "$APP_DIR/.env"
ok ".env créé"

# ── Dépendances npm ───────────────────────────────────────
log "Installation des dépendances..."
cd "$APP_DIR"
npm install --workspace=backend --omit=dev
npm install --workspace=frontend
npm run build --workspace=frontend
ok "Dépendances installées et frontend buildé"

# ── Migrations ────────────────────────────────────────────
log "Application des migrations..."
cd "$APP_DIR"
su - postgres -c "psql -d $DB_NAME" < "$APP_DIR/backend/migrations/0001_initial.sql"
node "$APP_DIR/backend/src/db/seed.js"
ok "Base de données initialisée"

# ── Service systemd ───────────────────────────────────────
log "Configuration du service systemd..."
cat > /etc/systemd/system/recipelog.service << EOF
[Unit]
Description=RecipeLog — Gestionnaire de recettes
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=$APP_DIR/backend
ExecStart=/usr/bin/node src/index.js
EnvironmentFile=$APP_DIR/.env
Restart=always
RestartSec=5
StandardOutput=append:$LOG_DIR/app.log
StandardError=append:$LOG_DIR/error.log

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now recipelog
ok "Service recipelog démarré"

# ── Nginx ─────────────────────────────────────────────────
log "Configuration Nginx..."
cat > /etc/nginx/sites-available/recipelog << 'EOF'
server {
    listen 80;
    server_name _;

    client_max_body_size 15M;

    # Frontend SvelteKit (build statique)
    root /opt/recipelog/frontend/build;
    index index.html;

    # API → backend Node.js
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Uploads
    location /uploads/ {
        proxy_pass http://127.0.0.1:3001;
    }

    # Liens de partage public
    location /p/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    # SvelteKit SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

ln -sf /etc/nginx/sites-available/recipelog /etc/nginx/sites-enabled/recipelog
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
ok "Nginx configuré"

# ── Fin ───────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}=====================================${NC}"
echo -e "${BOLD}${GREEN} RecipeLog installé avec succès !${NC}"
echo -e "${BOLD}${GREEN}=====================================${NC}"
echo ""
echo "  Mot de passe BDD : $DB_PASS (sauvegardé dans .env)"
echo "  Service :          systemctl status recipelog"
echo "  Logs :             journalctl -u recipelog -f"
echo "  Healthcheck :      curl http://localhost:3001/api/health"
echo ""
echo "  Prochaine étape : configurer Cloudflare Zero Trust"
echo "  Voir : docs/INSTALL.md"
