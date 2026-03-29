# MyBoat Edge Collector

Small Node-based forwarder that subscribes to a SignalK websocket, relays delta
updates to the MyBoat ingest endpoint, and periodically bootstraps observed
vessel identity from the SignalK REST self model. It also republishes the raw
deltas on a MyBoat-owned websocket so the app can consume the same simulated
boat-side feed that the collector is ingesting.

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

## Environment

- `SIGNALK_WS_URL`: SignalK websocket source. Defaults to
  `ws://localhost:3000/signalk/v1/stream?subscribe=all`.
- `SIGNALK_HTTP_URL`: SignalK REST API base used for self-identity discovery.
  Defaults to the websocket URL rewritten from `/stream` to `/api`.
- `MYBOAT_INGEST_URL`: MyBoat ingest endpoint. Defaults to
  `https://mybo.at/api/ingest/v1/delta`.
- `MYBOAT_IDENTITY_INGEST_URL`: MyBoat observed-identity ingest endpoint.
  Defaults to the delta ingest URL rewritten from `/delta` to `/identity`.
- `MYBOAT_INGEST_KEY`: Required ingest bearer token.
- `MYBOAT_STREAM_PORT`: Port for the collector-published MyBoat websocket feed.
  Default `4011`.
- `MYBOAT_STREAM_PATH`: Path for the collector-published MyBoat websocket feed.
  Default `/myboat/v1/stream`.
- `COLLECTOR_BATCH_SIZE`: Minimum buffered deltas before an eager flush is
  attempted (may exceed this while throttled). Default `100`.
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

## Local Run

```bash
pnpm --filter @myboat/edge-collector dev
```

## Docker Build

```bash
cd apps/edge-collector
docker build -t myboat-edge-collector .
docker run --rm \
  -e SIGNALK_WS_URL=wss://signalk-public.tideye.com/signalk/v1/stream?subscribe=all \
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
