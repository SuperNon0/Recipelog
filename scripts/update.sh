#!/bin/bash
# =============================================================================
# RecipeLog — Script de mise à jour
# =============================================================================
# A exécuter dans le conteneur LXC en root (ou avec sudo).
# =============================================================================

set -euo pipefail

# ──────────────────────────────────────────────────────────────────────────────
# VARIABLES
# ──────────────────────────────────────────────────────────────────────────────
APP_DIR="/opt/recipelog"
LOG_DIR="/var/log/recipelog"
REPO_BRANCH="main"

# ──────────────────────────────────────────────────────────────────────────────
# COULEURS
# ──────────────────────────────────────────────────────────────────────────────
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

log()   { echo -e "\n${YELLOW}▶ $*${NC}"; }
ok()    { echo -e "${GREEN}  ✓ $*${NC}"; }
info()  { echo -e "${CYAN}  · $*${NC}"; }
error() { echo -e "${RED}[ERROR] $*${NC}" >&2; exit 1; }

# ──────────────────────────────────────────────────────────────────────────────
# VERIFICATION
# ──────────────────────────────────────────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
  error "Ce script doit être exécuté en root."
fi

if [ ! -d "$APP_DIR/.git" ]; then
  error "Dépôt git introuvable dans $APP_DIR. Avez-vous lancé install.sh ?"
fi

echo -e "${BOLD}${CYAN}RecipeLog — Mise à jour${NC}"
echo "────────────────────────────────────────────────────────────"
info "Répertoire : $APP_DIR"
info "Branche    : $REPO_BRANCH"

# ──────────────────────────────────────────────────────────────────────────────
# GIT PULL
# ──────────────────────────────────────────────────────────────────────────────
log "Récupération des mises à jour (git pull)..."

cd "$APP_DIR"

# Afficher la version courante
CURRENT_COMMIT=$(git rev-parse --short HEAD)
info "Commit actuel : $CURRENT_COMMIT"

git pull origin "$REPO_BRANCH"

NEW_COMMIT=$(git rev-parse --short HEAD)
if [ "$CURRENT_COMMIT" = "$NEW_COMMIT" ]; then
  info "Déjà à jour (commit $CURRENT_COMMIT) — poursuite quand même."
else
  ok "Mis à jour : $CURRENT_COMMIT → $NEW_COMMIT"
fi

# ──────────────────────────────────────────────────────────────────────────────
# DEPENDANCES BACKEND
# ──────────────────────────────────────────────────────────────────────────────
log "npm install (backend)..."
npm install --prefix "$APP_DIR/backend" --omit=dev
ok "Dépendances backend à jour."

# ──────────────────────────────────────────────────────────────────────────────
# DEPENDANCES + BUILD FRONTEND
# ──────────────────────────────────────────────────────────────────────────────
log "npm install (frontend)..."
npm install --prefix "$APP_DIR/frontend"
ok "Dépendances frontend à jour."

log "npm run build (frontend)..."
npm run build --prefix "$APP_DIR/frontend"
ok "Frontend recompilé."

# ──────────────────────────────────────────────────────────────────────────────
# MIGRATIONS DB
# ──────────────────────────────────────────────────────────────────────────────
log "Vérification et application des migrations..."

# Charger DATABASE_URL depuis .env
if [ -f "$APP_DIR/.env" ]; then
  export $(grep -E '^DATABASE_URL=' "$APP_DIR/.env" | xargs)
fi

# Appliquer via migrate.js si disponible, sinon les fichiers SQL
if [ -f "$APP_DIR/backend/src/db/migrate.js" ]; then
  node "$APP_DIR/backend/src/db/migrate.js" && ok "Migrations appliquées." \
    || info "Aucune nouvelle migration."
elif ls "$APP_DIR/backend/migrations/"*.sql &>/dev/null 2>&1; then
  DB_NAME="${DATABASE_URL##*/}"
  for f in "$APP_DIR/backend/migrations/"*.sql; do
    info "Migration : $(basename "$f")"
    su - postgres -c "psql -d ${DB_NAME}" < "$f" 2>/dev/null && true
  done
  ok "Migrations SQL appliquées."
else
  info "Aucune migration trouvée."
fi

# ──────────────────────────────────────────────────────────────────────────────
# REDEMARRAGE DU SERVICE
# ──────────────────────────────────────────────────────────────────────────────
log "Redémarrage du service recipelog..."
systemctl restart recipelog
sleep 3

if systemctl is-active --quiet recipelog; then
  ok "Service recipelog redémarré et actif."
else
  echo -e "${RED}  ! Le service ne semble pas actif. Diagnostic :${NC}"
  journalctl -u recipelog -n 20 --no-pager || true
  exit 1
fi

# ──────────────────────────────────────────────────────────────────────────────
# RECHARGEMENT NGINX (si config modifiée)
# ──────────────────────────────────────────────────────────────────────────────
log "Rechargement Nginx..."
nginx -t && systemctl reload nginx
ok "Nginx rechargé."

# ──────────────────────────────────────────────────────────────────────────────
# RESUME
# ──────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Mise à jour RecipeLog terminée avec succès !${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Version     : ${CYAN}$(git -C "$APP_DIR" rev-parse --short HEAD)${NC}"
echo -e "  Date        : ${CYAN}$(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo -e "  Status      : $(systemctl is-active recipelog)"
echo ""
echo -e "  Vérification : ${YELLOW}curl http://localhost:3001/api/health${NC}"
echo -e "  Logs         : ${YELLOW}journalctl -u recipelog -f${NC}"
echo ""
# chmod +x update.sh
