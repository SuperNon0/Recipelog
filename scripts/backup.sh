#!/bin/bash
# =============================================================================
# RecipeLog — Script de sauvegarde
# =============================================================================
# A exécuter dans le conteneur LXC en root (ou via cron).
# Exemple cron quotidien à 2h :
#   0 2 * * * /opt/recipelog/scripts/backup.sh >> /var/log/recipelog/backup.log 2>&1
# =============================================================================

set -euo pipefail

# ──────────────────────────────────────────────────────────────────────────────
# VARIABLES
# ──────────────────────────────────────────────────────────────────────────────
APP_DIR="/opt/recipelog"
UPLOAD_DIR="/var/lib/recipelog/uploads"
BACKUP_DIR="/var/backups/recipelog"
LOG_DIR="/var/log/recipelog"

DB_NAME="recipelog"
DB_USER="recipelog"

RETENTION_DAYS=30

# ──────────────────────────────────────────────────────────────────────────────
# COULEURS (désactivées si sortie non-terminal)
# ──────────────────────────────────────────────────────────────────────────────
if [ -t 1 ]; then
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  RED='\033[0;31m'
  CYAN='\033[0;36m'
  NC='\033[0m'
else
  GREEN='' YELLOW='' RED='' CYAN='' NC=''
fi

log()   { echo -e "${YELLOW}▶ $*${NC}"; }
ok()    { echo -e "${GREEN}  ✓ $*${NC}"; }
info()  { echo -e "${CYAN}  · $*${NC}"; }
error() { echo -e "${RED}[ERROR] $*${NC}" >&2; exit 1; }

# ──────────────────────────────────────────────────────────────────────────────
# VERIFICATION
# ──────────────────────────────────────────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
  error "Ce script doit être exécuté en root."
fi

# Horodatage
TS=$(date +"%Y-%m-%d_%H%M%S")

echo ""
echo -e "${CYAN}RecipeLog — Sauvegarde du ${TS}${NC}"
echo "────────────────────────────────────────────────────────────"

# Créer le répertoire de backup si absent
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

# ──────────────────────────────────────────────────────────────────────────────
# DUMP POSTGRESQL
# ──────────────────────────────────────────────────────────────────────────────
log "Dump de la base de données PostgreSQL..."

DB_DUMP_FILE="${BACKUP_DIR}/recipelog_db_${TS}.sql"

# pg_dump avec l'utilisateur postgres pour les droits
su - postgres -c "pg_dump \
  --username=${DB_USER} \
  --no-password \
  --format=plain \
  --clean \
  --if-exists \
  ${DB_NAME}" > "$DB_DUMP_FILE"

# Compression
gzip -9 "$DB_DUMP_FILE"
DB_DUMP_GZ="${DB_DUMP_FILE}.gz"

DB_SIZE=$(du -sh "$DB_DUMP_GZ" | cut -f1)
ok "Base de données sauvegardée : $(basename "$DB_DUMP_GZ") (${DB_SIZE})"

# ──────────────────────────────────────────────────────────────────────────────
# ARCHIVE DES UPLOADS
# ──────────────────────────────────────────────────────────────────────────────
log "Archive des uploads..."

UPLOADS_ARCHIVE="${BACKUP_DIR}/recipelog_uploads_${TS}.tar.gz"

if [ -d "$UPLOAD_DIR" ] && [ -n "$(ls -A "$UPLOAD_DIR" 2>/dev/null)" ]; then
  tar \
    --create \
    --gzip \
    --file="$UPLOADS_ARCHIVE" \
    --directory="$(dirname "$UPLOAD_DIR")" \
    "$(basename "$UPLOAD_DIR")"
  UPLOADS_SIZE=$(du -sh "$UPLOADS_ARCHIVE" | cut -f1)
  ok "Uploads archivés : $(basename "$UPLOADS_ARCHIVE") (${UPLOADS_SIZE})"
else
  info "Dossier uploads vide ou absent — archive ignorée."
fi

# ──────────────────────────────────────────────────────────────────────────────
# ARCHIVE DU FICHIER .env (optionnel mais utile pour restauration rapide)
# ──────────────────────────────────────────────────────────────────────────────
log "Sauvegarde du fichier .env..."

ENV_BACKUP="${BACKUP_DIR}/recipelog_env_${TS}.env.gpg"

if [ -f "$APP_DIR/.env" ]; then
  # Copie simple (chiffrée si gpg disponible, sinon copie brute avec permissions restreintes)
  if command -v gpg &>/dev/null && gpg --list-secret-keys &>/dev/null 2>&1; then
    gpg --symmetric --cipher-algo AES256 --output "$ENV_BACKUP" "$APP_DIR/.env"
    ok ".env sauvegardé (chiffré GPG) : $(basename "$ENV_BACKUP")"
  else
    cp "$APP_DIR/.env" "${BACKUP_DIR}/recipelog_env_${TS}.env"
    chmod 600 "${BACKUP_DIR}/recipelog_env_${TS}.env"
    ok ".env sauvegardé (non chiffré) : recipelog_env_${TS}.env"
  fi
else
  info "Fichier .env introuvable — ignoré."
fi

# ──────────────────────────────────────────────────────────────────────────────
# NETTOYAGE DES ANCIENS BACKUPS
# ──────────────────────────────────────────────────────────────────────────────
log "Nettoyage des sauvegardes de plus de ${RETENTION_DAYS} jours..."

# Compter avant suppression
BEFORE=$(find "$BACKUP_DIR" -type f | wc -l)

find "$BACKUP_DIR" -type f \( \
  -name "recipelog_db_*.sql.gz" \
  -o -name "recipelog_uploads_*.tar.gz" \
  -o -name "recipelog_env_*.env" \
  -o -name "recipelog_env_*.env.gpg" \
\) -mtime "+${RETENTION_DAYS}" -delete

AFTER=$(find "$BACKUP_DIR" -type f | wc -l)
REMOVED=$(( BEFORE - AFTER ))

ok "Nettoyage terminé : ${REMOVED} fichier(s) supprimé(s)."

# ──────────────────────────────────────────────────────────────────────────────
# RESUME DES FICHIERS CREES
# ──────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Sauvegarde RecipeLog terminée — ${TS}${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Dossier de backup : ${CYAN}${BACKUP_DIR}${NC}"
echo ""
echo "  Fichiers créés lors de cette sauvegarde :"
find "$BACKUP_DIR" -name "*_${TS}*" -type f | while read -r f; do
  SIZE=$(du -sh "$f" | cut -f1)
  echo -e "    ${CYAN}$(basename "$f")${NC}  (${SIZE})"
done
echo ""

# Espace total utilisé par les backups
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
TOTAL_FILES=$(find "$BACKUP_DIR" -type f | wc -l)
echo -e "  Total backups : ${TOTAL_FILES} fichier(s) — ${TOTAL_SIZE}"
echo ""
# chmod +x backup.sh
