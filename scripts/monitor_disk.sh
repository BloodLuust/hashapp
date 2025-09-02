#!/usr/bin/env bash
set -Eeuo pipefail

# monitor_disk.sh
# - Checks disk usage on remote hosts over SSH
# - Alerts on macOS via Notification Center if threshold exceeded
#
# Examples:
#   scripts/monitor_disk.sh --hosts "castor masterpig" --threshold 90
#   scripts/monitor_disk.sh --hosts "castor" --threshold 85 --quiet

THRESHOLD=90
HOSTS=()
QUIET=0

usage() {
  cat <<USAGE
Usage: scripts/monitor_disk.sh --hosts "host1 host2" [options]

Options:
  --hosts "h1 h2"    Space-separated SSH hosts/aliases to check (required)
  --threshold N       Alert when usage >= N percent (default: ${THRESHOLD})
  --quiet             Suppress normal output; only alert on threshold breach
  -h, --help          Show this help

Notes:
  - Uses 'ssh -o BatchMode=yes' and respects your local SSH config/keys.
  - Alerts on macOS via Notification Center when available (osascript).
USAGE
}

is_macos() { [[ "$(uname -s)" == "Darwin" ]]; }

notify_macos() {
  local title="$1"; shift
  local msg="$*"
  if is_macos && command -v osascript >/dev/null 2>&1; then
    # Escape embedded quotes for AppleScript
    local esc_title esc_msg
    esc_title=${title//"/\"}
    esc_msg=${msg//"/\"}
    osascript -e "display notification \"$esc_msg\" with title \"$esc_title\""
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --hosts) read -r -a HOSTS <<< "$2"; shift 2 ;;
    --threshold) THRESHOLD="$2"; shift 2 ;;
    --quiet) QUIET=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

if (( ${#HOSTS[@]} == 0 )); then
  echo "--hosts is required" >&2
  usage
  exit 1
fi

OVER=0
SUMMARY=()

for h in "${HOSTS[@]}"; do
  # Get root filesystem usage percent (no % sign)
  used=$(ssh -o BatchMode=yes -o ConnectTimeout=8 -o StrictHostKeyChecking=accept-new "$h" \
    "df -P / | awk 'NR==2{gsub(\"%\",\"\",\$5); print \$5}'" 2>/dev/null || echo "NA")

  if [[ "$used" == "NA" || -z "$used" ]]; then
    SUMMARY+=("$h: unreachable")
    OVER=1
    continue
  fi

  SUMMARY+=("$h: ${used}% used")
  if (( used >= THRESHOLD )); then
    OVER=1
  fi
done

if (( QUIET == 0 )); then
  printf '%s\n' "${SUMMARY[@]}"
fi

if (( OVER )); then
  sum_text=$(printf '%s; ' "${SUMMARY[@]}")
  notify_macos "Server disk alert" "$sum_text"
  exit 2
fi

exit 0
