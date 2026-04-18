# RecipeLog — Guide de backup

---

## Backup manuel

```bash
cd /opt/recipelog
bash scripts/backup.sh
```

Les backups sont stockés dans `/var/backups/recipelog/`.

---

## Contenu du backup

| Fichier | Contenu |
|---|---|
| `recipelog_db_YYYY-MM-DD_HHMMSS.sql` | Dump PostgreSQL complet |
| `recipelog_uploads_YYYY-MM-DD_HHMMSS.tar.gz` | Archive des photos uploadées |

---

## Restauration

### Base de données
```bash
# Arrêter l'application
systemctl stop recipelog

# Restaurer le dump
psql -U recipelog -d recipelog < /var/backups/recipelog/recipelog_db_2025-01-01_120000.sql

# Redémarrer
systemctl start recipelog
```

### Fichiers uploadés
```bash
tar -xzf /var/backups/recipelog/recipelog_uploads_2025-01-01_120000.tar.gz -C /
```

---

## Automatiser les backups (cron)

```bash
# Éditer crontab
crontab -e

# Backup quotidien à 3h du matin
0 3 * * * cd /opt/recipelog && bash scripts/backup.sh >> /var/log/recipelog/backup.log 2>&1
```

---

## Externaliser les backups

Pour envoyer les backups vers un NAS ou S3, ajoutez à la fin de `scripts/backup.sh` :

```bash
# Vers un NAS via rsync
rsync -avz /var/backups/recipelog/ user@nas:/backups/recipelog/

# Vers S3 (nécessite aws-cli)
aws s3 sync /var/backups/recipelog/ s3://mon-bucket/recipelog/
```

> **Note :** Cette automatisation sera développée en V2.
