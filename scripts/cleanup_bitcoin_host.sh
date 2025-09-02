#!/usr/bin/env bash
set -Eeuo pipefail

# cleanup_bitcoin_host.sh
# - Safe, repeatable maintenance for hosts running bitcoin-core via snap
# - Frees disk space (apt cache, journals, old snap revisions, logs)
# - Optionally purges legacy /root snap bitcoin data if active datadir is /var
#
# Usage examples:
#   sudo scripts/cleanup_bitcoin_host.sh                      # regular cleanup
#   sudo scripts/cleanup_bitcoin_host.sh --dry-run            # show actions only
#   sudo scripts/cleanup_bitcoin_host.sh --purge-root-legacy  # remove old /root data if safe
#   sudo scripts/cleanup_bitcoin_host.sh --journal-size 150M  # set journal cap
#

JOURNAL_SIZE_DEFAULT="200M"
BITCOIN_VAR_DIR="/var/snap/bitcoin-core/common/.bitcoin"
BITCOIN_ROOT_DIR="/root/snap/bitcoin-core/common/.bitcoin"

usage() {
  cat <<USAGE
Usage: sudo scripts/cleanup_bitcoin_host.sh [options]

Options:
  --dry-run                Print what would be done; do not modify
  --journal-size SIZE      Target size for journald vacuum (default: ${JOURNAL_SIZE_DEFAULT})
  --purge-root-legacy      If active datadir is /var, purge legacy blocks/chainstate under /root
  -h, --help               Show this help

Notes:
- This script is idempotent and safe to run periodically.
- Legacy purge only runs when it is safe (active daemon using /var datadir).
USAGE
}

log() { echo "[INFO] $*"; }
warn() { echo "[WARN] $*" >&2; }
err() { echo "[ERROR] $*" >&2; exit 1; }

have() { command -v "$1" >/dev/null 2>&1; }

require_root() {
  if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
    err "Please run as root (use sudo)."
  fi
}

df_summary() {
  df -h | awk 'NR==1 || $6=="/" {print}'
}

apt_cleanup() {
  log "Cleaning apt caches"
  if (( DRY )); then
    log "[dry-run] apt-get clean && apt-get autoremove -y"
  else
    apt-get clean >/dev/null 2>&1 || true
    DEBIAN_FRONTEND=noninteractive apt-get autoremove -y >/dev/null 2>&1 || true
  fi
}

journal_cleanup() {
  local size="$1"
  log "Vacuuming journal to ${size}"
  if (( DRY )); then
    log "[dry-run] journalctl --vacuum-size=${size}"
  else
    journalctl --vacuum-size="${size}" >/dev/null 2>&1 || true
  fi
}

snap_cleanup() {
  log "Removing disabled snap revisions"
  if ! have snap; then
    warn "snap not found; skipping snap cleanup"
    return
  fi
  if (( DRY )); then
    log "[dry-run] snap list --all | awk '/disabled/{print $1, $3}' | xargs -r -n2 snap remove --revision"
    log "[dry-run] snap set system refresh.retain=2"
  else
    # reduce retained revisions to 2 if possible
    snap set system refresh.retain=2 >/dev/null 2>&1 || true
    # remove disabled revisions
    local to_remove
    to_remove=$(snap list --all 2>/dev/null | awk '/disabled/{print $1, $3}') || true
    if [[ -n "$to_remove" ]]; then
      echo "$to_remove" | xargs -r -n2 snap remove --revision >/dev/null 2>&1 || true
    fi
  fi
}

truncate_bitcoin_logs() {
  log "Truncating bitcoin debug logs if present"
  local p1="${BITCOIN_VAR_DIR}/debug.log"
  local p2="${BITCOIN_ROOT_DIR}/debug.log"
  for p in "$p1" "$p2"; do
    if [[ -f "$p" ]]; then
      if (( DRY )); then
        log "[dry-run] truncate -s 0 $p"
      else
        truncate -s 0 "$p" || true
      fi
    fi
  done
}

detect_active_datadir() {
  # Try process args first
  local dd
  dd=$(ps -eo args | awk '/[b]itcoind/ {for(i=1;i<=NF;i++) if($i ~ /^-datadir=/){sub(/^-datadir=/,"",$i); print $i; exit}}') || true
  if [[ -n "$dd" ]]; then
    echo "$dd"
    return 0
  fi
  # Fallback: if var dir exists and looks active, prefer it
  if [[ -d "$BITCOIN_VAR_DIR" ]]; then
    echo "$BITCOIN_VAR_DIR"
    return 0
  fi
  # Else root dir
  if [[ -d "$BITCOIN_ROOT_DIR" ]]; then
    echo "$BITCOIN_ROOT_DIR"
    return 0
  fi
  echo "" # unknown
}

purge_legacy_root_if_safe() {
  local active="$1"
  if [[ "$active" == "$BITCOIN_VAR_DIR" ]]; then
    # safe to delete heavy dirs in /root
    local blocks="${BITCOIN_ROOT_DIR}/blocks"
    local chainstate="${BITCOIN_ROOT_DIR}/chainstate"
    if [[ -d "$blocks" || -d "$chainstate" ]]; then
      log "Eligible legacy data found under $BITCOIN_ROOT_DIR"
      if (( DRY )); then
        [[ -d "$blocks" ]] && log "[dry-run] rm -rf $blocks"
        [[ -d "$chainstate" ]] && log "[dry-run] rm -rf $chainstate"
      else
        rm -rf --one-file-system "$blocks" 2>/dev/null || true
        rm -rf --one-file-system "$chainstate" 2>/dev/null || true
      fi
    else
      log "No legacy blocks/chainstate under $BITCOIN_ROOT_DIR"
    fi
  else
    warn "Active datadir is not $BITCOIN_VAR_DIR; skipping legacy purge to avoid data loss"
  fi
}

summary_sizes() {
  log "Disk usage summary (/, var, bitcoin dirs):"
  df_summary
  du -sh /var 2>/dev/null || true
  du -sh "$BITCOIN_VAR_DIR" 2>/dev/null || true
  du -sh "$BITCOIN_ROOT_DIR" 2>/dev/null || true
}

main() {
  local DRY=0 PURGE_ROOT=0 JSIZE="$JOURNAL_SIZE_DEFAULT"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --dry-run) DRY=1; shift ;;
      --journal-size) JSIZE="$2"; shift 2 ;;
      --purge-root-legacy) PURGE_ROOT=1; shift ;;
      -h|--help) usage; exit 0 ;;
      *) err "Unknown option: $1 (use --help)" ;;
    esac
  done

  require_root

  log "Starting cleanup (dry-run=${DRY}, journal-size=${JSIZE}, purge-root-legacy=${PURGE_ROOT})"
  summary_sizes || true

  apt_cleanup
  journal_cleanup "$JSIZE"
  snap_cleanup
  truncate_bitcoin_logs

  if (( PURGE_ROOT )); then
    local active
    active=$(detect_active_datadir)
    log "Detected active datadir: ${active:-unknown}"
    purge_legacy_root_if_safe "$active"
  else
    log "Skipping legacy /root purge (enable with --purge-root-legacy)"
  fi

  log "Cleanup completed"
  summary_sizes || true
}

main "$@"

