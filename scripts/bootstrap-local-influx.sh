#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FORMAT="text"
RESET=0

for arg in "$@"; do
  case "$arg" in
    --)
      ;;
    --format=env)
      FORMAT="env"
      ;;
    --reset)
      RESET=1
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

CONTAINER_NAME="${MYBOAT_LOCAL_INFLUX_CONTAINER:-myboat-local-influx}"
IMAGE="${MYBOAT_LOCAL_INFLUX_IMAGE:-influxdb:2.7.11}"
HOST_PORT="${MYBOAT_LOCAL_INFLUX_PORT:-18086}"
DATA_DIR="${MYBOAT_LOCAL_INFLUX_DATA_DIR:-$ROOT_DIR/.data/local-influx}"
ADMIN_USER="${MYBOAT_LOCAL_INFLUX_USERNAME:-myboat_local_admin}"
ADMIN_PASSWORD="${MYBOAT_LOCAL_INFLUX_PASSWORD:-myboat-local-password}"
ORG_NAME="${MYBOAT_LOCAL_INFLUX_ORG:-myboat-local}"
ADMIN_TOKEN="${MYBOAT_LOCAL_INFLUX_ADMIN_TOKEN:-myboat-local-admin-token}"
BOOTSTRAP_BUCKET="${MYBOAT_LOCAL_INFLUX_BOOTSTRAP_BUCKET:-myboat-bootstrap}"
BASE_URL="http://127.0.0.1:${HOST_PORT}"

mkdir -p "$DATA_DIR"

if [[ "$RESET" == "1" ]]; then
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  rm -rf "$DATA_DIR"
  mkdir -p "$DATA_DIR"
fi

if ! docker ps --format '{{.Names}}' | grep -Fxq "$CONTAINER_NAME"; then
  if docker ps -a --format '{{.Names}}' | grep -Fxq "$CONTAINER_NAME"; then
    docker rm -f "$CONTAINER_NAME" >/dev/null
  fi

  docker run -d \
    --name "$CONTAINER_NAME" \
    -p "${HOST_PORT}:8086" \
    -v "${DATA_DIR}:/var/lib/influxdb2" \
    -e DOCKER_INFLUXDB_INIT_MODE=setup \
    -e DOCKER_INFLUXDB_INIT_USERNAME="$ADMIN_USER" \
    -e DOCKER_INFLUXDB_INIT_PASSWORD="$ADMIN_PASSWORD" \
    -e DOCKER_INFLUXDB_INIT_ORG="$ORG_NAME" \
    -e DOCKER_INFLUXDB_INIT_BUCKET="$BOOTSTRAP_BUCKET" \
    -e DOCKER_INFLUXDB_INIT_ADMIN_TOKEN="$ADMIN_TOKEN" \
    "$IMAGE" >/dev/null
fi

for _ in {1..60}; do
  if curl -fsS "${BASE_URL}/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

ORG_ID="$(
  curl -fsS \
    -H "Authorization: Token ${ADMIN_TOKEN}" \
    "${BASE_URL}/api/v2/orgs?org=${ORG_NAME}" | jq -r '.orgs[0].id'
)"

if [[ -z "$ORG_ID" || "$ORG_ID" == "null" ]]; then
  echo "Failed to resolve Influx org ID for ${ORG_NAME}." >&2
  exit 1
fi

create_bucket() {
  local bucket_name="$1"
  local retention_seconds="$2"
  local existing_id
  existing_id="$(
    curl -fsS \
      -H "Authorization: Token ${ADMIN_TOKEN}" \
      "${BASE_URL}/api/v2/buckets?orgID=${ORG_ID}" |
      jq -r --arg bucket_name "$bucket_name" '.buckets[] | select(.name == $bucket_name) | .id' |
      head -n 1
  )"

  if [[ -n "$existing_id" ]]; then
    return
  fi

  local retention_rules='[]'
  if [[ "$retention_seconds" -gt 0 ]]; then
    retention_rules="$(jq -nc --argjson seconds "$retention_seconds" '[{type:"expire", everySeconds:$seconds}]')"
  fi

  jq -nc \
    --arg org_id "$ORG_ID" \
    --arg name "$bucket_name" \
    --argjson retention_rules "$retention_rules" \
    '{orgID:$org_id,name:$name,retentionRules:$retention_rules}' |
    curl -fsS \
      -X POST \
      -H "Authorization: Token ${ADMIN_TOKEN}" \
      -H 'Content-Type: application/json' \
      "${BASE_URL}/api/v2/buckets" \
      --data-binary @- >/dev/null
}

create_bucket "myboat_history_core_free" $((7 * 24 * 60 * 60))
create_bucket "myboat_history_core_paid" $((90 * 24 * 60 * 60))
create_bucket "myboat_history_detail_free" $((3 * 24 * 60 * 60))
create_bucket "myboat_history_detail_paid" $((30 * 24 * 60 * 60))
create_bucket "myboat_history_core_rollup_1h" $((365 * 24 * 60 * 60))
create_bucket "myboat_history_detail_rollup_1h" $((180 * 24 * 60 * 60))
create_bucket "myboat_debug" $((24 * 60 * 60))

if [[ "$FORMAT" == "env" ]]; then
  cat <<EOF
export INFLUX_WRITE_URL="${BASE_URL}"
export INFLUX_QUERY_URL="${BASE_URL}"
export INFLUX_ORG="${ORG_NAME}"
export INFLUX_WRITE_TOKEN="${ADMIN_TOKEN}"
export INFLUX_QUERY_TOKEN="${ADMIN_TOKEN}"
export INFLUX_BUCKET="myboat_debug"
export INFLUX_BUCKET_DEBUG="myboat_debug"
export INFLUX_BUCKET_CORE_FREE="myboat_history_core_free"
export INFLUX_BUCKET_CORE_PAID="myboat_history_core_paid"
export INFLUX_BUCKET_DETAIL_FREE="myboat_history_detail_free"
export INFLUX_BUCKET_DETAIL_PAID="myboat_history_detail_paid"
export INFLUX_BUCKET_CORE_ROLLUP_1H="myboat_history_core_rollup_1h"
export INFLUX_BUCKET_DETAIL_ROLLUP_1H="myboat_history_detail_rollup_1h"
EOF
  exit 0
fi

cat <<EOF
Local Influx is ready.
  Container: ${CONTAINER_NAME}
  URL: ${BASE_URL}
  Org: ${ORG_NAME}
  Core free bucket: myboat_history_core_free
  Core paid bucket: myboat_history_core_paid
  Detail free bucket: myboat_history_detail_free
  Detail paid bucket: myboat_history_detail_paid
  Debug bucket: myboat_debug

For shell exports:
  eval "\$(${ROOT_DIR}/scripts/bootstrap-local-influx.sh --format=env)"
EOF
