#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NUXT_PORT="${MYBOAT_SMOKE_NUXT_PORT:-3300}"
COLLECTOR_PORT="${MYBOAT_SMOKE_COLLECTOR_PORT:-4012}"
COOKIE_JAR="${ROOT_DIR}/.data/smoke-telemetry.cookies.txt"
LOG_DIR="${ROOT_DIR}/.data/smoke-telemetry"
APP_LOG="${LOG_DIR}/app.log"
COLLECTOR_LOG="${LOG_DIR}/collector.log"
KEEP_RUNNING="${MYBOAT_SMOKE_KEEP_RUNNING:-0}"

mkdir -p "$LOG_DIR"
rm -f "$COOKIE_JAR"

NUXT_PORT="${NUXT_PORT}" pnpm run dev:kill >/dev/null 2>&1 || true

cleanup() {
  if [[ -n "${APP_PID:-}" ]] && kill -0 "$APP_PID" >/dev/null 2>&1; then
    kill "$APP_PID" >/dev/null 2>&1 || true
    wait "$APP_PID" >/dev/null 2>&1 || true
  fi

  NUXT_PORT="${NUXT_PORT}" pnpm run dev:kill >/dev/null 2>&1 || true

  if docker ps -a --format '{{.Names}}' | grep -Fxq myboat-edge-collector-smoke; then
    docker rm -f myboat-edge-collector-smoke >/dev/null 2>&1 || true
  fi
}

if [[ "$KEEP_RUNNING" != "1" ]]; then
  trap cleanup EXIT
fi

eval "$("${ROOT_DIR}/scripts/bootstrap-local-influx.sh" --reset --format=env)"

AUTH_BACKEND=local \
MYBOAT_HISTORY_PAID_USER_IDS=ui-audit-user \
NUXT_PORT="${NUXT_PORT}" \
pnpm --filter web run dev:inner >"${APP_LOG}" 2>&1 &
APP_PID=$!

pnpm exec wait-on "http://127.0.0.1:${NUXT_PORT}/login"

curl -fsS \
  -X POST \
  -H 'Content-Type: application/json' \
  -H 'X-Requested-With: XMLHttpRequest' \
  -c "$COOKIE_JAR" \
  "http://127.0.0.1:${NUXT_PORT}/api/auth/login-test" \
  --data '{}' >/dev/null

SEED_JSON="$(
  curl -fsS \
    -X POST \
    -H 'Content-Type: application/json' \
    -H 'X-Requested-With: XMLHttpRequest' \
    -b "$COOKIE_JAR" \
    -c "$COOKIE_JAR" \
    "http://127.0.0.1:${NUXT_PORT}/api/app/testing/seed-sample" \
    --data '{}'
)"

INSTALLATION_ID="$(printf '%s' "$SEED_JSON" | jq -r '.installationId')"
VESSEL_SLUG="$(printf '%s' "$SEED_JSON" | jq -r '.vesselSlug')"
USERNAME="$(printf '%s' "$SEED_JSON" | jq -r '.username')"

KEY_JSON="$(
  curl -fsS \
    -X POST \
    -H 'X-Requested-With: XMLHttpRequest' \
    -b "$COOKIE_JAR" \
    -c "$COOKIE_JAR" \
    "http://127.0.0.1:${NUXT_PORT}/api/app/installations/${INSTALLATION_ID}/keys"
)"

MYBOAT_INGEST_KEY="$(printf '%s' "$KEY_JSON" | jq -r '.rawKey')"

MYBOAT_COLLECTOR_CONTAINER_NAME=myboat-edge-collector-smoke \
MYBOAT_DEV_PORT="${NUXT_PORT}" \
MYBOAT_INGEST_URL="http://host.docker.internal:${NUXT_PORT}/api/ingest/v1/delta" \
MYBOAT_IDENTITY_INGEST_URL="http://host.docker.internal:${NUXT_PORT}/api/ingest/v1/identity" \
MYBOAT_INGEST_KEY="${MYBOAT_INGEST_KEY}" \
MYBOAT_STREAM_PORT="${COLLECTOR_PORT}" \
SIGNALK_HTTP_URL="https://signalk-public.tideye.com/signalk/v1/api" \
COLLECTOR_BATCH_SIZE=75 \
COLLECTOR_FLUSH_INTERVAL_MS=2000 \
COLLECTOR_MAX_BUFFER_ITEMS=4000 \
COLLECTOR_MAX_POST_ITEMS=150 \
COLLECTOR_MIN_POST_INTERVAL_MS=1500 \
COLLECTOR_429_BACKOFF_MS=10000 \
bash "${ROOT_DIR}/scripts/run-tideye-test-collector.sh" >"${COLLECTOR_LOG}" 2>&1

OWNER_HISTORY_JSON=''

for _ in {1..60}; do
  START_ISO="$(node -e "console.log(new Date(Date.now() - 15 * 60 * 1000).toISOString())")"
  END_ISO="$(node -e "console.log(new Date().toISOString())")"

  OWNER_HISTORY_JSON="$(
    curl -fsS -G \
      -H 'X-Requested-With: XMLHttpRequest' \
      -b "$COOKIE_JAR" \
      "http://127.0.0.1:${NUXT_PORT}/api/app/vessels/${VESSEL_SLUG}/history" \
      --data-urlencode "start=${START_ISO}" \
      --data-urlencode "end=${END_ISO}" \
      --data-urlencode 'series=navigation.speedOverGround,environment.wind.speedApparent'
  )"

  if printf '%s' "$OWNER_HISTORY_JSON" | jq -e '([.series[].points | length] | any(. > 0))' >/dev/null; then
    break
  fi

  sleep 2
done

printf '%s' "$OWNER_HISTORY_JSON" | jq -e '([.series[].points | length] | any(. > 0))' >/dev/null

PUBLIC_CATALOG_JSON="$(
  curl -fsS \
    "http://127.0.0.1:${NUXT_PORT}/api/public/${USERNAME}/${VESSEL_SLUG}/history/catalog"
)"

printf '%s' "$PUBLIC_CATALOG_JSON" | jq -e '.series | length > 0' >/dev/null

cat <<EOF
Local telemetry smoke passed.
  App URL: http://127.0.0.1:${NUXT_PORT}
  Collector websocket: ws://127.0.0.1:${COLLECTOR_PORT}/myboat/v1/stream
  Influx URL: ${INFLUX_QUERY_URL}
  Vessel: ${USERNAME}/${VESSEL_SLUG}
  Owner history points: $(printf '%s' "$OWNER_HISTORY_JSON" | jq '[.series[].points | length] | add')
  Public catalog series: $(printf '%s' "$PUBLIC_CATALOG_JSON" | jq '.series | length')
  App log: ${APP_LOG}
  Collector log: ${COLLECTOR_LOG}
EOF
