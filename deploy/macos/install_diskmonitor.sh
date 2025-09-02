#!/usr/bin/env bash
set -Eeuo pipefail

# install_diskmonitor.sh
# - Installs a launchd agent to run monitor_disk.sh on macOS at a fixed interval

HOSTS=${HOSTS:-}
THRESHOLD=${THRESHOLD:-90}
INTERVAL_SECONDS=${INTERVAL_SECONDS:-3600}

usage() {
  cat <<USAGE
Usage: HOSTS="castor masterpig" [THRESHOLD=90] [INTERVAL_SECONDS=3600] ./deploy/macos/install_diskmonitor.sh

Environment variables:
  HOSTS             Space-separated SSH hosts/aliases to check (required)
  THRESHOLD         Usage percent to alert on (default: 90)
  INTERVAL_SECONDS  How often to run (default: 3600 = hourly)

Notes:
  - This writes ~/Library/LaunchAgents/com.hashapp.diskmonitor.plist and loads it.
  - To uninstall: launchctl unload ~/Library/LaunchAgents/com.hashapp.diskmonitor.plist && rm it.
USAGE
}

if [[ -z "$HOSTS" ]]; then
  usage; exit 1
fi

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This installer is for macOS only." >&2
  exit 1
fi

SCRIPT_PATH=$(cd "$(dirname "$0")/../.." && pwd)/scripts/monitor_disk.sh
PLIST=~/Library/LaunchAgents/com.hashapp.diskmonitor.plist

mkdir -p "$(dirname "$PLIST")"

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.hashapp.diskmonitor</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${SCRIPT_PATH}</string>
    <string>--hosts</string>
    <string>${HOSTS}</string>
    <string>--threshold</string>
    <string>${THRESHOLD}</string>
    <string>--quiet</string>
  </array>
  <key>StartInterval</key>
  <integer>${INTERVAL_SECONDS}</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${HOME}/Library/Logs/hashapp.diskmonitor.out.log</string>
  <key>StandardErrorPath</key>
  <string>${HOME}/Library/Logs/hashapp.diskmonitor.err.log</string>
</dict>
</plist>
PLIST

launchctl unload "$PLIST" >/dev/null 2>&1 || true
launchctl load -w "$PLIST"
echo "Installed and loaded com.hashapp.diskmonitor (interval ${INTERVAL_SECONDS}s)."

