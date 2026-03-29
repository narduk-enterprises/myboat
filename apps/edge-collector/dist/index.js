import process from 'node:process';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
let socket = null;
let reconnectTimer = null;
let flushTimer = null;
let identityRefreshTimer = null;
let isFlushing = false;
let isRefreshingIdentity = false;
let hasLoggedServerHello = false;
let isShuttingDown = false;
let batch = [];
let lastPostStartedAt = 0;
let nextPostNotBefore = 0;
let lastPublishedAt = null;
let lastPublishedDeltaRaw = null;
let signalkSelfContext = null;
const liveClients = new Set();
class IngestHttpError extends Error {
    status;
    retryAfterMs;
    constructor(message, status, retryAfterMs) {
        super(message);
        this.name = 'IngestHttpError';
        this.status = status;
        this.retryAfterMs = retryAfterMs;
    }
}
function parsePositiveInteger(name, fallback) {
    const raw = process.env[name]?.trim();
    if (!raw)
        return fallback;
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
    }
    throw new Error(`${name} must be a positive integer.`);
}
function withDefaultSignalKSubscription(rawUrl) {
    const url = new URL(rawUrl);
    if (!url.searchParams.has('subscribe')) {
        url.searchParams.set('subscribe', 'all');
    }
    return url.toString();
}
function deriveSignalKHttpUrl(rawWsUrl) {
    const url = new URL(rawWsUrl);
    url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
    url.search = '';
    url.pathname = url.pathname.replace(/\/stream$/, '/api');
    return url.toString();
}
function withTrailingSlash(rawUrl) {
    return rawUrl.endsWith('/') ? rawUrl : `${rawUrl}/`;
}
function deriveIdentityIngestUrl(rawDeltaUrl) {
    const url = new URL(rawDeltaUrl);
    if (url.pathname.endsWith('/delta')) {
        url.pathname = `${url.pathname.slice(0, -'/delta'.length)}/identity`;
        return url.toString();
    }
    url.pathname = `${url.pathname.replace(/\/+$/g, '')}/identity`;
    return url.toString();
}
function normalizeStreamPath(rawPath) {
    const normalizedPath = rawPath?.trim();
    if (!normalizedPath) {
        return '/myboat/v1/stream';
    }
    return normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
}
function loadConfig() {
    const signalkWsUrl = withDefaultSignalKSubscription(process.env.SIGNALK_WS_URL?.trim() || 'ws://localhost:3000/signalk/v1/stream');
    const signalkHttpUrl = process.env.SIGNALK_HTTP_URL?.trim() || deriveSignalKHttpUrl(signalkWsUrl);
    const ingestUrl = process.env.MYBOAT_INGEST_URL?.trim() || 'https://mybo.at/api/ingest/v1/delta';
    const identityIngestUrl = process.env.MYBOAT_IDENTITY_INGEST_URL?.trim() || deriveIdentityIngestUrl(ingestUrl);
    const ingestKey = process.env.MYBOAT_INGEST_KEY?.trim();
    if (!ingestKey) {
        throw new Error('MYBOAT_INGEST_KEY is required.');
    }
    return {
        signalkWsUrl,
        signalkHttpUrl,
        ingestUrl,
        identityIngestUrl,
        ingestKey,
        streamPort: parsePositiveInteger('MYBOAT_STREAM_PORT', 4011),
        streamPath: normalizeStreamPath(process.env.MYBOAT_STREAM_PATH),
        // Larger batches + spacing keep ingest POSTs well under authApiKeys (60/min).
        batchSize: parsePositiveInteger('COLLECTOR_BATCH_SIZE', 100),
        flushIntervalMs: parsePositiveInteger('COLLECTOR_FLUSH_INTERVAL_MS', 3000),
        identityRefreshIntervalMs: parsePositiveInteger('COLLECTOR_IDENTITY_REFRESH_INTERVAL_MS', 15 * 60 * 1000),
        minPostIntervalMs: parsePositiveInteger('COLLECTOR_MIN_POST_INTERVAL_MS', 2000),
        rateLimitBackoffMs: parsePositiveInteger('COLLECTOR_429_BACKOFF_MS', 10_000),
        reconnectDelayMs: parsePositiveInteger('COLLECTOR_RECONNECT_DELAY_MS', 5000),
        requestTimeoutMs: parsePositiveInteger('COLLECTOR_REQUEST_TIMEOUT_MS', 15000),
        userAgent: process.env.COLLECTOR_USER_AGENT?.trim() || 'myboat-edge-collector/0.1.0',
        xRequestedWith: process.env.MYBOAT_X_REQUESTED_WITH?.trim() || 'XMLHttpRequest',
    };
}
const config = loadConfig();
const streamServer = createServer((request, response) => {
    const host = request.headers.host || 'localhost';
    const url = new URL(request.url || '/', `http://${host}`);
    if (url.pathname === '/healthz') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
            ok: true,
            connectedClients: liveClients.size,
            identityIngestUrl: config.identityIngestUrl,
            ingestUrl: config.ingestUrl,
            lastPublishedAt,
            signalkHttpUrl: config.signalkHttpUrl,
            signalkWsUrl: config.signalkWsUrl,
            streamPath: config.streamPath,
            streamPort: config.streamPort,
        }));
        return;
    }
    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: false }));
});
const streamSocketServer = new WebSocketServer({ noServer: true });
function log(message, detail) {
    const prefix = `[edge-collector ${new Date().toISOString()}]`;
    if (detail === undefined) {
        console.log(prefix, message);
        return;
    }
    console.log(prefix, message, detail);
}
function warn(message, detail) {
    const prefix = `[edge-collector ${new Date().toISOString()}]`;
    if (detail === undefined) {
        console.warn(prefix, message);
        return;
    }
    console.warn(prefix, message, detail);
}
function broadcastToLiveClients(message) {
    lastPublishedAt = new Date().toISOString();
    lastPublishedDeltaRaw = message;
    for (const client of liveClients) {
        if (client.readyState !== client.OPEN) {
            liveClients.delete(client);
            continue;
        }
        client.send(message);
    }
}
function maybeUpdateSignalKSelfContext(nextSelf) {
    if (typeof nextSelf !== 'string') {
        return;
    }
    const normalized = nextSelf.trim();
    if (!normalized || normalized === signalkSelfContext) {
        return;
    }
    signalkSelfContext = normalized;
    void refreshObservedIdentity('self-context-update');
    const hello = buildCollectorHelloMessage();
    for (const client of liveClients) {
        if (client.readyState !== client.OPEN) {
            liveClients.delete(client);
            continue;
        }
        client.send(hello);
    }
}
function normalizeDeltaForIngest(delta) {
    const self = typeof delta.self === 'string' && delta.self.trim() ? delta.self.trim() : signalkSelfContext;
    if (!self) {
        return delta;
    }
    return {
        ...delta,
        self,
    };
}
function buildCollectorHelloMessage() {
    return JSON.stringify({
        name: 'myboat-edge-collector',
        self: signalkSelfContext || 'vessels.self',
        version: '0.1.0',
    });
}
function startMyBoatStreamServer() {
    streamSocketServer.on('connection', (client) => {
        liveClients.add(client);
        client.send(buildCollectorHelloMessage());
        if (lastPublishedDeltaRaw) {
            client.send(lastPublishedDeltaRaw);
        }
        client.on('close', () => {
            liveClients.delete(client);
        });
        client.on('error', (error) => {
            warn('MyBoat stream client error', error instanceof Error ? error.message : error);
            liveClients.delete(client);
        });
    });
    streamServer.on('upgrade', (request, socketHandle, head) => {
        const host = request.headers.host || 'localhost';
        const url = new URL(request.url || '/', `http://${host}`);
        if (url.pathname !== config.streamPath) {
            socketHandle.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
            socketHandle.destroy();
            return;
        }
        streamSocketServer.handleUpgrade(request, socketHandle, head, (client) => {
            streamSocketServer.emit('connection', client, request);
        });
    });
    streamServer.listen(config.streamPort, () => {
        log('Publishing MyBoat stream', `ws://0.0.0.0:${config.streamPort}${config.streamPath}`);
    });
}
function isSignalKDeltaMessage(value) {
    if (!value || typeof value !== 'object')
        return false;
    const candidate = value;
    if (!Array.isArray(candidate.updates))
        return false;
    return candidate.updates.every((update) => {
        if (!update || typeof update !== 'object')
            return false;
        const typedUpdate = update;
        if (!Array.isArray(typedUpdate.values))
            return false;
        return typedUpdate.values.every((item) => {
            if (!item || typeof item !== 'object')
                return false;
            const typedItem = item;
            return typeof typedItem.path === 'string';
        });
    });
}
function clearReconnectTimer() {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
}
function clearFlushTimer() {
    if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
    }
}
function clearIdentityRefreshTimer() {
    if (identityRefreshTimer) {
        clearTimeout(identityRefreshTimer);
        identityRefreshTimer = null;
    }
}
function scheduleReconnect(reason) {
    if (isShuttingDown || reconnectTimer)
        return;
    warn(`SignalK websocket disconnected; reconnecting in ${config.reconnectDelayMs}ms`, reason);
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
    }, config.reconnectDelayMs);
}
function scheduleFlush(delayMs = config.flushIntervalMs) {
    if (flushTimer)
        return;
    flushTimer = setTimeout(() => {
        flushTimer = null;
        void flushBatch();
    }, delayMs);
}
function scheduleIdentityRefresh(delayMs = config.identityRefreshIntervalMs) {
    if (isShuttingDown || identityRefreshTimer) {
        return;
    }
    identityRefreshTimer = setTimeout(() => {
        identityRefreshTimer = null;
        void refreshObservedIdentity('scheduled-refresh');
    }, delayMs);
}
function parseRetryAfterMs(header) {
    if (!header)
        return undefined;
    const asSeconds = Number.parseInt(header, 10);
    if (Number.isFinite(asSeconds) && asSeconds >= 0) {
        return asSeconds * 1000;
    }
    const asDate = Date.parse(header);
    if (Number.isFinite(asDate)) {
        return Math.max(0, asDate - Date.now());
    }
    return undefined;
}
function msUntilMinPostInterval() {
    if (!lastPostStartedAt)
        return 0;
    const elapsed = Date.now() - lastPostStartedAt;
    return Math.max(0, config.minPostIntervalMs - elapsed);
}
function msUntilPostAllowed() {
    return Math.max(msUntilMinPostInterval(), Math.max(0, nextPostNotBefore - Date.now()));
}
function normalizeTrimmedString(value, maxLength) {
    if (typeof value === 'string') {
        const normalized = value.trim();
        return normalized ? normalized.slice(0, maxLength) : undefined;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value).slice(0, maxLength);
    }
    return undefined;
}
function normalizeFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
function normalizeMmsi(value) {
    const normalized = normalizeTrimmedString(value, 32);
    if (!normalized) {
        return undefined;
    }
    const match = normalized.match(/\b(\d{9})\b/);
    return match?.[1];
}
function unwrapSignalKValue(value) {
    if (value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        'value' in value &&
        Object.keys(value).length <= 6) {
        return value.value;
    }
    return value;
}
function readSignalKPathValue(model, path) {
    const segments = path.split('.');
    let current = model;
    for (const segment of segments) {
        if (!current || typeof current !== 'object' || Array.isArray(current)) {
            return undefined;
        }
        current = current[segment];
    }
    return unwrapSignalKValue(current);
}
function looksLikeSignalKVesselModel(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }
    const candidate = value;
    return ['name', 'navigation', 'communication', 'design', 'registrations'].some((key) => key in candidate);
}
function unwrapSignalKVesselModel(model) {
    if (looksLikeSignalKVesselModel(model)) {
        return model;
    }
    if (!model || typeof model !== 'object' || Array.isArray(model)) {
        return null;
    }
    const values = Object.values(model);
    if (values.length === 1 && looksLikeSignalKVesselModel(values[0])) {
        return values[0];
    }
    return null;
}
function extractMmsiFromContext(context) {
    const normalized = context?.trim() || '';
    if (!normalized) {
        return undefined;
    }
    const match = normalized.match(/mmsi:(\d{9})/i);
    return match?.[1];
}
function buildObservedIdentityPayload(model) {
    const vesselModel = unwrapSignalKVesselModel(model);
    if (!vesselModel) {
        return null;
    }
    const payload = {
        timestamp: new Date().toISOString(),
        source: 'signalk_rest',
    };
    if (signalkSelfContext) {
        payload.selfContext = signalkSelfContext;
        payload.mmsi = extractMmsiFromContext(signalkSelfContext);
    }
    payload.observedName = normalizeTrimmedString(readSignalKPathValue(vesselModel, 'name'), 120);
    payload.callSign = normalizeTrimmedString(readSignalKPathValue(vesselModel, 'communication.callsignVhf') ??
        readSignalKPathValue(vesselModel, 'communication.callsign'), 40);
    payload.shipType = normalizeTrimmedString(readSignalKPathValue(vesselModel, 'design.type'), 120);
    payload.shipTypeCode = normalizeFiniteNumber(readSignalKPathValue(vesselModel, 'design.aisShipType'));
    payload.lengthOverall = normalizeFiniteNumber(readSignalKPathValue(vesselModel, 'design.length.overall'));
    payload.beam = normalizeFiniteNumber(readSignalKPathValue(vesselModel, 'design.beam'));
    payload.draft =
        normalizeFiniteNumber(readSignalKPathValue(vesselModel, 'design.draft.current')) ??
            normalizeFiniteNumber(readSignalKPathValue(vesselModel, 'design.draft.maximum'));
    payload.registrationNumber = normalizeTrimmedString(readSignalKPathValue(vesselModel, 'registrations.national') ??
        readSignalKPathValue(vesselModel, 'registrations.other') ??
        readSignalKPathValue(vesselModel, 'registrations.registration'), 80);
    payload.imo = normalizeTrimmedString(readSignalKPathValue(vesselModel, 'registrations.imo'), 32);
    payload.mmsi =
        payload.mmsi ??
            normalizeMmsi(readSignalKPathValue(vesselModel, 'registrations.mmsi')) ??
            normalizeMmsi(readSignalKPathValue(vesselModel, 'mmsi'));
    const hasData = Object.entries(payload).some(([key, value]) => key !== 'timestamp' && key !== 'source' && value !== undefined);
    return hasData ? payload : null;
}
async function fetchSignalKObservedIdentity() {
    const url = new URL('vessels/self', withTrailingSlash(config.signalkHttpUrl));
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            'User-Agent': config.userAgent,
            'X-Requested-With': config.xRequestedWith,
        },
        signal: AbortSignal.timeout(config.requestTimeoutMs),
    });
    if (!response.ok) {
        throw new Error(`SignalK identity fetch failed: ${response.status}`);
    }
    return buildObservedIdentityPayload(await response.json());
}
async function postObservedIdentity(payload) {
    const response = await fetch(config.identityIngestUrl, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${config.ingestKey}`,
            'Content-Type': 'application/json',
            'User-Agent': config.userAgent,
            'X-Requested-With': config.xRequestedWith,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(config.requestTimeoutMs),
    });
    const bodyText = await response.text();
    if (!response.ok) {
        throw new Error(`Identity ingest failed: ${response.status} ${bodyText}`.trim());
    }
}
async function refreshObservedIdentity(reason) {
    if (isRefreshingIdentity || isShuttingDown) {
        return;
    }
    isRefreshingIdentity = true;
    clearIdentityRefreshTimer();
    try {
        const payload = await fetchSignalKObservedIdentity();
        if (!payload) {
            log('No observed vessel identity found in SignalK self model', reason);
            return;
        }
        await postObservedIdentity(payload);
        log('Forwarded observed vessel identity to MyBoat', {
            reason,
            mmsi: payload.mmsi,
            selfContext: payload.selfContext,
        });
    }
    catch (error) {
        warn('Failed to refresh observed vessel identity', error instanceof Error ? error.message : error);
    }
    finally {
        isRefreshingIdentity = false;
        scheduleIdentityRefresh();
    }
}
function connect() {
    clearReconnectTimer();
    hasLoggedServerHello = false;
    log(`Connecting to SignalK`, config.signalkWsUrl);
    socket = new WebSocket(config.signalkWsUrl);
    socket.addEventListener('open', () => {
        log('Connected to SignalK');
        void refreshObservedIdentity('socket-open');
    });
    socket.addEventListener('message', (event) => {
        void handleSocketMessage(event.data);
    });
    socket.addEventListener('error', (event) => {
        warn('SignalK websocket error', event.type);
    });
    socket.addEventListener('close', (event) => {
        socket = null;
        if (isShuttingDown) {
            log(`SignalK websocket closed`, `${event.code} ${event.reason || ''}`.trim());
            return;
        }
        scheduleReconnect(`${event.code} ${event.reason || ''}`.trim());
    });
}
async function handleSocketMessage(data) {
    const raw = typeof data === 'string' ? data : String(data);
    try {
        const parsed = JSON.parse(raw);
        if (isSignalKDeltaMessage(parsed)) {
            broadcastToLiveClients(raw);
            enqueueDelta(parsed);
            return;
        }
        if (!hasLoggedServerHello && parsed && typeof parsed === 'object') {
            const hello = parsed;
            hasLoggedServerHello = true;
            maybeUpdateSignalKSelfContext(hello.self);
            log('Received non-delta SignalK message', {
                name: typeof hello.name === 'string' ? hello.name : undefined,
                version: typeof hello.version === 'string' ? hello.version : undefined,
                self: typeof hello.self === 'string' ? hello.self : undefined,
            });
        }
    }
    catch (error) {
        warn('Failed to parse SignalK message', error instanceof Error ? error.message : error);
    }
}
function enqueueDelta(delta) {
    batch.push({
        timestamp: new Date().toISOString(),
        delta: normalizeDeltaForIngest(delta),
    });
    scheduleFlush();
}
function mergeBatchItems(items) {
    const latestTimestamp = items[items.length - 1]?.timestamp || new Date().toISOString();
    return {
        timestamp: latestTimestamp,
        deltas: Array.from(items
            .reduce((groups, item) => {
            const context = item.delta.context?.trim() || '';
            const self = item.delta.self?.trim() || '';
            const groupKey = `${context}\u0000${self}`;
            const currentGroup = groups.get(groupKey);
            if (!currentGroup) {
                groups.set(groupKey, {
                    timestamp: item.timestamp,
                    delta: {
                        ...(item.delta.context ? { context: item.delta.context } : {}),
                        ...(item.delta.self ? { self: item.delta.self } : {}),
                        updates: [...item.delta.updates],
                    },
                });
                return groups;
            }
            currentGroup.timestamp = item.timestamp;
            currentGroup.delta.updates.push(...item.delta.updates);
            return groups;
        }, new Map())
            .values()),
    };
}
async function postDeltaBatch(items) {
    const payload = mergeBatchItems(items);
    const response = await fetch(config.ingestUrl, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${config.ingestKey}`,
            'Content-Type': 'application/json',
            'User-Agent': config.userAgent,
            'X-Requested-With': config.xRequestedWith,
        },
        body: JSON.stringify({
            timestamp: payload.timestamp,
            deltas: payload.deltas,
        }),
        signal: AbortSignal.timeout(config.requestTimeoutMs),
    });
    const bodyText = await response.text();
    if (response.status === 429) {
        const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'));
        throw new IngestHttpError(`429 ${bodyText}`.trim(), 429, retryAfterMs);
    }
    if (!response.ok) {
        throw new Error(`${response.status} ${bodyText}`);
    }
}
async function flushBatch() {
    if (isFlushing || batch.length === 0) {
        return;
    }
    const throttleMs = msUntilPostAllowed();
    if (throttleMs > 0) {
        scheduleFlush(throttleMs);
        return;
    }
    isFlushing = true;
    clearFlushTimer();
    const pending = batch;
    batch = [];
    try {
        lastPostStartedAt = Date.now();
        await postDeltaBatch(pending);
        nextPostNotBefore = 0;
        log(`Forwarded ${pending.length} SignalK delta message(s) to MyBoat in one ingest request`);
    }
    catch (error) {
        batch = [...pending, ...batch];
        if (error instanceof IngestHttpError && error.status === 429) {
            const fromHeader = error.retryAfterMs;
            const backoffMs = Math.max(fromHeader ?? 0, config.rateLimitBackoffMs);
            nextPostNotBefore = Date.now() + backoffMs;
            warn(`Ingest rate limited (429); backing off before retry`, `${backoffMs}ms${fromHeader !== undefined ? ' (includes Retry-After)' : ''}`);
            scheduleFlush(backoffMs);
        }
        else {
            warn('Failed to ingest SignalK delta batch', error instanceof Error ? error.message : error);
            scheduleFlush(config.reconnectDelayMs);
        }
    }
    finally {
        isFlushing = false;
        if (batch.length > 0 && !flushTimer) {
            scheduleFlush();
        }
    }
}
async function shutdown(signal) {
    if (isShuttingDown)
        return;
    isShuttingDown = true;
    log(`Shutting down after ${signal}`);
    clearReconnectTimer();
    clearFlushTimer();
    clearIdentityRefreshTimer();
    if (socket && socket.readyState < WebSocket.CLOSING) {
        socket.close(1000, 'shutdown');
    }
    for (const client of liveClients) {
        if (client.readyState < client.CLOSING) {
            client.close(1000, 'shutdown');
        }
    }
    await new Promise((resolve) => {
        streamSocketServer.close(() => resolve());
    });
    await new Promise((resolve) => {
        streamServer.close(() => resolve());
    });
    await flushBatch();
}
process.on('SIGINT', () => {
    void shutdown('SIGINT').finally(() => process.exit(0));
});
process.on('SIGTERM', () => {
    void shutdown('SIGTERM').finally(() => process.exit(0));
});
startMyBoatStreamServer();
connect();
