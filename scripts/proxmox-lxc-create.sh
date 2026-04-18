#!/bin/bash
# =============================================================================
# RecipeLog — Création conteneur LXC Proxmox
# =============================================================================
# Usage : bash proxmox-lxc-create.sh
# A exécuter sur l'hôte Proxmox VE (pas à l'intérieur d'un conteneur).
# =============================================================================

set -euo pipefail

# ──────────────────────────────────────────────────────────────────────────────
# VARIABLES CONFIGURABLES
# ──────────────────────────────────────────────────────────────────────────────
CTID=200
HOSTNAME="recipelog"
RAM=512           # MiB
CORES=2
DISK=8            # GiB
BRIDGE="vmbr0"

# Stockage Proxmox (local-lvm, local-zfs, local, etc.)
STORAGE="local-lvm"
# Stockage pour les templates (presque toujours "local")
TEMPLATE_STORAGE="local"

# Réseau — USE_DHCP=true pour obtenir une IP automatiquement
USE_DHCP=true
STATIC_IP="192.168.1.100/24"   # utilisé seulement si USE_DHCP=false
GATEWAY="192.168.1.1"           # utilisé seulement si USE_DHCP=false
DNS="1.1.1.1"

# Mot de passe root du conteneur (changez-le avant d'utiliser ce script !)
ROOT_PASSWORD="ChangeMe123!"

# ──────────────────────────────────────────────────────────────────────────────
# COULEURS
# ──────────────────────────────────────────────────────────────────────────────
BOLD='\033[1m'
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }
header()  { echo -e "\n${BOLD}${CYAN}$*${NC}"; }

# ──────────────────────────────────────────────────────────────────────────────
# VERIFICATIONS PREALABLES
# ──────────────────────────────────────────────────────────────────────────────
header "RecipeLog — Création LXC Proxmox"
echo "────────────────────────────────────────────────────────────"

if ! command -v pct &>/dev/null; then
  error "pct introuvable. Ce script doit être exécuté sur un hôte Proxmox VE."
fi

if ! command -v pveam &>/dev/null; then
  error "pveam introuvable. Proxmox VE requis."
fi

if pct status "$CTID" &>/dev/null 2>&1; then
  error "Un conteneur avec l'ID $CTID existe déjà. Modifiez CTID dans ce script."
fi

# ──────────────────────────────────────────────────────────────────────────────
# TELECHARGEMENT DU TEMPLATE DEBIAN 12
# ──────────────────────────────────────────────────────────────────────────────
header "1/4 — Template Debian 12"

TEMPLATE_CACHE_DIR="/var/lib/vz/template/cache"

# Chercher un template Debian 12 déjà présent
TEMPLATE_FILE=$(find "$TEMPLATE_CACHE_DIR" -name "debian-12-standard_*.tar.*" 2>/dev/null \
  | sort -V | tail -1 || true)

if [ -z "$TEMPLATE_FILE" ]; then
  info "Template Debian 12 absent — mise à jour du catalogue et téléchargement..."
  pveam update
  AVAILABLE=$(pveam available --section system \
    | awk '{print $2}' \
    | grep "^debian-12-standard" \
    | sort -V | tail -1)

  if [ -z "$AVAILABLE" ]; then
    error "Aucun template debian-12-standard trouvé dans le catalogue Proxmox."
  fi

  info "Téléchargement : $AVAILABLE"
  pveam download "$TEMPLATE_STORAGE" "$AVAILABLE"
  TEMPLATE_FILE="${TEMPLATE_CACHE_DIR}/${AVAILABLE}"
  success "Template téléchargé."
else
  success "Template trouvé : $(basename "$TEMPLATE_FILE")"
fi

# Construire la référence Proxmox (ex: local:vztmpl/debian-12-standard_12.7-1_amd64.tar.zst)
TEMPLATE_REF="${TEMPLATE_STORAGE}:vztmpl/$(basename "$TEMPLATE_FILE")"

# ──────────────────────────────────────────────────────────────────────────────
# CREATION DU CONTENEUR LXC
# ──────────────────────────────────────────────────────────────────────────────
header "2/4 — Création du conteneur LXC (CTID=${CTID})"

if [ "$USE_DHCP" = true ]; then
  NETWORK_CONFIG="name=eth0,bridge=${BRIDGE},ip=dhcp"
else
  NETWORK_CONFIG="name=eth0,bridge=${BRIDGE},ip=${STATIC_IP},gw=${GATEWAY}"
fi

pct create "$CTID" "$TEMPLATE_REF" \
  --hostname     "$HOSTNAME" \
  --memory       "$RAM" \
  --cores        "$CORES" \
  --rootfs       "${STORAGE}:${DISK}" \
  --net0         "$NETWORK_CONFIG" \
  --password     "$ROOT_PASSWORD" \
  --unprivileged 1 \
  --features     nesting=1 \
  --ostype       debian \
  --start        0

success "Conteneur LXC ${CTID} créé."

# ──────────────────────────────────────────────────────────────────────────────
# CONFIGURATION COMPLEMENTAIRE
# ──────────────────────────────────────────────────────────────────────────────
header "3/4 — Configuration réseau"

if [ "$USE_DHCP" = false ]; then
  info "Définition du DNS : $DNS"
  pct set "$CTID" --nameserver "$DNS"
  success "DNS configuré."
else
  info "Mode DHCP : pas de configuration DNS statique."
fi

# ──────────────────────────────────────────────────────────────────────────────
# DEMARRAGE DU CONTENEUR
# ──────────────────────────────────────────────────────────────────────────────
header "4/4 — Démarrage"

info "Démarrage du conteneur ${CTID}..."
pct start "$CTID"

info "Attente de l'initialisation réseau (10 s)..."
sleep 10

if pct status "$CTID" | grep -q "running"; then
  success "Conteneur démarré et actif."
else
  error "Le conteneur ne semble pas démarré. Vérifiez : pct status $CTID"
fi

# Récupérer l'IP si DHCP
if [ "$USE_DHCP" = true ]; then
  CT_IP=$(pct exec "$CTID" -- hostname -I 2>/dev/null | awk '{print $1}' || echo "<en attente>")
else
  CT_IP=$(echo "$STATIC_IP" | cut -d/ -f1)
fi

# ──────────────────────────────────────────────────────────────────────────────
# RESUME FINAL
# ──────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Conteneur LXC RecipeLog créé avec succès !${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  CTID      : ${CYAN}${CTID}${NC}"
echo -e "  Hostname  : ${CYAN}${HOSTNAME}${NC}"
echo -e "  RAM       : ${CYAN}${RAM} MiB${NC}"
echo -e "  Coeurs    : ${CYAN}${CORES}${NC}"
echo -e "  Disque    : ${CYAN}${DISK} GiB (${STORAGE})${NC}"
echo -e "  IP        : ${CYAN}${CT_IP}${NC}"
echo ""
echo -e "${BOLD}Prochaines étapes :${NC}"
echo ""
echo -e "  Option 1 — Accès direct :"
echo -e "    ${YELLOW}pct enter ${CTID}${NC}"
echo -e "    puis copier install.sh dans le conteneur et l'exécuter."
echo ""
echo -e "  Option 2 — Via SSH (après activation dans le conteneur) :"
echo -e "    ${YELLOW}ssh root@${CT_IP}${NC}"
echo ""
echo -e "  Copier install.sh dans le conteneur :"
echo -e "    ${YELLOW}pct push ${CTID} ./scripts/install.sh /root/install.sh --perms 0755${NC}"
echo -e "    ${YELLOW}pct exec ${CTID} -- bash /root/install.sh${NC}"
echo ""
# chmod +x proxmox-lxc-create.sh
