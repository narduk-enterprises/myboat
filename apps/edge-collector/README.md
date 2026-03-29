# MyBoat Edge Collector

Small Node-based forwarder that subscribes to a SignalK websocket, relays delta
updates to the MyBoat ingest endpoint, and periodically bootstraps observed
vessel identity plus normalized source inventory from SignalK REST. The
collector runs MyBoat's canonical source-selection policy before posting, so
only canonical winners go to curated ingest while duplicate losers go only to
the short-lived debug path. It also republishes the selected canonical deltas on
a MyBoat-owned websocket so the app can consume the same deduplicated boat-side
feed that the collector is ingesting.

## Throughput and rate limits

The ingest route (`/api/ingest/v1/delta`) is rate-limited with the shared
`authApiKeys` policy (**60 successful requests per minute** per client key in
the Nuxt layer). SignalK `subscribe=all` traffic can produce many small deltas
very quickly, so the collector defaults are tuned to stay **well under** that
limit:

- **Larger batches** — fewer HTTP requests for the same stream of deltas.
- **Minimum spacing between POSTs** — caps sustained request rate even when the
  batch fills fast. With the default `COLLECTOR_MIN_POST_INTERVAL_MS=2000`, you
  get at most **30 ingest POSTs/minute** from spacing alone (before counting
  other clients or retries).
- **Longer flush interval** — when the stream is quiet, the timer still flushes
  periodically without chatting every second.

If a POST returns **429 Too Many Requests**, the collector **re-queues** the
batch (no data dropped), waits at least `COLLECTOR_429_BACKOFF_MS` (default
10s), and uses a longer wait if the response includes a valid **`Retry-After`**
header (seconds or HTTP-date). After backoff, it retries on the normal flush
timer path. Other ingest failures still use `COLLECTOR_RECONNECT_DELAY_MS` for
the retry delay.

The buffer can grow past `COLLECTOR_BATCH_SIZE` while waiting for the minimum
post interval or a 429 backoff; increase batch size or intervals if memory on
the edge device is tight.

Source selection happens before batching. The collector expands object-valued
SignalK updates into canonical leaf paths, groups candidates by
`(context, canonicalPath)`, applies sticky-winner freshness windows, and emits
only canonical winners to normal ingest. Duplicate losers are still forwarded,
but only as `debugOnly: true` telemetry for the `myboat_debug` path.

## Environment

- `SIGNALK_WS_URL`: SignalK websocket source. Defaults to
  `ws://localhost:3000/signalk/v1/stream?subscribe=all`.
- `SIGNALK_HTTP_URL`: SignalK REST API base used for self-identity discovery.
  Defaults to the websocket URL rewritten from `/stream` to `/api`.
- `MYBOAT_INGEST_URL`: MyBoat ingest endpoint. Defaults to
  `https://mybo.at/api/ingest/v1/delta`.
- `MYBOAT_IDENTITY_INGEST_URL`: MyBoat observed-identity ingest endpoint.
  Defaults to the delta ingest URL rewritten from `/delta` to `/identity`.
- `MYBOAT_SOURCES_INGEST_URL`: MyBoat source-inventory ingest endpoint. Defaults
  to the delta ingest URL rewritten from `/delta` to `/sources`.
- `MYBOAT_INGEST_KEY`: Required ingest bearer token.
- `MYBOAT_PUBLISHER_ROLE`: Publisher identity for this collector. Defaults to
  `primary`. Use `shadow` only for isolated Bee shadow-canary tests.
- `MYBOAT_STREAM_PORT`: Port for the collector-published MyBoat websocket feed.
  Default `4011`.
- `MYBOAT_STREAM_PATH`: Path for the collector-published MyBoat websocket feed.
  Default `/myboat/v1/stream`.
- `COLLECTOR_BATCH_SIZE`: Minimum buffered deltas before an eager flush is
  attempted (may exceed this while throttled). Default `100`.
- `COLLECTOR_MAX_BUFFER_ITEMS`: Maximum queued delta messages kept in memory
  before the oldest buffered items are dropped. Default `5000`.
- `COLLECTOR_MAX_POST_ITEMS`: Maximum queued delta messages included in one
  ingest POST. Default `250`.
- `COLLECTOR_FLUSH_INTERVAL_MS`: Upper bound on how long deltas sit before a
  timer-driven flush. Default `3000`.
- `COLLECTOR_IDENTITY_REFRESH_INTERVAL_MS`: How often to refresh observed vessel
  identity from SignalK REST. Default `900000` (15 minutes).
- `COLLECTOR_MIN_POST_INTERVAL_MS`: Minimum milliseconds between ingest POST
  attempts. Default `2000`.
- `COLLECTOR_429_BACKOFF_MS`: Minimum wait after a 429 before retrying, when
  `Retry-After` is missing or shorter. Default `10000`.
- `COLLECTOR_RECONNECT_DELAY_MS`: Delay before reconnecting the websocket after
  failure. Default `5000`.
- `COLLECTOR_REQUEST_TIMEOUT_MS`: Timeout for ingest POSTs. Default `15000`.
- `COLLECTOR_USER_AGENT`: Optional request user-agent header.
- `MYBOAT_X_REQUESTED_WITH`: Optional CSRF compatibility header. Default
  `XMLHttpRequest`.

The collector refreshes `/signalk/v1/api/sources` on startup and on the same
cadence as identity refresh. A `shadow` publisher never overrides a fresh
primary winner; it is recorded only in diagnostics and debug telemetry unless a
controlled shadow-only test window explicitly changes the topology.

## Local Run

```bash
pnpm --filter @myboat/edge-collector dev
```

## Docker Build

```bash
cd apps/edge-collector
pnpm run build
docker build -t myboat-edge-collector .
docker run --rm \
  -e SIGNALK_WS_URL=\
wss://signalk-public.tideye.com/signalk/v1/stream?subscribe=all \
  -e MYBOAT_INGEST_URL=https://mybo.at/api/ingest/v1/delta \
  -e MYBOAT_INGEST_KEY=nk_replace_me \
  -p 4011:4011 \
  myboat-edge-collector
```

## Root helper

From the repo root you can launch the same Tideye-forwarding Docker path with:

```bash
MYBOAT_INGEST_KEY=nk_replace_me pnpm run dev:collector:tideye
```

Defaults:

- SignalK source:
  `wss://signalk-public.tideye.com/signalk/v1/stream?subscribe=all`
- Ingest URL: `http://host.docker.internal:3000/api/ingest/v1/delta`
- Published collector websocket: `ws://localhost:4011/myboat/v1/stream`

If your local app is not on port `3000`, set `MYBOAT_DEV_PORT` or override
`MYBOAT_INGEST_URL` directly.

Published MyBoat websocket:

- `ws://localhost:4011/myboat/v1/stream`
- Health probe: `http://localhost:4011/healthz`

## Local end-to-end smoke

From the repo root you can bootstrap a local Influx instance, start the local
MyBoat app with those Influx settings, mint a real app-issued ingest key, run
the collector container against `signalk-public.tideye.com`, and verify both the
Influx buckets and the MyBoat history API:

```bash
pnpm run smoke:telemetry:local
```

## Remote canary deployment on `narduk`

To refresh the remote proving rig without touching the live Bee install:

```bash
bash scripts/deploy-narduk-edge-canary.sh
```

The deploy script syncs `apps/edge-collector/` to
`/opt/narduk/myboat-edge-canary/app`, installs the repo-managed canary
`docker-compose.yml`, rebuilds and restarts the `myboat-edge-canary` container,
then waits for the collector healthcheck and prints the final `/healthz`
payload. That payload now includes source inventory refresh status plus dedupe
counters such as `sourceCandidatesSeen`, `sourceWinnersKept`,
`sourceLosersDropped`, `shadowSourceSuppressed`, fallback counts, sticky-winner
retention state, and source-inventory success/failure timestamps.
