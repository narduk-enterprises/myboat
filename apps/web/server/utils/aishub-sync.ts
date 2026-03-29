/// <reference types="@cloudflare/workers-types" />
import {
  AISHUB_ROLLING_SYNC_LOOKBACK_MINUTES,
  parseAisHubApiSnapshotResponse,
  type AisHubApiVesselRecord,
} from '../../shared/aishub'

const AISHUB_API_URL = 'https://data.aishub.net/ws.php'
const AISHUB_GLOBAL_REQUEST_ID = 'global'
const AISHUB_SYNC_STATE_ID = 'catalog'
const AISHUB_SYNC_BATCH_SIZE = 25

export const AISHUB_ROLLING_SYNC_CRON = '*/30 * * * *'

export interface AisHubSyncResult {
  mode: 'rolling'
  lookbackMinutes: number
  fetchedAt: string
  recordCount: number
  batchCount: number
  skipped: boolean
  reason: 'success' | 'cooldown' | 'missing_api_key'
}

export interface AisHubSyncStatus {
  catalogSize: number
  lastRequestAt: string | null
  sync: {
    lastStartedAt: string | null
    lastCompletedAt: string | null
    lastSuccessAt: string | null
    lastStatus: string
    lastMode: string | null
    lastLookbackMinutes: number | null
    lastRecordCount: number | null
    lastBatchCount: number | null
    lastError: string | null
    updatedAt: string | null
  }
}

interface SyncStatePatch {
  lastStartedAt?: string | null
  lastCompletedAt?: string | null
  lastSuccessAt?: string | null
  lastStatus: string
  lastMode?: string | null
  lastLookbackMinutes?: number | null
  lastRecordCount?: number | null
  lastBatchCount?: number | null
  lastError?: string | null
}

function logAisHubSync(
  level: 'info' | 'warn' | 'error',
  message: string,
  data?: Record<string, unknown>,
) {
  const payload = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    scope: 'aishub-sync',
    message,
    ...(data ? { data } : {}),
  })

  if (level === 'error') {
    console.error(payload)
    return
  }

  if (level === 'warn') {
    console.warn(payload)
    return
  }

  console.info(payload)
}

function escapeSqlText(value: string) {
  return `'${value.replaceAll("'", "''")}'`
}

function sqlText(value: string | null) {
  return value === null ? 'NULL' : escapeSqlText(value)
}

function sqlNumber(value: number | null) {
  return value === null || !Number.isFinite(value) ? 'NULL' : String(value)
}

function buildSearchDocument(record: AisHubApiVesselRecord) {
  return [record.mmsi, record.imo, record.name, record.callSign, record.destination]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ')
    .toLowerCase()
}

function chunkRecords<T>(records: T[], size: number) {
  const chunks: T[][] = []

  for (let index = 0; index < records.length; index += size) {
    chunks.push(records.slice(index, index + size))
  }

  return chunks
}

function buildValueTuple(record: AisHubApiVesselRecord, fetchedAt: string) {
  return `(${[
    sqlText(record.mmsi),
    sqlText(record.imo),
    sqlText(record.name),
    sqlText(record.callSign),
    sqlText(record.destination),
    sqlText(record.lastReportAt),
    sqlNumber(record.positionLat),
    sqlNumber(record.positionLng),
    sqlNumber(record.shipType),
    sqlNumber(record.courseOverGround),
    sqlNumber(record.speedOverGround),
    sqlNumber(record.heading),
    sqlNumber(record.rateOfTurn),
    sqlNumber(record.navStatus),
    sqlNumber(record.dimensionBow),
    sqlNumber(record.dimensionStern),
    sqlNumber(record.dimensionPort),
    sqlNumber(record.dimensionStarboard),
    sqlNumber(record.draughtMeters),
    sqlText(record.etaRaw),
    sqlText('[]'),
    sqlText(buildSearchDocument(record)),
    sqlText(fetchedAt),
    sqlText(fetchedAt),
    sqlText(fetchedAt),
  ].join(', ')})`
}

function buildUpsertStatement(records: AisHubApiVesselRecord[], fetchedAt: string) {
  const values = records.map((record) => buildValueTuple(record, fetchedAt)).join(',\n')

  return `
    INSERT INTO \`aishub_vessels\` (
      \`mmsi\`,
      \`imo\`,
      \`name\`,
      \`call_sign\`,
      \`destination\`,
      \`last_report_at\`,
      \`position_lat\`,
      \`position_lng\`,
      \`ship_type\`,
      \`course_over_ground\`,
      \`speed_over_ground\`,
      \`heading\`,
      \`rate_of_turn\`,
      \`nav_status\`,
      \`dimension_bow\`,
      \`dimension_stern\`,
      \`dimension_port\`,
      \`dimension_starboard\`,
      \`draught_meters\`,
      \`eta_raw\`,
      \`source_stations_json\`,
      \`search_document\`,
      \`first_seen_at\`,
      \`last_fetched_at\`,
      \`updated_at\`
    ) VALUES
    ${values}
    ON CONFLICT(\`mmsi\`) DO UPDATE SET
      \`imo\` = excluded.\`imo\`,
      \`name\` = excluded.\`name\`,
      \`call_sign\` = excluded.\`call_sign\`,
      \`destination\` = excluded.\`destination\`,
      \`last_report_at\` = excluded.\`last_report_at\`,
      \`position_lat\` = excluded.\`position_lat\`,
      \`position_lng\` = excluded.\`position_lng\`,
      \`ship_type\` = excluded.\`ship_type\`,
      \`course_over_ground\` = excluded.\`course_over_ground\`,
      \`speed_over_ground\` = excluded.\`speed_over_ground\`,
      \`heading\` = excluded.\`heading\`,
      \`rate_of_turn\` = excluded.\`rate_of_turn\`,
      \`nav_status\` = excluded.\`nav_status\`,
      \`dimension_bow\` = excluded.\`dimension_bow\`,
      \`dimension_stern\` = excluded.\`dimension_stern\`,
      \`dimension_port\` = excluded.\`dimension_port\`,
      \`dimension_starboard\` = excluded.\`dimension_starboard\`,
      \`draught_meters\` = excluded.\`draught_meters\`,
      \`eta_raw\` = excluded.\`eta_raw\`,
      \`source_stations_json\` = excluded.\`source_stations_json\`,
      \`search_document\` = excluded.\`search_document\`,
      \`last_fetched_at\` = excluded.\`last_fetched_at\`,
      \`updated_at\` = excluded.\`updated_at\`
    WHERE \`aishub_vessels\`.\`last_report_at\` IS NULL
      OR excluded.\`last_report_at\` IS NULL
      OR excluded.\`last_report_at\` >= \`aishub_vessels\`.\`last_report_at\`
  `
}

async function getTrackedFollowedMmsis(d1: D1Database) {
  const result = await d1
    .prepare('SELECT DISTINCT `mmsi` AS mmsi FROM `followed_vessels`')
    .all<{ mmsi?: string | null }>()

  return new Set(
    (result.results || [])
      .map((row) => row.mmsi?.trim() || '')
      .filter((mmsi): mmsi is string => Boolean(mmsi)),
  )
}

function buildFollowedVesselRefreshStatement(mmsis: string[], refreshedAt: string) {
  const placeholders = mmsis.map(() => '?').join(', ')

  return {
    statement: `
    UPDATE \`followed_vessels\`
    SET
      \`source\` = 'aishub',
      \`imo\` = (
        SELECT \`imo\` FROM \`aishub_vessels\`
        WHERE \`aishub_vessels\`.\`mmsi\` = \`followed_vessels\`.\`mmsi\`
      ),
      \`name\` = (
        SELECT \`name\` FROM \`aishub_vessels\`
        WHERE \`aishub_vessels\`.\`mmsi\` = \`followed_vessels\`.\`mmsi\`
      ),
      \`call_sign\` = (
        SELECT \`call_sign\` FROM \`aishub_vessels\`
        WHERE \`aishub_vessels\`.\`mmsi\` = \`followed_vessels\`.\`mmsi\`
      ),
      \`destination\` = (
        SELECT \`destination\` FROM \`aishub_vessels\`
        WHERE \`aishub_vessels\`.\`mmsi\` = \`followed_vessels\`.\`mmsi\`
      ),
      \`last_report_at\` = (
        SELECT \`last_report_at\` FROM \`aishub_vessels\`
        WHERE \`aishub_vessels\`.\`mmsi\` = \`followed_vessels\`.\`mmsi\`
      ),
      \`position_lat\` = (
        SELECT \`position_lat\` FROM \`aishub_vessels\`
        WHERE \`aishub_vessels\`.\`mmsi\` = \`followed_vessels\`.\`mmsi\`
      ),
      \`position_lng\` = (
        SELECT \`position_lng\` FROM \`aishub_vessels\`
        WHERE \`aishub_vessels\`.\`mmsi\` = \`followed_vessels\`.\`mmsi\`
      ),
      \`ship_type\` = (
        SELECT \`ship_type\` FROM \`aishub_vessels\`
        WHERE \`aishub_vessels\`.\`mmsi\` = \`followed_vessels\`.\`mmsi\`
      ),
      \`source_stations_json\` = (
        SELECT \`source_stations_json\` FROM \`aishub_vessels\`
        WHERE \`aishub_vessels\`.\`mmsi\` = \`followed_vessels\`.\`mmsi\`
      ),
      \`updated_at\` = ?
    WHERE \`mmsi\` IN (${placeholders})
      AND EXISTS (
        SELECT 1 FROM \`aishub_vessels\`
        WHERE \`aishub_vessels\`.\`mmsi\` = \`followed_vessels\`.\`mmsi\`
      )
  `,
    bindings: [refreshedAt, ...mmsis] as Array<string>,
  }
}

async function refreshTrackedFollowedVesselsFromAisHub(
  d1: D1Database,
  records: AisHubApiVesselRecord[],
  refreshedAt: string,
) {
  const trackedMmsis = await getTrackedFollowedMmsis(d1)
  const matchingMmsis = [...new Set(records.map((record) => record.mmsi))].filter((mmsi) =>
    trackedMmsis.has(mmsi),
  )

  if (!matchingMmsis.length) {
    return 0
  }

  const batches = chunkRecords(matchingMmsis, 100)

  for (const batch of batches) {
    const refreshQuery = buildFollowedVesselRefreshStatement(batch, refreshedAt)
    await d1
      .prepare(refreshQuery.statement)
      .bind(...refreshQuery.bindings)
      .run()
  }

  return matchingMmsis.length
}

async function updateSyncState(d1: D1Database, patch: SyncStatePatch) {
  const updatedAt = new Date().toISOString()

  await d1
    .prepare(
      `
        INSERT INTO \`aishub_sync_state\` (
          \`id\`,
          \`last_started_at\`,
          \`last_completed_at\`,
          \`last_success_at\`,
          \`last_status\`,
          \`last_mode\`,
          \`last_lookback_minutes\`,
          \`last_record_count\`,
          \`last_batch_count\`,
          \`last_error\`,
          \`updated_at\`
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(\`id\`) DO UPDATE SET
          \`last_started_at\` = COALESCE(excluded.\`last_started_at\`, \`aishub_sync_state\`.\`last_started_at\`),
          \`last_completed_at\` = COALESCE(excluded.\`last_completed_at\`, \`aishub_sync_state\`.\`last_completed_at\`),
          \`last_success_at\` = COALESCE(excluded.\`last_success_at\`, \`aishub_sync_state\`.\`last_success_at\`),
          \`last_status\` = excluded.\`last_status\`,
          \`last_mode\` = COALESCE(excluded.\`last_mode\`, \`aishub_sync_state\`.\`last_mode\`),
          \`last_lookback_minutes\` = COALESCE(excluded.\`last_lookback_minutes\`, \`aishub_sync_state\`.\`last_lookback_minutes\`),
          \`last_record_count\` = excluded.\`last_record_count\`,
          \`last_batch_count\` = excluded.\`last_batch_count\`,
          \`last_error\` = excluded.\`last_error\`,
          \`updated_at\` = excluded.\`updated_at\`
      `,
    )
    .bind(
      AISHUB_SYNC_STATE_ID,
      patch.lastStartedAt ?? null,
      patch.lastCompletedAt ?? null,
      patch.lastSuccessAt ?? null,
      patch.lastStatus,
      patch.lastMode ?? null,
      patch.lastLookbackMinutes ?? null,
      patch.lastRecordCount ?? null,
      patch.lastBatchCount ?? null,
      patch.lastError ?? null,
      updatedAt,
    )
    .run()
}

async function getCooldownRemainingMs(d1: D1Database) {
  const row = await getLastRequestState(d1)

  const lastRequestAt = row?.lastRequestAt
  if (!lastRequestAt) {
    return 0
  }

  const lastRequestMs = Date.parse(lastRequestAt)
  if (!Number.isFinite(lastRequestMs)) {
    return 0
  }

  return Math.max(0, 60_000 - (Date.now() - lastRequestMs))
}

async function getLastRequestState(d1: D1Database) {
  return await d1
    .prepare('SELECT `last_request_at` AS lastRequestAt FROM `aishub_request_state` WHERE `id` = ?')
    .bind(AISHUB_GLOBAL_REQUEST_ID)
    .first<{ lastRequestAt?: string | null }>()
}

async function recordAisHubRequest(d1: D1Database, requestedAt: string) {
  await d1
    .prepare(
      `
        INSERT INTO \`aishub_request_state\` (\`id\`, \`last_request_at\`, \`updated_at\`)
        VALUES (?, ?, ?)
        ON CONFLICT(\`id\`) DO UPDATE SET
          \`last_request_at\` = excluded.\`last_request_at\`,
          \`updated_at\` = excluded.\`updated_at\`
      `,
    )
    .bind(AISHUB_GLOBAL_REQUEST_ID, requestedAt, requestedAt)
    .run()
}

async function fetchRollingSnapshot(apiKey: string, lookbackMinutes: number) {
  const url = new URL(AISHUB_API_URL)
  url.searchParams.set('username', apiKey)
  url.searchParams.set('format', '1')
  url.searchParams.set('output', 'json')
  url.searchParams.set('compress', '0')
  url.searchParams.set('interval', String(lookbackMinutes))

  const response = await fetch(url.toString(), {
    headers: {
      accept: 'application/json, text/plain;q=0.9, */*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`AIS Hub sync failed with HTTP ${response.status}.`)
  }

  const payload = await response.text()
  if (!payload.trim()) {
    return [] as AisHubApiVesselRecord[]
  }

  return parseAisHubApiSnapshotResponse(payload)
}

export async function getAisHubSyncStatus(d1: D1Database): Promise<AisHubSyncStatus> {
  const [syncRow, countRow, requestRow] = await Promise.all([
    d1
      .prepare(
        `
          SELECT
            \`last_started_at\` AS lastStartedAt,
            \`last_completed_at\` AS lastCompletedAt,
            \`last_success_at\` AS lastSuccessAt,
            \`last_status\` AS lastStatus,
            \`last_mode\` AS lastMode,
            \`last_lookback_minutes\` AS lastLookbackMinutes,
            \`last_record_count\` AS lastRecordCount,
            \`last_batch_count\` AS lastBatchCount,
            \`last_error\` AS lastError,
            \`updated_at\` AS updatedAt
          FROM \`aishub_sync_state\`
          WHERE \`id\` = ?
        `,
      )
      .bind(AISHUB_SYNC_STATE_ID)
      .first<{
        lastStartedAt?: string | null
        lastCompletedAt?: string | null
        lastSuccessAt?: string | null
        lastStatus?: string | null
        lastMode?: string | null
        lastLookbackMinutes?: number | null
        lastRecordCount?: number | null
        lastBatchCount?: number | null
        lastError?: string | null
        updatedAt?: string | null
      }>(),
    d1
      .prepare('SELECT COUNT(*) AS catalogSize FROM `aishub_vessels`')
      .first<{ catalogSize?: number }>(),
    getLastRequestState(d1),
  ])

  return {
    catalogSize: countRow?.catalogSize ?? 0,
    lastRequestAt: requestRow?.lastRequestAt ?? null,
    sync: {
      lastStartedAt: syncRow?.lastStartedAt ?? null,
      lastCompletedAt: syncRow?.lastCompletedAt ?? null,
      lastSuccessAt: syncRow?.lastSuccessAt ?? null,
      lastStatus: syncRow?.lastStatus ?? 'idle',
      lastMode: syncRow?.lastMode ?? null,
      lastLookbackMinutes: syncRow?.lastLookbackMinutes ?? null,
      lastRecordCount: syncRow?.lastRecordCount ?? null,
      lastBatchCount: syncRow?.lastBatchCount ?? null,
      lastError: syncRow?.lastError ?? null,
      updatedAt: syncRow?.updatedAt ?? null,
    },
  }
}

async function upsertSnapshotRecords(
  d1: D1Database,
  records: AisHubApiVesselRecord[],
  fetchedAt: string,
) {
  const batches = chunkRecords(records, AISHUB_SYNC_BATCH_SIZE)

  for (const batch of batches) {
    await d1.batch([d1.prepare(buildUpsertStatement(batch, fetchedAt))])
  }

  return batches.length
}

export async function runAisHubRollingSync(
  d1: D1Database,
  apiKey: string | null | undefined,
): Promise<AisHubSyncResult> {
  const fetchedAt = new Date().toISOString()

  if (!apiKey?.trim()) {
    await updateSyncState(d1, {
      lastCompletedAt: fetchedAt,
      lastStatus: 'skipped',
      lastMode: 'rolling',
      lastLookbackMinutes: AISHUB_ROLLING_SYNC_LOOKBACK_MINUTES,
      lastRecordCount: 0,
      lastBatchCount: 0,
      lastError: 'AIS_HUB_KEY is not configured.',
    })

    return {
      mode: 'rolling',
      lookbackMinutes: AISHUB_ROLLING_SYNC_LOOKBACK_MINUTES,
      fetchedAt,
      recordCount: 0,
      batchCount: 0,
      skipped: true,
      reason: 'missing_api_key',
    }
  }

  await updateSyncState(d1, {
    lastStartedAt: fetchedAt,
    lastStatus: 'running',
    lastMode: 'rolling',
    lastLookbackMinutes: AISHUB_ROLLING_SYNC_LOOKBACK_MINUTES,
    lastRecordCount: null,
    lastBatchCount: null,
    lastError: null,
  })

  const cooldownRemainingMs = await getCooldownRemainingMs(d1)
  if (cooldownRemainingMs > 0) {
    await updateSyncState(d1, {
      lastCompletedAt: fetchedAt,
      lastStatus: 'skipped',
      lastMode: 'rolling',
      lastLookbackMinutes: AISHUB_ROLLING_SYNC_LOOKBACK_MINUTES,
      lastRecordCount: 0,
      lastBatchCount: 0,
      lastError: `AIS Hub cooldown active for ${cooldownRemainingMs}ms.`,
    })

    logAisHubSync('warn', 'Skipped rolling sync because the upstream cooldown is still active.', {
      cooldownRemainingMs,
    })

    return {
      mode: 'rolling',
      lookbackMinutes: AISHUB_ROLLING_SYNC_LOOKBACK_MINUTES,
      fetchedAt,
      recordCount: 0,
      batchCount: 0,
      skipped: true,
      reason: 'cooldown',
    }
  }

  try {
    const records = await fetchRollingSnapshot(apiKey.trim(), AISHUB_ROLLING_SYNC_LOOKBACK_MINUTES)
    await recordAisHubRequest(d1, fetchedAt)
    const batchCount = await upsertSnapshotRecords(d1, records, fetchedAt)
    const refreshedFollowedCount = await refreshTrackedFollowedVesselsFromAisHub(
      d1,
      records,
      fetchedAt,
    )

    await updateSyncState(d1, {
      lastCompletedAt: fetchedAt,
      lastSuccessAt: fetchedAt,
      lastStatus: 'success',
      lastMode: 'rolling',
      lastLookbackMinutes: AISHUB_ROLLING_SYNC_LOOKBACK_MINUTES,
      lastRecordCount: records.length,
      lastBatchCount: batchCount,
      lastError: null,
    })

    logAisHubSync('info', 'Completed AIS Hub rolling sync.', {
      fetchedAt,
      lookbackMinutes: AISHUB_ROLLING_SYNC_LOOKBACK_MINUTES,
      recordCount: records.length,
      batchCount,
      refreshedFollowedCount,
    })

    return {
      mode: 'rolling',
      lookbackMinutes: AISHUB_ROLLING_SYNC_LOOKBACK_MINUTES,
      fetchedAt,
      recordCount: records.length,
      batchCount,
      skipped: false,
      reason: 'success',
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    await updateSyncState(d1, {
      lastCompletedAt: new Date().toISOString(),
      lastStatus: 'error',
      lastMode: 'rolling',
      lastLookbackMinutes: AISHUB_ROLLING_SYNC_LOOKBACK_MINUTES,
      lastRecordCount: null,
      lastBatchCount: null,
      lastError: message,
    })

    logAisHubSync('error', 'AIS Hub rolling sync failed.', {
      fetchedAt,
      lookbackMinutes: AISHUB_ROLLING_SYNC_LOOKBACK_MINUTES,
      error: message,
    })

    throw error
  }
}
