#!/usr/bin/env sh
# Kill dev servers for this monorepo, including the local broker on 8791,
# plus best-effort cleanup of leaked workerd / Playwright MCP
# (see cleanup-node-leaks.sh).
set -e
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)

for port in "${NUXT_PORT:-3000}" 3000 3010 3011 3012 3013 3014 3015 3016 8791; do
  pid=$(lsof -ti :"$port" 2>/dev/null) || true
  if [ -n "$pid" ]; then
    kill $pid 2>/dev/null && echo "Killed process on port $port (PID $pid)" || true
  fi
done

sh "$SCRIPT_DIR/cleanup-node-leaks.sh" || true

echo "Done."
