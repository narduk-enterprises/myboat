#!/usr/bin/env sh
# Kill dev servers for this monorepo, including the local broker on 8791,
# plus best-effort cleanup of leaked workerd / Playwright MCP
# (see cleanup-node-leaks.sh).
#
# Sweeps env-based ports (NUXT_PORT, etc.) and fixed ports commonly used here
# (Doppler may set NUXT_PORT to e.g. 3216 while plain `pnpm dev:kill` has no env).
set -e
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)

# Listeners only; avoids matching outbound connections.
pids_on_port() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null || true
}

kill_port_listeners() {
  port=$1
  pids=$(pids_on_port "$port")
  if [ -z "$pids" ]; then
    return 0
  fi
  initial=$pids
  # shellcheck disable=SC2086
  kill -TERM $pids 2>/dev/null || true
  sleep 1
  pids=$(pids_on_port "$port")
  if [ -n "$pids" ]; then
    # shellcheck disable=SC2086
    kill -KILL $pids 2>/dev/null || true
    echo "Killed process on port $port (PIDs $pids, SIGKILL)"
  else
    echo "Killed process on port $port (PID $initial)"
  fi
}

# Env-driven first, then stack defaults (see apps/web dev scripts, playwright.config).
for port in \
  "$NUXT_PORT" \
  "$NITRO_PORT" \
  "$PORT" \
  "$PLAYWRIGHT_NUXT_PORT" \
  "$MYBOAT_SMOKE_NUXT_PORT" \
  "$MYBOAT_DEV_PORT" \
  3000 \
  3216 \
  3300 \
  3400 \
  5173 \
  8080 \
  3010 \
  3011 \
  3012 \
  3013 \
  3014 \
  3015 \
  3016 \
  8787 \
  8788 \
  8789 \
  8790 \
  8791 \
  8792; do
  [ -n "$port" ] || continue
  case "$port" in
  *[!0-9]*) continue ;;
  esac
  kill_port_listeners "$port"
done

sh "$SCRIPT_DIR/cleanup-node-leaks.sh" || true
