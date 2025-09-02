#!/usr/bin/env bash
set -Eeuo pipefail

# fix_bitcoind_snap.sh
# - Repairs corrupted snap settings for bitcoin-core
# - Ensures a clean systemd unit that runs the snap daemon
# - Optionally gathers local and remote logs for troubleshooting

LOG_DIR_DEFAULT="/var/log/bitcoind-fix"
UNIT_PATH="/etc/systemd/system/bitcoind.service"
SNAP_NAME="bitcoin-core"
SNAP_DAEMON_CMD="bitcoin-core.daemon"
SNAP_COMMON_DIR="/var/snap/bitcoin-core/common/.bitcoin"
ROOT_SETTINGS_JSON="/root/snap/bitcoin-core/common/.bitcoin/settings.json"

usage() {
  cat <<'USAGE'
Usage: sudo scripts/fix_bitcoind_snap.sh [options]

Options:
  --no-service           Do not (re)install/enable the systemd unit
  --no-fix-settings      Skip fixing the corrupted settings.json
  --log-dir PATH         Directory to store collected logs (default: /var/log/bitcoind-fix)
  --remote "h1 h2"       Space-separated list of remote hosts to query via SSH
  --remote-user USER     SSH username for remotes (default: current sudo user or $USER)
  --remote-only          Only collect remote logs, skip local fix
  --remote-fix           Copy this script to remotes, run fix+diagnostics via sudo, then collect logs
  --remote-args "..."    Extra args to pass to the remote script (e.g., "--no-service --dry-run")
  --dry-run              Show what would be done without making changes
  -h, --help             Show this help

Examples:
  sudo scripts/fix_bitcoind_snap.sh
  sudo scripts/fix_bitcoind_snap.sh --remote "node-b london-1" --remote-user ubuntu
  sudo scripts/fix_bitcoind_snap.sh --no-service
USAGE
}

log() { echo "[INFO] $*"; }
warn() { echo "[WARN] $*" >&2; }
err() { echo "[ERROR] $*" >&2; exit 1; }

have() { command -v "$1" >/dev/null 2>&1; }

require_root() {
  if [[ ${EUID} -ne 0 ]]; then
    err "Please run as root (use sudo)."
  fi
}

timestamp() { date +"%Y%m%d-%H%M%S"; }

validate_json() {
  local f="$1"
  if [[ ! -s "$f" ]]; then return 1; fi
  if have python3; then
    python3 - <<'PY' "$f" >/dev/null 2>&1 || return 1
import json, sys
with open(sys.argv[1], 'r') as fh:
    json.load(fh)
PY
    return 0
  elif have jq; then
    jq -e . "$f" >/dev/null 2>&1 && return 0 || return 1
  else
    # Fallback heuristic: not reliable but avoids hard dependency
    grep -Eq '^[[:space:]]*[\{\[]' "$f" >/dev/null 2>&1 && return 0 || return 1
  fi
}

backup_and_remove_if_corrupt() {
  local f="$1"
  local ts
  ts="$(timestamp)"
  if [[ -f "$f" ]]; then
    if validate_json "$f"; then
      log "Settings JSON is valid: $f"
    else
      local bak="${f}.bak-${ts}"
      warn "Settings JSON is corrupt. Backing up to: $bak and removing $f"
      cp -a "$f" "$bak" 2>/dev/null || true
      rm -f "$f"
      log "Removed corrupt settings: $f"
    fi
  else
    log "No settings.json found at $f (nothing to fix)."
  fi
}

ensure_log_dir() {
  local dir="$1"
  mkdir -p "$dir"
  chmod 0755 "$dir"
}

write_systemd_unit() {
  log "Writing systemd unit to $UNIT_PATH"
  cat > "$UNIT_PATH" <<'UNIT'
[Unit]
Description=Bitcoin Core (snap) daemon
Wants=network-online.target
After=network-online.target snapd.seeded.service snapd.service

[Service]
Type=simple
ExecStart=/usr/bin/snap run bitcoin-core.daemon -daemon=0 -conf=/var/snap/bitcoin-core/common/.bitcoin/bitcoin.conf
Restart=on-failure
TimeoutStopSec=60s
LimitNOFILE=8192

[Install]
WantedBy=multi-user.target
UNIT
}

reload_and_start_service() {
  systemctl daemon-reload
  systemctl enable --now bitcoind.service
}

local_collect_diagnostics() {
  local out_dir="$1"
  local ts
  ts="$(timestamp)"
  local base="$out_dir/local-${ts}"
  mkdir -p "$base"

  log "Collecting local diagnostics into $base"

  # Basic environment
  ( set +e
    {
      echo "# Date"; date; echo
      echo "# Uname"; uname -a; echo
      echo "# Snap version"; snap version 2>&1; echo
      echo "# Snap info $SNAP_NAME"; snap info "$SNAP_NAME" 2>&1 || true; echo
      echo "# Snap apps $SNAP_NAME"; snap apps "$SNAP_NAME" 2>&1 || true; echo
      echo "# Systemctl status"; systemctl status --no-pager --lines=50 bitcoind.service 2>&1 || true; echo
      echo "# Journal (last 200 lines)"; journalctl -u bitcoind.service -n 200 --no-pager -o cat 2>&1 || true; echo
      echo "# bitcoin.conf"; sed -n '1,200p' "$SNAP_COMMON_DIR/bitcoin.conf" 2>&1 || true; echo
      echo "# Datadir listing"; ls -la "$SNAP_COMMON_DIR" 2>&1 || true; echo
      echo "# Version check"; snap run ${SNAP_DAEMON_CMD} --version 2>&1 || true; echo
    } >"$base/diagnostics.txt"
  )

  # Copy debug.log if present
  if [[ -f "$SNAP_COMMON_DIR/debug.log" ]]; then
    cp -a "$SNAP_COMMON_DIR/debug.log" "$base/debug.log" || true
  fi

  log "Local diagnostics saved: $base"
}

maybe_connect_removable_media() {
  local conf="$SNAP_COMMON_DIR/bitcoin.conf"
  [[ -f "$conf" ]] || return 0
  # Extract first non-comment datadir= line
  local datadir
  datadir="$(awk -F= '/^[[:space:]]*datadir[[:space:]]*=/ {gsub(/^\s+|\s+$/, "", $2); print $2; exit}' "$conf" 2>/dev/null || true)"
  if [[ -n "$datadir" && "$datadir" != "$SNAP_COMMON_DIR"* ]]; then
    warn "bitcoin.conf uses external datadir: $datadir"
    warn "Attempting to connect snap removable-media interface."
    snap connect bitcoin-core:removable-media 2>/dev/null || true
  fi
}

remove_stale_lock_if_stopped() {
  local lockfile="$SNAP_COMMON_DIR/.lock"
  if [[ -f "$lockfile" ]]; then
    if ! systemctl is-active --quiet bitcoind.service; then
      warn "Removing stale lock file: $lockfile"
      rm -f "$lockfile"
    fi
  fi
}

remote_collect() {
  local out_dir="$1"; shift
  local remote_user="$1"; shift
  local hosts=("$@")
  [[ ${#hosts[@]} -gt 0 ]] || return 0

  log "Collecting diagnostics from remotes: ${hosts[*]} as user ${remote_user:-<default>}"
  for h in "${hosts[@]}"; do
    local ts base
    ts="$(timestamp)"
    base="$out_dir/${h}-${ts}"
    mkdir -p "$base"
    local target
    if [[ -n "$remote_user" ]]; then target="${remote_user}@${h}"; else target="${h}"; fi
    log "Connecting to $target ..."

    # Composite command to run remotely
    ssh -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=10 -o ServerAliveCountMax=3 "${target}" bash -s <<'RSH' >"${base}/diagnostics.txt" 2>&1 || warn "SSH failed for $h"
set -Eeuo pipefail
if command -v timeout >/dev/null 2>&1; then TMO="timeout -k 5 20"; else TMO=""; fi
echo "# Date"; date; echo
echo "# Hostname"; hostnamectl 2>/dev/null || hostname; echo
echo "# Uname"; uname -a; echo
echo "# Snap version"; ${TMO} snap version 2>&1 || true; echo
echo "# Snap info bitcoin-core"; ${TMO} snap info bitcoin-core 2>&1 || true; echo
echo "# Snap apps bitcoin-core"; ${TMO} snap apps bitcoin-core 2>&1 || true; echo
echo "# systemctl status bitcoind.service"; systemctl status --no-pager --lines=50 bitcoind.service 2>&1 || true; echo
echo "# journalctl last 200"; ${TMO} journalctl -u bitcoind.service -n 200 --no-pager -o cat 2>&1 || true; echo
echo "# bitcoin.conf"; sed -n '1,200p' /var/snap/bitcoin-core/common/.bitcoin/bitcoin.conf 2>&1 || true; echo
echo "# datadir listing"; ls -la /var/snap/bitcoin-core/common/.bitcoin 2>&1 || true; echo
echo "# version check"; ${TMO} snap run bitcoin-core.daemon --version 2>&1 || true; echo
RSH

    # Attempt to pull common logs if present
    scp -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new "${target}:/var/snap/bitcoin-core/common/.bitcoin/debug.log" "${base}/debug.log" >/dev/null 2>&1 || true
    scp -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new "${target}:/root/snap/bitcoin-core/common/.bitcoin/settings.json" "${base}/settings.json" >/dev/null 2>&1 || true

    log "Remote diagnostics saved: $base"
  done
}

main() {
  local do_service=1 do_fix_settings=1 dry_run=0 remote_only=0 remote_fix=0
  local log_dir="$LOG_DIR_DEFAULT" remote_user="" remote_args=""
  local -a remote_hosts=()

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --no-service) do_service=0; shift ;;
      --no-fix-settings) do_fix_settings=0; shift ;;
      --log-dir) log_dir="$2"; shift 2 ;;
      --remote) IFS=' ' read -r -a remote_hosts <<< "$2"; shift 2 ;;
      --remote-user) remote_user="$2"; shift 2 ;;
      --remote-fix) remote_fix=1; shift ;;
      --remote-args) remote_args="$2"; shift 2 ;;
      --remote-only) remote_only=1; shift ;;
      --dry-run) dry_run=1; shift ;;
      -h|--help) usage; exit 0 ;;
      *) err "Unknown option: $1 (use --help)" ;;
    esac
  done

  if (( remote_only )); then
    # Remote-only mode: do not require local root; use caller's SSH config/keys
    ensure_log_dir "$log_dir"
    # In remote-only mode, optionally run remote fix before collecting
    if (( ${#remote_hosts[@]} > 0 )); then
      if (( remote_fix )); then
        local self
        self="$(readlink -f "$0" 2>/dev/null || python3 - <<'PY' "$0"
import os, sys
print(os.path.abspath(sys.argv[1]))
PY
        )"
        for h in "${remote_hosts[@]}"; do
          local ts base rmt_script target
          ts="$(timestamp)"
          base="$log_dir/${h}-${ts}"
          rmt_script="/tmp/fix_bitcoind_snap.sh"
          mkdir -p "$base"
          if [[ -n "$remote_user" ]]; then target="${remote_user}@${h}"; else target="${h}"; fi
          log "[remote-fix] Uploading script to $target:$rmt_script"
          if (( dry_run )); then
            log "[dry-run][$h] Would scp $self $rmt_script"
            log "[dry-run][$h] Would run: sudo bash $rmt_script --log-dir /var/log/bitcoind-fix $remote_args"
          else
            if ! scp -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new "$self" "${target}:${rmt_script}" >/dev/null 2>&1; then
              warn "SCP failed for $h, falling back to SSH stream upload"
              if ! ssh -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new "${target}" "cat > '$rmt_script' && chmod +x '$rmt_script'" <"$self" >/dev/null 2>&1; then
                warn "Fallback upload failed for $h"
              fi
            fi
            ssh -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new "${target}" \
              "sudo bash $rmt_script --log-dir /var/log/bitcoind-fix $remote_args" \
              >"${base}/remote-fix.txt" 2>&1 || warn "Remote fix failed for $h"
          fi
        done
      fi
      remote_collect "$log_dir" "$remote_user" "${remote_hosts[@]}"
    else
      warn "--remote-only specified but no --remote hosts provided. Nothing to do."
    fi
    log "Done (remote-only)."
    exit 0
  fi

  # Local actions require root
  require_root
  ensure_log_dir "$log_dir"

  # Pre-flight checks
  if ! snap info "$SNAP_NAME" >/dev/null 2>&1; then
    err "Snap '$SNAP_NAME' is not installed. Install it with: sudo snap install $SNAP_NAME"
  fi

  if (( do_fix_settings )); then
    log "Checking for corrupted settings.json (root profile)"
    backup_and_remove_if_corrupt "$ROOT_SETTINGS_JSON"
  else
    log "Skipping settings.json check as requested"
  fi

  maybe_connect_removable_media
  remove_stale_lock_if_stopped

  # Sanity check the daemon binary
  if (( dry_run )); then
    log "[dry-run] Would run: snap run ${SNAP_DAEMON_CMD} --version"
  else
    log "Validating daemon availability"
    if ! snap run ${SNAP_DAEMON_CMD} --version >/dev/null 2>&1; then
      warn "Daemon version check failed; service logs may clarify."
    fi
  fi

  if (( do_service )); then
    if (( dry_run )); then
      log "[dry-run] Would write systemd unit to $UNIT_PATH and enable it"
    else
      write_systemd_unit
      reload_and_start_service
    fi
  else
    log "Skipped systemd unit changes (--no-service)."
  fi

  # Collect local diagnostics regardless
  local_collect_diagnostics "$log_dir"

  # Remote collection if requested
  if (( ${#remote_hosts[@]} > 0 )); then
    if (( remote_fix )); then
      # Push this script and execute remotely with sudo, then collect logs
      local self
      self="$(readlink -f "$0" 2>/dev/null || python3 - <<'PY' "$0"
import os, sys
print(os.path.abspath(sys.argv[1]))
PY
      )"
      for h in "${remote_hosts[@]}"; do
        local ts base rmt_script target
        ts="$(timestamp)"
        base="$log_dir/${h}-${ts}"
        rmt_script="/tmp/fix_bitcoind_snap.sh"
        mkdir -p "$base"
        if [[ -n "$remote_user" ]]; then target="${remote_user}@${h}"; else target="${h}"; fi
        log "[remote-fix] Uploading script to $target:$rmt_script"
        if (( dry_run )); then
          log "[dry-run][$h] Would scp $self $rmt_script"
          log "[dry-run][$h] Would run: sudo bash $rmt_script --log-dir /var/log/bitcoind-fix $remote_args"
        else
          scp -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new "$self" "${target}:${rmt_script}" >/dev/null 2>&1 || warn "SCP failed for $h"
          ssh -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new "${target}" \
            "sudo bash $rmt_script --log-dir /var/log/bitcoind-fix $remote_args" \
            >"${base}/remote-fix.txt" 2>&1 || warn "Remote fix failed for $h"
        fi
      done
    fi
    remote_collect "$log_dir" "$remote_user" "${remote_hosts[@]}"
  fi

  log "All done. Logs in: $log_dir"
}

main "$@"
