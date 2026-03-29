#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_NAME="${MYBOAT_COLLECTOR_IMAGE:-myboat-edge-collector:dev}"
CONTAINER_NAME="${MYBOAT_COLLECTOR_CONTAINER_NAME:-myboat-edge-collector-tideye}"
SIGNALK_WS_URL="${SIGNALK_WS_URL:-wss://signalk-public.tideye.com/signalk/v1/stream?subscribe=all}"
SIGNALK_HTTP_URL="${SIGNALK_HTTP_URL:-https://signalk-public.tideye.com/signalk/v1/api}"
MYBOAT_DEV_PORT="${MYBOAT_DEV_PORT:-${NUXT_PORT:-3000}}"
MYBOAT_INGEST_URL="${MYBOAT_INGEST_URL:-http://host.docker.internal:${MYBOAT_DEV_PORT}/api/ingest/v1/delta}"
MYBOAT_IDENTITY_INGEST_URL="${MYBOAT_IDENTITY_INGEST_URL:-http://host.docker.internal:${MYBOAT_DEV_PORT}/api/ingest/v1/identity}"
MYBOAT_STREAM_PORT="${MYBOAT_STREAM_PORT:-4011}"
MYBOAT_STREAM_PATH="${MYBOAT_STREAM_PATH:-/myboat/v1/stream}"

if [[ -z "${MYBOAT_INGEST_KEY:-}" ]]; then
  echo "MYBOAT_INGEST_KEY is required."
  exit 1
fi

EXTRA_DOCKER_ARGS=()
if [[ "$(uname -s)" == "Linux" ]]; then
  EXTRA_DOCKER_ARGS+=(--add-host=host.docker.internal:host-gateway)
fi

echo "Building ${IMAGE_NAME} from apps/edge-collector..."
pnpm --filter @myboat/edge-collector run build >/dev/null
docker build -t "${IMAGE_NAME}" "${ROOT_DIR}/apps/edge-collector"

if docker ps -a --format '{{.Names}}' | grep -Fxq "${CONTAINER_NAME}"; then
  echo "Removing existing container ${CONTAINER_NAME}..."
  docker rm -f "${CONTAINER_NAME}" >/dev/null
fi

echo "Starting ${CONTAINER_NAME}..."
docker run -d \
  --name "${CONTAINER_NAME}" \
  "${EXTRA_DOCKER_ARGS[@]}" \
  -e SIGNALK_WS_URL="${SIGNALK_WS_URL}" \
  -e SIGNALK_HTTP_URL="${SIGNALK_HTTP_URL}" \
  -e MYBOAT_INGEST_URL="${MYBOAT_INGEST_URL}" \
  -e MYBOAT_IDENTITY_INGEST_URL="${MYBOAT_IDENTITY_INGEST_URL}" \
  -e MYBOAT_INGEST_KEY="${MYBOAT_INGEST_KEY}" \
  -e MYBOAT_STREAM_PORT="${MYBOAT_STREAM_PORT}" \
  -e MYBOAT_STREAM_PATH="${MYBOAT_STREAM_PATH}" \
  -e COLLECTOR_BATCH_SIZE="${COLLECTOR_BATCH_SIZE:-100}" \
  -e COLLECTOR_FLUSH_INTERVAL_MS="${COLLECTOR_FLUSH_INTERVAL_MS:-3000}" \
  -e COLLECTOR_MAX_BUFFER_ITEMS="${COLLECTOR_MAX_BUFFER_ITEMS:-5000}" \
  -e COLLECTOR_MAX_POST_ITEMS="${COLLECTOR_MAX_POST_ITEMS:-250}" \
  -e COLLECTOR_MIN_POST_INTERVAL_MS="${COLLECTOR_MIN_POST_INTERVAL_MS:-2000}" \
  -e COLLECTOR_429_BACKOFF_MS="${COLLECTOR_429_BACKOFF_MS:-10000}" \
  -e COLLECTOR_RECONNECT_DELAY_MS="${COLLECTOR_RECONNECT_DELAY_MS:-5000}" \
  -e COLLECTOR_REQUEST_TIMEOUT_MS="${COLLECTOR_REQUEST_TIMEOUT_MS:-15000}" \
  -p "${MYBOAT_STREAM_PORT}:${MYBOAT_STREAM_PORT}" \
  "${IMAGE_NAME}" >/dev/null

echo "Collector container is running."
echo "  Container: ${CONTAINER_NAME}"
echo "  SignalK source: ${SIGNALK_WS_URL}"
echo "  Ingest URL: ${MYBOAT_INGEST_URL}"
echo "  Published websocket: ws://localhost:${MYBOAT_STREAM_PORT}${MYBOAT_STREAM_PATH}"
echo "  Health: http://localhost:${MYBOAT_STREAM_PORT}/healthz"
echo
echo "Follow logs with:"
echo "  docker logs -f ${CONTAINER_NAME}"
