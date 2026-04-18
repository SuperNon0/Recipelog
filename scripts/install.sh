#!/bin/bash
# =============================================================================
# RecipeLog — Script d'installation complet
# =============================================================================
# A exécuter dans le conteneur LXC Debian 12 (en root).
# =============================================================================

set -euo pipefail

# ──────────────────────────────────────────────────────────────────────────────
# VARIABLES
# ──────────────────────────────────────────────────────────────────────────────
APP_DIR="/opt/recipelog"
UPLOAD_DIR="/var/lib/recipelog/uploads"
LOG_DIR="/var/log/recipelog"
BACKUP_DIR="/var/backups/recipelog"

DB_NAME="recipelog"
DB_USER="recipelog"
DB_PASS="$(openssl rand -hex 20)"

REPO_URL="https://github.com/supernon0/recipelog.git"
REPO_BRANCH="main"

NODE_VERSION="20"
PG_VERSION="15"

# ──────────────────────────────────────────────────────────────────────────────
# COULEURS
# ──────────────────────────────────────────────────────────────────────────────
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

log()     { echo -e "\n${YELLOW}▶ $*${NC}"; }
ok()      { echo -e "${GREEN}  ✓ $*${NC}"; }
info()    { echo -e "${CYAN}  · $*${NC}"; }
error()   { echo -e "${RED}[ERROR] $*${NC}" >&2; exit 1; }
section() { echo -e "\n${BOLD}${CYAN}── $* ──────────────────────────────────────────────${NC}"; }

# ──────────────────────────────────────────────────────────────────────────────
# VERIFICATION
# ──────────────────────────────────────────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
  error "Ce script doit être exécuté en root."
fi

if ! grep -qi "debian" /etc/os-release 2>/dev/null; then
  error "Distribution non supportée. Debian 12 requis."
fi

section "RecipeLog — Installation"
echo "  Répertoire app : $APP_DIR"
echo "  Uploads        : $UPLOAD_DIR"
echo "  Logs           : $LOG_DIR"
echo "  Repo           : $REPO_URL"
echo ""

# ──────────────────────────────────────────────────────────────────────────────
# MISE A JOUR DU SYSTEME
# ──────────────────────────────────────────────────────────────────────────────
section "1 — Mise à jour du système"

log "apt update && apt upgrade..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
ok "Système à jour."

log "Installation des paquets de base..."
apt-get install -y -qq \
  curl \
  wget \
  git \
  openssl \
  ca-certificates \
  gnupg \
  lsb-release \
  ufw \
  logrotate \
  unzip
ok "Paquets de base installés."

# ──────────────────────────────────────────────────────────────────────────────
# NODE.JS 20 LTS (via NodeSource)
# ──────────────────────────────────────────────────────────────────────────────
section "2 — Node.js ${NODE_VERSION} LTS"

log "Ajout du dépôt NodeSource..."
curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash - 2>&1 | grep -E "(Package|Importing|OK)" || true
apt-get install -y -qq nodejs
ok "Node.js $(node --version) installé."
ok "npm $(npm --version) installé."

# ──────────────────────────────────────────────────────────────────────────────
# POSTGRESQL 15
# ──────────────────────────────────────────────────────────────────────────────
section "3 — PostgreSQL ${PG_VERSION}"

log "Ajout du dépôt PostgreSQL officiel..."
install -d /usr/share/postgresql-common/pgdg
curl -fsSL "https://www.postgresql.org/media/keys/ACCC4CF8.asc" \
  | gpg --dearmor -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg
echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg] \
https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
  > /etc/apt/sources.list.d/pgdg.list
apt-get update -qq
apt-get install -y -qq "postgresql-${PG_VERSION}"
systemctl enable --now postgresql
ok "PostgreSQL ${PG_VERSION} installé et démarré."

# ──────────────────────────────────────────────────────────────────────────────
# NGINX
# ──────────────────────────────────────────────────────────────────────────────
section "4 — Nginx"

log "Installation de Nginx..."
apt-get install -y -qq nginx
systemctl enable nginx
ok "Nginx installé."

# ──────────────────────────────────────────────────────────────────────────────
# CLONE DU REPO
# ──────────────────────────────────────────────────────────────────────────────
section "5 — Clone du dépôt RecipeLog"

log "Clonage de $REPO_URL..."
if [ -d "$APP_DIR/.git" ]; then
  info "Dépôt existant détecté — git pull..."
  git -C "$APP_DIR" pull origin "$REPO_BRANCH"
else
  git clone --branch "$REPO_BRANCH" "$REPO_URL" "$APP_DIR"
fi
ok "Dépôt cloné dans $APP_DIR."

# ──────────────────────────────────────────────────────────────────────────────
# DEPENDANCES NPM
# ──────────────────────────────────────────────────────────────────────────────
section "6 — Dépendances npm"

log "npm install (backend)..."
npm install --prefix "$APP_DIR/backend" --omit=dev
ok "Dépendances backend installées."

log "npm install (frontend)..."
npm install --prefix "$APP_DIR/frontend"
ok "Dépendances frontend installées."

log "npm run build (frontend)..."
npm run build --prefix "$APP_DIR/frontend"
ok "Frontend compilé."

# ──────────────────────────────────────────────────────────────────────────────
# DOSSIERS DE DONNEES
# ──────────────────────────────────────────────────────────────────────────────
section "7 — Dossiers de données"

log "Création des dossiers..."
mkdir -p "$UPLOAD_DIR" "$LOG_DIR" "$BACKUP_DIR" /tmp/recipelog-pdf
chown -R www-data:www-data "$UPLOAD_DIR" "$LOG_DIR"
chmod 750 "$UPLOAD_DIR" "$LOG_DIR"
ok "Dossiers créés : $UPLOAD_DIR / $LOG_DIR / $BACKUP_DIR"

# ──────────────────────────────────────────────────────────────────────────────
# BASE DE DONNEES POSTGRESQL
# ──────────────────────────────────────────────────────────────────────────────
section "8 — Base de données PostgreSQL"

log "Création de l'utilisateur $DB_USER..."
su - postgres -c "psql -tc \"SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'\"" \
  | grep -q 1 || \
  su - postgres -c "psql -c \"CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';\""
ok "Utilisateur $DB_USER prêt."

log "Création de la base $DB_NAME..."
su - postgres -c "psql -tc \"SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'\"" \
  | grep -q 1 || \
  su - postgres -c "psql -c \"CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};\""
ok "Base de données $DB_NAME créée."

log "Activation de l'extension pg_trgm..."
su - postgres -c "psql -d ${DB_NAME} -c \"CREATE EXTENSION IF NOT EXISTS pg_trgm;\"" || true
ok "Extension pg_trgm activée."

# ──────────────────────────────────────────────────────────────────────────────
# FICHIER .env
# ──────────────────────────────────────────────────────────────────────────────
section "9 — Fichier de configuration .env"

if [ -f "$APP_DIR/.env.example" ]; then
  cp "$APP_DIR/.env.example" "$APP_DIR/.env"
  info "Copie de .env.example → .env"
fi

log "Ecriture des variables d'environnement..."
cat > "$APP_DIR/.env" << EOF
# =============================================================================
# RecipeLog — Configuration (généré par install.sh le $(date +%Y-%m-%d))
# =============================================================================

# Base de données
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}

# Serveur
PORT=3001
HOST=127.0.0.1
NODE_ENV=production

# URL publique (à adapter selon votre domaine)
PUBLIC_URL=http://localhost

# Uploads
UPLOAD_DIR=${UPLOAD_DIR}
MAX_FILE_SIZE_MB=10

# PDF (Puppeteer)
PDF_TEMP_DIR=/tmp/recipelog-pdf

# Logs
LOG_DIR=${LOG_DIR}
LOG_LEVEL=info

# Authentification Cloudflare Access (optionnel)
CF_AUTH_EMAIL_HEADER=Cf-Access-Authenticated-User-Email

# Partage de recettes
SHARE_TOKEN_LENGTH=12
EOF

chmod 600 "$APP_DIR/.env"
ok ".env créé et sécurisé (chmod 600)."

# ──────────────────────────────────────────────────────────────────────────────
# MIGRATIONS ET SEED
# ──────────────────────────────────────────────────────────────────────────────
section "10 — Migrations et initialisation de la base"

log "Application des migrations SQL..."
if ls "$APP_DIR/backend/migrations/"*.sql &>/dev/null 2>&1; then
  for f in "$APP_DIR/backend/migrations/"*.sql; do
    info "Migration : $(basename "$f")"
    su - postgres -c "psql -d ${DB_NAME}" < "$f"
  done
  ok "Migrations appliquées."
elif [ -f "$APP_DIR/backend/src/db/migrate.js" ]; then
  DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}" \
    node "$APP_DIR/backend/src/db/migrate.js"
  ok "Migrations appliquées via migrate.js."
else
  info "Aucune migration trouvée — à appliquer manuellement si nécessaire."
fi

log "Seed de la base de données..."
if [ -f "$APP_DIR/backend/src/db/seed.js" ]; then
  DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}" \
    node "$APP_DIR/backend/src/db/seed.js"
  ok "Seed effectué."
else
  info "Aucun fichier seed trouvé — ignoré."
fi

# ──────────────────────────────────────────────────────────────────────────────
# SERVICE SYSTEMD
# ──────────────────────────────────────────────────────────────────────────────
section "11 — Service systemd"

log "Création du service recipelog.service..."
cat > /etc/systemd/system/recipelog.service << SVCEOF
[Unit]
Description=RecipeLog — Gestionnaire de recettes culinaires
Documentation=https://github.com/supernon0/recipelog
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=${APP_DIR}/backend
ExecStart=/usr/bin/node src/index.js
EnvironmentFile=${APP_DIR}/.env
Restart=always
RestartSec=5
StartLimitInterval=60
StartLimitBurst=3

# Sécurité
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=${UPLOAD_DIR} ${LOG_DIR} /tmp/recipelog-pdf

# Journalisation
StandardOutput=append:${LOG_DIR}/app.log
StandardError=append:${LOG_DIR}/error.log

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable recipelog
systemctl start recipelog
ok "Service recipelog.service créé, activé et démarré."

# ──────────────────────────────────────────────────────────────────────────────
# CONFIGURATION NGINX
# ──────────────────────────────────────────────────────────────────────────────
section "12 — Configuration Nginx"

log "Ecriture de la configuration Nginx..."
cat > /etc/nginx/sites-available/recipelog << 'NGINXEOF'
# RecipeLog — Reverse proxy Nginx
server {
    listen 80;
    listen [::]:80;
    server_name _;

    # Taille maximale des uploads
    client_max_body_size 15M;

    # Logs
    access_log /var/log/nginx/recipelog.access.log;
    error_log  /var/log/nginx/recipelog.error.log;

    # Fichiers statiques SvelteKit
    root /opt/recipelog/frontend/build;
    index index.html;

    # API backend Node.js
    location /api/ {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
    }

    # Uploads servis par le backend
    location /uploads/ {
        proxy_pass         http://127.0.0.1:3001;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        expires            30d;
        add_header         Cache-Control "public, immutable";
    }

    # Liens de partage public
    location /p/ {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
    }

    # SvelteKit — SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
        expires -1;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # Fichiers statiques SvelteKit (immutables)
    location /_app/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Santé
    location /healthz {
        proxy_pass http://127.0.0.1:3001/api/health;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/recipelog /etc/nginx/sites-enabled/recipelog
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl reload nginx
ok "Nginx configuré et rechargé."

# ──────────────────────────────────────────────────────────────────────────────
# LOGROTATE
# ──────────────────────────────────────────────────────────────────────────────
section "13 — Rotation des logs"

cat > /etc/logrotate.d/recipelog << LOGREOF
${LOG_DIR}/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        systemctl reload recipelog 2>/dev/null || true
    endscript
}
LOGREOF

ok "Logrotate configuré."

# ──────────────────────────────────────────────────────────────────────────────
# VERIFICATION FINALE
# ──────────────────────────────────────────────────────────────────────────────
section "14 — Vérification"

sleep 3

if systemctl is-active --quiet recipelog; then
  ok "Service recipelog : actif"
else
  echo -e "${RED}  ! Service recipelog non actif. Vérifiez :${NC}"
  echo "    journalctl -u recipelog -n 30"
fi

if systemctl is-active --quiet nginx; then
  ok "Service nginx : actif"
else
  echo -e "${RED}  ! Nginx non actif.${NC}"
fi

if curl -sf http://localhost:3001/api/health > /dev/null 2>&1; then
  ok "API healthcheck : OK"
else
  echo -e "${YELLOW}  ~ API pas encore disponible (démarrage en cours...)${NC}"
fi

# ──────────────────────────────────────────────────────────────────────────────
# RESUME FINAL
# ──────────────────────────────────────────────────────────────────────────────
CT_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")

echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  RecipeLog installé avec succès !${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Application  : ${CYAN}http://${CT_IP}${NC}"
echo -e "  API health   : ${CYAN}http://${CT_IP}/api/health${NC}"
echo -e "  Logs app     : ${CYAN}${LOG_DIR}/app.log${NC}"
echo -e "  Logs erreurs : ${CYAN}${LOG_DIR}/error.log${NC}"
echo ""
echo -e "${BOLD}Commandes utiles :${NC}"
echo -e "  systemctl status recipelog"
echo -e "  journalctl -u recipelog -f"
echo -e "  systemctl restart recipelog"
echo ""
echo -e "${YELLOW}IMPORTANT :${NC} Notez le mot de passe de la base de données :"
echo -e "  DB_USER : ${DB_USER}"
echo -e "  DB_PASS : ${DB_PASS}"
echo -e "  (Enregistré dans ${APP_DIR}/.env)"
echo ""
echo -e "Prochaines étapes :"
echo -e "  1. Adapter PUBLIC_URL dans ${APP_DIR}/.env"
echo -e "  2. Configurer votre domaine/reverse proxy Cloudflare"
echo -e "  3. Voir docs/INSTALL.md pour la configuration avancée"
echo ""
# chmod +x install.sh
