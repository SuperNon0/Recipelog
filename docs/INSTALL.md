# RecipeLog — Guide d'installation

> Installation dans un conteneur LXC Proxmox derrière Cloudflare Zero Trust.

---

## Pré-requis

- **Proxmox VE 7+** avec accès à l'hôte
- **Cloudflare** avec un domaine configuré
- **Cloudflare Zero Trust** activé sur votre compte
- Accès SSH à l'hôte Proxmox

---

## 1. Créer le conteneur LXC

```bash
# Sur l'hôte Proxmox
bash <(curl -fsSL https://raw.githubusercontent.com/supernon0/recipelog/main/scripts/proxmox-lxc-create.sh)
```

Ou manuellement :
```bash
chmod +x scripts/proxmox-lxc-create.sh
./scripts/proxmox-lxc-create.sh
```

**Variables configurables** en tête du script :
| Variable | Défaut | Description |
|---|---|---|
| `CTID` | 200 | ID du conteneur LXC |
| `HOSTNAME` | recipelog | Nom du conteneur |
| `RAM` | 512 | RAM en Mo |
| `CORES` | 2 | Nombre de CPU |
| `DISK` | 8 | Disque en Go |
| `BRIDGE` | vmbr0 | Bridge réseau |

---

## 2. Accéder au conteneur

```bash
pct enter 200
# ou
ssh root@<IP_DU_LXC>
```

---

## 3. Installer l'application

```bash
curl -fsSL https://raw.githubusercontent.com/supernon0/recipelog/main/scripts/install.sh | bash
```

Ou depuis le dépôt cloné :
```bash
chmod +x scripts/install.sh
./scripts/install.sh
```

Le script effectue automatiquement :
- Installation Node.js 20 LTS + PostgreSQL 15 + Nginx
- Clone du dépôt
- Installation des dépendances
- Build du frontend
- Création de la base de données et de l'utilisateur
- Exécution des migrations
- Configuration du service systemd
- Configuration Nginx

---

## 4. Configurer l'environnement

Après l'installation, éditez le fichier `.env` :

```bash
nano /opt/recipelog/.env
```

Variables importantes :
```env
DATABASE_URL=postgresql://recipelog:MOT_DE_PASSE@localhost:5432/recipelog
PUBLIC_URL=https://recipe.super-nono.cc
UPLOAD_DIR=/var/lib/recipelog/uploads
```

Redémarrer le service après modification :
```bash
systemctl restart recipelog
```

---

## 5. Configurer Cloudflare Zero Trust

### 5.1 Tunnel Cloudflare

```bash
# Installer cloudflared dans le LXC
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared

# Authentification
cloudflared tunnel login

# Créer le tunnel
cloudflared tunnel create recipelog

# Configurer le tunnel
cat > /etc/cloudflared/config.yml << EOF
tunnel: <TUNNEL_ID>
credentials-file: /root/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: recipe.super-nono.cc
    service: http://localhost:80
  - service: http_status:404
EOF

# Service systemd
cloudflared service install
systemctl enable --now cloudflared
```

### 5.2 Application Zero Trust

Dans le dashboard Cloudflare Zero Trust :
1. **Access → Applications → Add an application → Self-hosted**
2. Nom : `RecipeLog`
3. Domain : `recipe.super-nono.cc`
4. Session duration : 24h

**Exclusion du chemin public `/p/*`** :
- Dans les règles de l'application, ajouter une règle **Bypass** pour `recipe.super-nono.cc/p/*`
- Cela permet aux visiteurs anonymes d'accéder aux liens de partage

---

## 6. Vérifier l'installation

```bash
# Statut du service
systemctl status recipelog

# Logs en temps réel
journalctl -u recipelog -f

# Healthcheck
curl http://localhost:3001/api/health
```

Réponse attendue :
```json
{ "status": "ok", "timestamp": "..." }
```

---

## 7. Import initial (Recipe Keeper)

Si vous avez un export PDF de Recipe Keeper à importer :

```bash
# Script d'import (à exécuter après la mise en production)
node /opt/recipelog/backend/src/utils/importRecipeKeeper.js /chemin/vers/export.pdf
```

> **Note :** Ce script doit être développé spécifiquement pour le format d'export du commanditaire. Contactez le développeur pour l'import initial.

---

## Structure des fichiers

```
/opt/recipelog/          → Code source de l'application
/var/lib/recipelog/
  uploads/               → Images uploadées
/var/log/recipelog/      → Logs applicatifs
/etc/nginx/sites-enabled/recipelog.conf  → Config Nginx
/etc/systemd/system/recipelog.service    → Service systemd
```

---

## Troubleshooting

### Le service ne démarre pas
```bash
journalctl -u recipelog -n 50
```

### Erreur de connexion PostgreSQL
```bash
su - postgres
psql -c "\l"
psql -c "\du"
```

### Nginx erreur 502
```bash
# Vérifier que le backend tourne
curl http://localhost:3001/api/health
systemctl status recipelog
```

### Permissions des uploads
```bash
chown -R www-data:www-data /var/lib/recipelog/uploads
chmod 755 /var/lib/recipelog/uploads
```
