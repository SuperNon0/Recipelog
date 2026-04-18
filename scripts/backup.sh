#!/bin/bash
# ============================================================
# RecipeLog — Script de backup
# ============================================================
set -e

BACKUP_DIR="/var/backups/recipelog"
UPLOAD_DIR="/var/lib/recipelog/uploads"
APP_DIR="/opt/recipelog"
RETENTION_DAYS=30

DB_NAME="recipelog"
DB_USER="recipelog"

TS=$(date +"%Y-%m-%d_%H%M%S")
DB_FILE="$BACKUP_DIR/recipelog_db_$TS.sql"
UPLOADS_FILE="$BACKUP_DIR/recipelog_uploads_$TS.tar.gz"

mkdir -p "$BACKUP_DIR"

echo "▶ Backup RecipeLog — $TS"

# ── Dump PostgreSQL ───────────────────────────────────────
echo "▶ Dump base de données..."
su - postgres -c "pg_dump -U $DB_USER $DB_NAME" > "$DB_FILE"
gzip "$DB_FILE"
echo "✓ BDD → ${DB_FILE}.gz ($(du -sh "${DB_FILE}.gz" | cut -f1))"

# ── Archive uploads ───────────────────────────────────────
if [ -d "$UPLOAD_DIR" ] && [ "$(ls -A "$UPLOAD_DIR")" ]; then
  echo "▶ Archive des uploads..."
  tar -czf "$UPLOADS_FILE" -C "$(dirname "$UPLOAD_DIR")" "$(basename "$UPLOAD_DIR")"
  echo "✓ Uploads → $UPLOADS_FILE ($(du -sh "$UPLOADS_FILE" | cut -f1))"
else
  echo "— Aucun upload à archiver"
fi

# ── Nettoyage des vieux backups ───────────────────────────
echo "▶ Nettoyage des backups > ${RETENTION_DAYS} jours..."
find "$BACKUP_DIR" -type f -mtime +$RETENTION_DAYS -delete
echo "✓ Nettoyage effectué"

# ── Résumé ────────────────────────────────────────────────
echo ""
echo "Backup terminé : $BACKUP_DIR"
ls -lh "$BACKUP_DIR" | grep "$TS"
