#!/usr/bin/env bash
set -Eeuo pipefail

# purge_legacy_bitcoin_data.sh
# Frees disk space by deleting ONLY old blockchain data under /root for the
# bitcoin-core snap, while keeping the active node under /var intact.
#
# It will:
# - Verify the active datadir is /var/snap/bitcoin-core/common/.bitcoin
# - Stop systemd unit bitcoind.service if present (otherwise tries snap stop)
# - Remove /root/snap/bitcoin-core/common/.bitcoin/{blocks,chainstate}
# - Truncate legacy debug.log
# - Restart bitcoind if it was stopped
# - Show disk usage before/after
#
# Safety: If any wallet files exist under the legacy /root path, the script
# aborts unless --assume-no-wallets is given.
#
# Usage examples:
#   sudo scripts/purge_legacy_bitcoin_data.sh
#   sudo scripts/purge_legacy_bitcoin_data.sh --dry-run
#   sudo scripts/purge_legacy_bitcoin_data.sh --assume-no-wallets
#
# Remote without copying the file:
#   ssh -t castor 'sudo bash -s -- --assume-no-wallets' < scripts/purge_legacy_bitcoin_data.sh

VAR_DIR="/var/snap/bitcoin-core/common/.bitcoin"
ROOT_DIR="/root/snap/bitcoin-core/common/.bitcoin"

dry_run=0
assume_no_wallets=0

usage() {
  cat <<USAGE
Usage: sudo scripts/purge_legacy_bitcoin_data.sh [options]

Options:
  --dry-run            Show what would be done; do not modify
  --assume-no-wallets  Skip wallet presence check under ${ROOT_DIR}
  -h, --help           Show this help
USAGE
}

log() { echo "[INFO] $*"; }
warn() { echo "[WARN] $*" >&2; }
err() { echo "[ERROR] $*" >&2; exit 1; }

require_root() {
  if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
    err "Please run as root (use sudo)."
  fi
}

df_root() { df -h | awk 'NR==1 || $6=="/"'; }

active_datadir() {
  # Parse -datadir from the running process if available
  local dd
  dd=$(ps -eo args | awk '/[b]itcoind/ {for(i=1;i<=NF;i++) if($i ~ /^-datadir=/){sub(/^-datadir=/,"",$i); print $i; exit}}') || true
  if [[ -n "$dd" ]]; then
    echo "$dd"; return 0
  fi
  # Fallback: if /var dir exists, prefer it
  if [[ -d "$VAR_DIR" ]]; then echo "$VAR_DIR"; return 0; fi
  if [[ -d "$ROOT_DIR" ]]; then echo "$ROOT_DIR"; return 0; fi
  echo ""; return 1
}

maybe_stop_service() {
  local stopped=0
  if systemctl list-unit-files | grep -q '^bitcoind\.service'; then
    log "Stopping systemd unit bitcoind.service"
    if (( dry_run )); then
      log "[dry-run] systemctl stop bitcoind"
    else
      systemctl stop bitcoind || true
    fi
    stopped=1
  elif command -v snap >/dev/null 2>&1; then
    log "Stopping snap daemon app bitcoin-core.daemon (if running)"
    if (( dry_run )); then
      log "[dry-run] snap stop bitcoin-core.daemon"
    else
      snap stop bitcoin-core.daemon >/dev/null 2>&1 || true
    fi
    stopped=1
  fi
  echo "$stopped"
}

maybe_start_service() {
  if systemctl list-unit-files | grep -q '^bitcoind\.service'; then
    log "Starting systemd unit bitcoind.service"
    if (( dry_run )); then
      log "[dry-run] systemctl start bitcoind"
    else
      systemctl start bitcoind || true
    fi
  elif command -v snap >/dev/null 2>&1; then
    log "Starting snap daemon app bitcoin-core.daemon"
    if (( dry_run )); then
      log "[dry-run] snap start bitcoin-core.daemon"
    else
      snap start bitcoin-core.daemon >/dev/null 2>&1 || true
    fi
  fi
}

purge_legacy() {
  local blocks="${ROOT_DIR}/blocks"
  local chainstate="${ROOT_DIR}/chainstate"
  local debuglog="${ROOT_DIR}/debug.log"

  if [[ ! -d "$ROOT_DIR" ]]; then
    log "No legacy root dir at $ROOT_DIR (nothing to purge)."
    return 0
  fi

  if (( assume_no_wallets == 0 )); then
    # Abort if we find wallet files under legacy root
    if ls -1 "$ROOT_DIR" 2>/dev/null | grep -Eq '^wallet\.dat$'; then
      err "Found wallet.dat under $ROOT_DIR. Re-run with --assume-no-wallets if you are sure."
    fi
    if [[ -d "$ROOT_DIR/wallets" ]] && [[ -n "$(ls -A "$ROOT_DIR/wallets" 2>/dev/null || true)" ]]; then
      err "Found legacy wallets directory under $ROOT_DIR. Re-run with --assume-no-wallets if you are sure."
    fi
  fi

  if (( dry_run )); then
    [[ -d "$blocks" ]] && log "[dry-run] rm -rf $blocks"
    [[ -d "$chainstate" ]] && log "[dry-run] rm -rf $chainstate"
    [[ -f "$debuglog" ]] && log "[dry-run] truncate -s 0 $debuglog"
  else
    [[ -d "$blocks" ]] && rm -rf --one-file-system "$blocks"
    [[ -d "$chainstate" ]] && rm -rf --one-file-system "$chainstate"
    [[ -f "$debuglog" ]] && truncate -s 0 "$debuglog" || true
  fi
}

system_cleanup() {
  log "Vacuum journald and clean apt caches"
  if (( dry_run )); then
    log "[dry-run] journalctl --vacuum-size=200M"
    log "[dry-run] apt-get clean && apt-get autoremove -y"
  else
    journalctl --vacuum-size=200M >/dev/null 2>&1 || true
    apt-get clean >/dev/null 2>&1 || true
    DEBIAN_FRONTEND=noninteractive apt-get autoremove -y >/dev/null 2>&1 || true
  fi
}

main() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --dry-run) dry_run=1; shift ;;
      --assume-no-wallets) assume_no_wallets=1; shift ;;
      -h|--help) usage; exit 0 ;;
      *) err "Unknown option: $1 (use --help)" ;;
    esac
  done

  require_root

  log "Disk before:"; df_root || true

  local act
  act=$(active_datadir || true)
  log "Detected active datadir: ${act:-unknown}"
  if [[ "$act" != "$VAR_DIR" ]]; then
    warn "Active datadir is not ${VAR_DIR}. Aborting to avoid data loss."
    warn "If you are certain, start your node with -datadir=${VAR_DIR} and re-run."
    exit 1
  fi

  local stopped
  stopped=$(maybe_stop_service)

  purge_legacy
  system_cleanup

  if [[ "$stopped" == "1" ]]; then
    maybe_start_service
  fi

  log "Disk after:"; df_root || true
}

main "$@"

