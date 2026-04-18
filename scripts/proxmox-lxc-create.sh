#!/bin/bash
# ============================================================
# RecipeLog — Création du conteneur LXC Proxmox
# ============================================================
set -e

# ── Variables à adapter ────────────────────────────────────
CTID=200
HOSTNAME="recipelog"
RAM=512
CORES=2
DISK=8
BRIDGE="vmbr0"
OS_TEMPLATE="local:vztmpl/debian-12-standard_12.7-1_amd64.tar.zst"
STORAGE="local-lvm"
IP="dhcp"          # ou ex: "192.168.1.50/24"
GW=""              # ex: "192.168.1.1" (laisser vide si DHCP)
PASSWORD="recipelog"
# ──────────────────────────────────────────────────────────

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BOLD}RecipeLog — Création LXC${NC}"
echo "────────────────────────────────"

# Télécharger le template si absent
if ! pveam list local | grep -q "debian-12"; then
  echo -e "${YELLOW}Téléchargement du template Debian 12...${NC}"
  pveam download local debian-12-standard_12.7-1_amd64.tar.zst
fi

# Construire les paramètres réseau
if [ "$IP" = "dhcp" ]; then
  NET_OPTS="ip=dhcp"
else
  NET_OPTS="ip=$IP"
  [ -n "$GW" ] && NET_OPTS="$NET_OPTS,gw=$GW"
fi

echo -e "${YELLOW}Création du conteneur LXC $CTID...${NC}"

pct create $CTID "$OS_TEMPLATE" \
  --hostname "$HOSTNAME" \
  --memory "$RAM" \
  --cores "$CORES" \
  --rootfs "$STORAGE:$DISK" \
  --net0 "name=eth0,bridge=$BRIDGE,$NET_OPTS" \
  --unprivileged 1 \
  --features nesting=1 \
  --password "$PASSWORD" \
  --start 1

echo -e "${YELLOW}Attente du démarrage...${NC}"
sleep 5

echo -e "${GREEN}✓ Conteneur LXC $CTID créé et démarré${NC}"
echo ""
echo "Prochaine étape :"
echo "  pct enter $CTID"
echo "  curl -fsSL https://raw.githubusercontent.com/supernon0/recipelog/main/scripts/install.sh | bash"
