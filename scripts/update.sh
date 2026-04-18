#!/bin/bash
# ============================================================
# RecipeLog — Script de mise à jour
# ============================================================
set -e

APP_DIR="/opt/recipelog"

echo "▶ Mise à jour RecipeLog..."

cd "$APP_DIR"

echo "▶ git pull..."
git pull origin main

echo "▶ Mise à jour des dépendances..."
npm install --workspace=backend --omit=dev
npm install --workspace=frontend

echo "▶ Build du frontend..."
npm run build --workspace=frontend

echo "▶ Migrations DB..."
node backend/src/db/migrate.js 2>/dev/null || echo "Aucune nouvelle migration"

echo "▶ Redémarrage du service..."
systemctl restart recipelog

sleep 2
systemctl is-active recipelog && echo "✓ RecipeLog redémarré avec succès" || echo "⚠ Vérifier le service : journalctl -u recipelog -n 30"
