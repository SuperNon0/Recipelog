# RecipeLog — Guide de mise à jour

---

## Mise à jour automatique

```bash
# Sur le LXC
cd /opt/recipelog
bash scripts/update.sh
```

---

## Mise à jour manuelle

```bash
cd /opt/recipelog

# 1. Récupérer les changements
git pull origin main

# 2. Mettre à jour les dépendances
npm install --workspace=backend
npm install --workspace=frontend

# 3. Rebuilder le frontend
npm run build --workspace=frontend

# 4. Appliquer les nouvelles migrations (si besoin)
npm run db:migrate --workspace=backend

# 5. Redémarrer le service
systemctl restart recipelog

# 6. Vérifier
systemctl status recipelog
curl http://localhost:3001/api/health
```

---

## En cas de problème

```bash
# Revenir à la version précédente
git log --oneline -10
git checkout <hash_commit>
systemctl restart recipelog
```

---

## Avant toute mise à jour

Effectuez un backup préventif :
```bash
bash scripts/backup.sh
```
