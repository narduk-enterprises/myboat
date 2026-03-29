#!/usr/bin/env bash
set -euo pipefail

REMOTE_SSH="${REMOTE_SSH:-bee.tideye.com}"
REMOTE_DIR="${REMOTE_DIR:-/mnt/external_drive/myboat-bee-consumer}"
REMOTE_APP_DIR="${REMOTE_DIR}/app"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/.." && pwd)"
local_app_dir="${repo_root}/apps/edge-collector"
local_deploy_dir="${local_app_dir}/deploy/bee"

log() {
  printf '[deploy-bee-consumer] %s\n' "$*"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

for cmd in rsync ssh; do
  require_cmd "${cmd}"
done

log "building local collector bundle"
pnpm --filter @myboat/edge-collector run build

log "ensuring remote Bee directories exist on ${REMOTE_SSH}"
ssh "${REMOTE_SSH}" "mkdir -p '${REMOTE_APP_DIR}'"

log "syncing edge collector source to ${REMOTE_SSH}:${REMOTE_APP_DIR}"
rsync -az --delete \
  --exclude '.turbo/' \
  --exclude 'node_modules/' \
  --exclude 'test/' \
  "${local_app_dir}/" "${REMOTE_SSH}:${REMOTE_APP_DIR}/"

log "syncing Bee compose assets"
rsync -az \
  "${local_deploy_dir}/docker-compose.yml" \
  "${local_deploy_dir}/.env.init.example" \
  "${REMOTE_SSH}:${REMOTE_DIR}/"

log "building and restarting the Bee consumer"
ssh "${REMOTE_SSH}" "bash -s" -- "${REMOTE_DIR}" "${MYBOAT_INGEST_KEY:-}" "${MYBOAT_PUBLISHER_ROLE:-shadow}" <<'REMOTE'
set -euo pipefail

remote_dir="$1"
ingest_key="$2"
publisher_role="$3"

cd "${remote_dir}"
export DOCKER_CONFIG="${remote_dir}/.docker-config"
mkdir -p "${DOCKER_CONFIG}"

if [[ ! -f .env ]]; then
  cp .env.init.example .env
  printf '[deploy-bee-consumer] created %s/.env from .env.init.example\n' "${remote_dir}"
fi

upsert_env() {
  local key="$1"
  local value="$2"

  if grep -q "^${key}=" .env; then
    sed -i "s|^${key}=.*|${key}=${value}|" .env
    return
  fi

  printf '%s=%s\n' "${key}" "${value}" >>.env
}

upsert_env "SIGNALK_WS_URL" "ws://127.0.0.1:3000/signalk/v1/stream?subscribe=all"
upsert_env "SIGNALK_HTTP_URL" "http://127.0.0.1:3000/signalk/v1/api"
upsert_env "MYBOAT_INGEST_URL" "https://mybo.at/api/ingest/v1/delta"
upsert_env "COLLECTOR_NAME" "myboat-bee-consumer"
upsert_env "COLLECTOR_BATCH_SIZE" "500"
upsert_env "COLLECTOR_FLUSH_INTERVAL_MS" "1500"
upsert_env "COLLECTOR_MAX_BUFFER_ITEMS" "50000"
upsert_env "COLLECTOR_MAX_POST_ITEMS" "1000"
upsert_env "COLLECTOR_MIN_POST_INTERVAL_MS" "1500"
upsert_env "COLLECTOR_USER_AGENT" "myboat-bee-consumer/0.2.0"
upsert_env "MYBOAT_PUBLISHER_ROLE" "${publisher_role}"

if [[ -n "${ingest_key}" ]]; then
  upsert_env "MYBOAT_INGEST_KEY" "${ingest_key}"
fi

docker compose config >/dev/null
docker compose build --pull myboat-bee-consumer
docker compose up -d --force-recreate myboat-bee-consumer

healthy="false"

for attempt in $(seq 1 30); do
  status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}starting{{end}}' myboat-bee-consumer)"
  if [[ "${status}" == "healthy" ]]; then
    healthy="true"
    break
  fi

  if [[ "${status}" == "unhealthy" ]]; then
    docker logs --tail 80 myboat-bee-consumer >&2 || true
    echo 'Bee consumer failed healthcheck' >&2
    exit 1
  fi

  sleep 2
done

if [[ "${healthy}" != "true" ]]; then
  docker logs --tail 80 myboat-bee-consumer >&2 || true
  echo 'Bee consumer did not become healthy in time' >&2
  exit 1
fi

docker compose ps myboat-bee-consumer
docker logs --tail 40 myboat-bee-consumer
docker exec myboat-bee-consumer node -e "fetch('http://127.0.0.1:' + (process.env.MYBOAT_STREAM_PORT || '4011') + '/healthz').then((response) => response.text()).then((body) => console.log(body)).catch((error) => { console.error(error); process.exit(1) })"
REMOTE
