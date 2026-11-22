#!/usr/bin/env bash
#
# start-android.sh
# Launches all three Expo mobile apps for testing on a real Android device, each in
# its OWN macOS Terminal tab so every app keeps a real TTY -> shows its QR code and
# responds to the interactive menu (press `a` for Android, `r` to reload, etc.):
#   - enatega-multivendor-app    (customer)  Metro :8083
#   - enatega-multivendor-store  (vendor)    Metro :8082
#   - enatega-multivendor-rider  (rider)     Metro :8085
#
# A real device can't reach "localhost", so this auto-detects your machine's LAN IP
# and feeds it to every app via the EXPO_PUBLIC_* env vars the apps already read
# (no environment.js / environment.ts edits required).
#
# Phone and computer must be on the SAME Wi-Fi network. The API must be running and
# reachable on the LAN (bound to 0.0.0.0, not just 127.0.0.1).
#
# Usage:
#   ./start-android.sh                          # auto-detect LAN IP, API on :4000
#   HOST_IP=192.168.1.50 ./start-android.sh     # force a specific IP
#   API_PORT=4000 ./start-android.sh            # override API port
#   ./start-android.sh --tunnel                 # use Expo tunnel (different network)

set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"

# --- Resolve the LAN IP -------------------------------------------------------
if [[ -n "${HOST_IP:-}" ]]; then
  IP="$HOST_IP"
elif command -v ipconfig >/dev/null 2>&1 && ipconfig getifaddr en0 >/dev/null 2>&1; then
  IP="$(ipconfig getifaddr en0)"        # macOS Wi-Fi
elif command -v ipconfig >/dev/null 2>&1 && ipconfig getifaddr en1 >/dev/null 2>&1; then
  IP="$(ipconfig getifaddr en1)"        # macOS Ethernet/secondary
else
  IP="$(hostname -I 2>/dev/null | awk '{print $1}')"   # Linux fallback
fi

if [[ -z "${IP:-}" ]]; then
  echo "ERROR: could not detect a LAN IP. Set it manually: HOST_IP=192.168.x.x ./start-android.sh" >&2
  exit 1
fi

API_PORT="${API_PORT:-4000}"
EXTRA_ARGS="$*"

# Env vars every app reads (exported inside each tab's command).
ENV_EXPORTS=$(cat <<EOF
export EXPO_PUBLIC_GRAPHQL_URL="http://${IP}:${API_PORT}/graphql";
export EXPO_PUBLIC_WS_GRAPHQL_URL="ws://${IP}:${API_PORT}/graphql";
export EXPO_PUBLIC_SERVER_URL="http://${IP}:${API_PORT}/graphql";
export EXPO_PUBLIC_SERVER_REST_URL="http://${IP}:${API_PORT}/";
EOF
)

echo "=================================================================="
echo " LAN IP        : ${IP}"
echo " API endpoint  : http://${IP}:${API_PORT}/graphql"
echo " Customer app  : Metro :8083   ->  exp://${IP}:8083"
echo " Store app     : Metro :8082   ->  exp://${IP}:8082"
echo " Rider app     : Metro :8085   ->  exp://${IP}:8085"
echo "=================================================================="

# --- Non-macOS fallback: run multiplexed (no per-app QR, connect by URL) ------
if ! command -v osascript >/dev/null 2>&1; then
  echo "osascript not found (not macOS). Running all three in this terminal."
  echo "No QR codes in this mode — open Expo Go and enter the exp:// URLs above."
  eval "$ENV_EXPORTS"
  ( cd "$ROOT/enatega-multivendor-app"   && npx expo start --port 8083 $EXTRA_ARGS 2>&1 | sed 's/^/[CUSTOMER] /' ) &
  ( cd "$ROOT/enatega-multivendor-store" && npx expo start --port 8082 $EXTRA_ARGS 2>&1 | sed 's/^/[STORE] /' ) &
  ( cd "$ROOT/enatega-multivendor-rider" && npx expo start --port 8085 $EXTRA_ARGS 2>&1 | sed 's/^/[RIDER] /' ) &
  wait
  exit 0
fi

# --- macOS: open one Terminal tab per app -------------------------------------
open_win() {
  local dir="$1" port="$2" label="$3"
  # `do script` with no target opens a NEW Terminal window (real TTY, no keystrokes,
  # so it needs no Accessibility permission). Expo stays fully interactive.
  local cmd="cd '$ROOT/$dir'; ${ENV_EXPORTS} clear; echo '=== $label  (Metro :$port  exp://${IP}:$port) ==='; npx expo start --port $port $EXTRA_ARGS"
  osascript >/dev/null <<APPLESCRIPT
tell application "Terminal"
  activate
  do script "${cmd//\"/\\\"}"
end tell
APPLESCRIPT
}

open_win "enatega-multivendor-app"   8083 "CUSTOMER"
open_win "enatega-multivendor-store" 8082 "STORE"
open_win "enatega-multivendor-rider" 8085 "RIDER"

echo ""
echo "Opened three Terminal windows. Each shows its own QR code."
echo "Scan with Expo Go, or press 'a' in a window to open on a USB-connected device."
echo "Close a window (or Ctrl+C in it) to stop that app."
