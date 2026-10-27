#!/usr/bin/env bash
# The same build, deployed twice: once with the settings it had in preview, and
# once with the four that production actually needs.
#
#   ./run.sh
#
# Needs Node 22 and Google Chrome.
set -uo pipefail
cd "$(dirname "$0")"
export API_PORT=7501 HOST_PORT=7502 API_LOG=/tmp/preview-lab-api.log
HOST_ORIGIN="http://127.0.0.1:$HOST_PORT"
DEV_ORIGIN="http://127.0.0.1:5173"

PIDS=()
cleanup() { for p in "${PIDS[@]:-}"; do kill "$p" 2>/dev/null || true; done; }
trap cleanup EXIT
wait_port() { for _ in $(seq 1 60); do nc -z 127.0.0.1 "$1" 2>/dev/null && return 0; sleep 0.2; done; return 1; }

deploy() { # allowed-origin  redirect-uri  spa-fallback  label
  cleanup; PIDS=(); : > "$API_LOG"
  ALLOWED_ORIGIN="$1" REDIRECT_URI="$2" node api.mjs 2>/dev/null & PIDS+=($!); disown
  SPA_FALLBACK="$3" node host.mjs 2>/dev/null & PIDS+=($!); disown
  wait_port $API_PORT; wait_port $HOST_PORT
  node probe.mjs "$4"
}

# one build, used by both deployments
API_BASE="http://127.0.0.1:$API_PORT" AUTH_URL="http://127.0.0.1:$API_PORT/auth/start" node build.mjs

deploy "$DEV_ORIGIN"  "http://localhost:5173/callback" 0 "SHIPPED WITH THE SETTINGS IT HAD IN PREVIEW"
deploy "$HOST_ORIGIN" "$HOST_ORIGIN/callback"          1 "WITH THE FOUR SETTINGS PRODUCTION NEEDS"

echo "  AND THE VARIABLE THAT WAS ADDED AFTER THE BUILD"
echo ""
API_BASE="http://127.0.0.1:$API_PORT" node build.mjs 2>/dev/null   # AUTH_URL not set this time
if grep -q "AUTH_URL = ''" dist/app.js; then
  echo "    the bundle shipped with an empty sign-in link, because the variable"
  echo "    did not exist when the bundle was built. Setting it afterwards"
  echo "    changes nothing until the app is built again."
fi
echo ""
