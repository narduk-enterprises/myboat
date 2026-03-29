import type { H3Event } from 'h3'
import { desc, eq, inArray, like } from 'drizzle-orm'
import type { AisHubSearchResponse, AisHubSearchResult } from '~/types/myboat'
import {
  AISHUB_SEARCH_COOLDOWN_MS,
  normalizeAisHubSearchQuery,
  parseAisHubApiSearchResponse,
  parseAisHubVesselsHtml,
} from '../../shared/aishub'
import { aishubRequestState, aishubSearchCache, aishubVessels } from '#server/database/app-schema'
import { useAppDatabase } from '#server/utils/database'
import { syncFollowedVesselsFromAisHubForMmsis } from '#server/utils/myboat'

const AISHUB_API_URL = 'https://data.aishub.net/ws.php'
const AISHUB_VESSELS_URL = 'https://www.aishub.net/vessels'
const AISHUB_GLOBAL_REQUEST_ID = 'global'
const AISHUB_SEARCH_CACHE_TTL_MS = 10 * 60_000
const AISHUB_LOCAL_SEARCH_LIMIT = 24
const AISHUB_RESULT_LIMIT = 12
const AISHUB_STORED_LOOKUP_BATCH_SIZE = 200

type AisHubSearchMode = AisHubSearchResult['matchMode']

function buildCacheKey(matchMode: AisHubSearchMode, query: string) {
  return `${matchMode}:${query.toLowerCase()}`
}

function normalizeStoredSearchQuery(value: string) {
  return value.trim().toLowerCase().replaceAll(/\s+/g, ' ')
}

function parseSourceStations(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : []
  } catch {
    return []
  }
}

function buildSearchDocument(
  result: Pick<
    AisHubSearchResult,
    'mmsi' | 'imo' | 'name' | 'callSign' | 'destination' | 'sourceStations'
  >,
) {
  return [
    result.mmsi,
    result.imo,
    result.name,
    result.callSign,
    result.destination,
    ...result.sourceStations,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ')
    .toLowerCase()
}

function inferLocalMatchMode(result: Pick<AisHubSearchResult, 'mmsi'>, normalizedQuery: string) {
  const compactDigits = normalizedQuery.replaceAll(/\s+/g, '')
  return compactDigits === result.mmsi ? 'mmsi' : 'name'
}

function scoreLocalResult(
  result: Pick<AisHubSearchResult, 'mmsi' | 'imo' | 'name' | 'callSign' | 'destination'> & {
    sourceStations: string[]
  },
  normalizedQuery: string,
) {
  const compactDigits = normalizedQuery.replaceAll(/\s+/g, '')
  const name = result.name.toLowerCase()
  const callSign = result.callSign?.toLowerCase() || ''
  const imo = result.imo?.toLowerCase() || ''
  const destination = result.destination?.toLowerCase() || ''
  const stations = result.sourceStations.join(' ').toLowerCase()

  if (compactDigits && result.mmsi === compactDigits) return 120
  if (imo && imo === normalizedQuery) return 110
  if (name === normalizedQuery) return 105
  if (callSign && callSign === normalizedQuery) return 100
  if (destination && destination === normalizedQuery) return 95
  if (compactDigits && result.mmsi.startsWith(compactDigits)) return 92
  if (imo && imo.startsWith(normalizedQuery)) return 88
  if (name.startsWith(normalizedQuery)) return 85
  if (callSign && callSign.startsWith(normalizedQuery)) return 82
  if (destination && destination.startsWith(normalizedQuery)) return 80
  if (stations && stations.includes(normalizedQuery)) return 76
  if (name.includes(normalizedQuery)) return 72
  if (callSign && callSign.includes(normalizedQuery)) return 69
  if (destination && destination.includes(normalizedQuery)) return 66
  if (imo && imo.includes(normalizedQuery)) return 64
  if (compactDigits && result.mmsi.includes(compactDigits)) return 62

  return 0
}

function canQueryUpstream(matchMode: AisHubSearchMode, normalizedQuery: string) {
  return matchMode === 'mmsi' ? /^\d{9}$/.test(normalizedQuery) : normalizedQuery.length >= 3
}

function serializeStoredResult(
  row: {
    mmsi: string
    imo: string | null
    name: string
    callSign: string | null
    destination: string | null
    lastReportAt: string | null
    positionLat: number | null
    positionLng: number | null
    shipType: number | null
    sourceStationsJson: string
  },
  normalizedQuery: string,
): AisHubSearchResult {
  const sourceStations = parseSourceStations(row.sourceStationsJson)

  return {
    source: 'aishub',
    matchMode: inferLocalMatchMode(row, normalizedQuery),
    mmsi: row.mmsi,
    imo: row.imo,
    name: row.name,
    callSign: row.callSign,
    destination: row.destination,
    lastReportAt: row.lastReportAt,
    positionLat: row.positionLat,
    positionLng: row.positionLng,
    shipType: row.shipType,
    sourceStations,
  }
}

export async function rememberAisHubResults(
  event: H3Event,
  results: AisHubSearchResult[],
  fetchedAt: string,
) {
  if (!results.length) {
    return
  }

  const db = useAppDatabase(event)

  for (const result of results) {
    await db
      .insert(aishubVessels)
      .values({
        mmsi: result.mmsi,
        imo: result.imo,
        name: result.name,
        callSign: result.callSign,
        destination: result.destination,
        lastReportAt: result.lastReportAt,
        positionLat: result.positionLat,
        positionLng: result.positionLng,
        shipType: result.shipType,
        sourceStationsJson: JSON.stringify(result.sourceStations),
        searchDocument: buildSearchDocument(result),
        firstSeenAt: fetchedAt,
        lastFetchedAt: fetchedAt,
        updatedAt: fetchedAt,
      })
      .onConflictDoUpdate({
        target: aishubVessels.mmsi,
        set: {
          imo: result.imo,
          name: result.name,
          callSign: result.callSign,
          destination: result.destination,
          lastReportAt: result.lastReportAt,
          positionLat: result.positionLat,
          positionLng: result.positionLng,
          shipType: result.shipType,
          sourceStationsJson: JSON.stringify(result.sourceStations),
          searchDocument: buildSearchDocument(result),
          lastFetchedAt: fetchedAt,
          updatedAt: fetchedAt,
        },
      })
  }

  await syncFollowedVesselsFromAisHubForMmsis(
    event,
    results.map((result) => result.mmsi),
    fetchedAt,
  )
}

export async function getStoredAisHubResultsByMmsis(event: H3Event, mmsis: string[]) {
  const batches = splitStoredAisHubMmsiBatches(mmsis)
  if (!batches.length) {
    return new Map<string, AisHubSearchResult>()
  }

  const db = useAppDatabase(event)
  const rows = []

  for (const batch of batches) {
    const batchRows = await db
      .select({
        mmsi: aishubVessels.mmsi,
        imo: aishubVessels.imo,
        name: aishubVessels.name,
        callSign: aishubVessels.callSign,
        destination: aishubVessels.destination,
        lastReportAt: aishubVessels.lastReportAt,
        positionLat: aishubVessels.positionLat,
        positionLng: aishubVessels.positionLng,
        shipType: aishubVessels.shipType,
        sourceStationsJson: aishubVessels.sourceStationsJson,
      })
      .from(aishubVessels)
      .where(inArray(aishubVessels.mmsi, batch))
      .all()

    rows.push(...batchRows)
  }

  return new Map(rows.map((row) => [row.mmsi, serializeStoredResult(row, row.mmsi)]))
}

function normalizeRequestedMmsis(mmsis: string[]) {
  return [
    ...new Set(
      mmsis.map((mmsi) => mmsi.trim()).filter((mmsi): mmsi is string => /^\d{9}$/.test(mmsi)),
    ),
  ]
}

export function splitStoredAisHubMmsiBatches(mmsis: string[]) {
  const uniqueMmsis = [...new Set(mmsis.map((mmsi) => mmsi.trim()).filter(Boolean))]
  const batches: string[][] = []

  for (let index = 0; index < uniqueMmsis.length; index += AISHUB_STORED_LOOKUP_BATCH_SIZE) {
    batches.push(uniqueMmsis.slice(index, index + AISHUB_STORED_LOOKUP_BATCH_SIZE))
  }

  return batches
}

async function searchStoredAisHubVessels(event: H3Event, rawQuery: string) {
  const normalizedQuery = normalizeStoredSearchQuery(rawQuery)
  if (!normalizedQuery) {
    return {
      cachedAt: null,
      results: [] as AisHubSearchResult[],
    }
  }

  const db = useAppDatabase(event)
  const rows = await db
    .select({
      mmsi: aishubVessels.mmsi,
      imo: aishubVessels.imo,
      name: aishubVessels.name,
      callSign: aishubVessels.callSign,
      destination: aishubVessels.destination,
      lastReportAt: aishubVessels.lastReportAt,
      positionLat: aishubVessels.positionLat,
      positionLng: aishubVessels.positionLng,
      shipType: aishubVessels.shipType,
      sourceStationsJson: aishubVessels.sourceStationsJson,
      lastFetchedAt: aishubVessels.lastFetchedAt,
    })
    .from(aishubVessels)
    .where(like(aishubVessels.searchDocument, `%${normalizedQuery}%`))
    .orderBy(desc(aishubVessels.lastFetchedAt))
    .limit(AISHUB_LOCAL_SEARCH_LIMIT)
    .all()

  const results = rows
    .map((row) => ({
      lastFetchedAt: row.lastFetchedAt,
      result: serializeStoredResult(row, normalizedQuery),
    }))
    .sort((left, right) => {
      const scoreDelta =
        scoreLocalResult(right.result, normalizedQuery) -
        scoreLocalResult(left.result, normalizedQuery)
      if (scoreDelta !== 0) {
        return scoreDelta
      }

      return new Date(right.lastFetchedAt).getTime() - new Date(left.lastFetchedAt).getTime()
    })
    .slice(0, AISHUB_RESULT_LIMIT)

  return {
    cachedAt: results[0]?.lastFetchedAt || null,
    results: results.map((item) => item.result),
  }
}

async function getCachedSearch(
  event: H3Event,
  matchMode: AisHubSearchMode,
  query: string,
  rawQuery: string,
): Promise<AisHubSearchResponse | null> {
  const db = useAppDatabase(event)
  const cacheKey = buildCacheKey(matchMode, query)
  const row = await db
    .select({
      matchMode: aishubSearchCache.matchMode,
      responseJson: aishubSearchCache.responseJson,
      cachedAt: aishubSearchCache.cachedAt,
      expiresAt: aishubSearchCache.expiresAt,
    })
    .from(aishubSearchCache)
    .where(eq(aishubSearchCache.queryKey, cacheKey))
    .get()

  if (!row) {
    return null
  }

  const expiresAtMs = Date.parse(row.expiresAt)
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    return null
  }

  try {
    const results = JSON.parse(row.responseJson) as AisHubSearchResult[]
    await rememberAisHubResults(event, results, row.cachedAt)

    return {
      query: rawQuery,
      matchMode,
      source: 'cache',
      cachedAt: row.cachedAt,
      results,
    }
  } catch {
    return null
  }
}

async function setCachedSearch(event: H3Event, response: Omit<AisHubSearchResponse, 'source'>) {
  const db = useAppDatabase(event)
  const now = new Date()
  const expiresAt = new Date(now.getTime() + AISHUB_SEARCH_CACHE_TTL_MS).toISOString()
  const queryKey = buildCacheKey(response.matchMode, response.query)

  await db
    .insert(aishubSearchCache)
    .values({
      queryKey,
      matchMode: response.matchMode,
      responseJson: JSON.stringify(response.results),
      cachedAt: response.cachedAt || now.toISOString(),
      expiresAt,
    })
    .onConflictDoUpdate({
      target: aishubSearchCache.queryKey,
      set: {
        matchMode: response.matchMode,
        responseJson: JSON.stringify(response.results),
        cachedAt: response.cachedAt || now.toISOString(),
        expiresAt,
      },
    })
}

async function getAisHubCooldownRemainingMs(event: H3Event) {
  const db = useAppDatabase(event)
  const row = await db
    .select({ lastRequestAt: aishubRequestState.lastRequestAt })
    .from(aishubRequestState)
    .where(eq(aishubRequestState.id, AISHUB_GLOBAL_REQUEST_ID))
    .get()

  if (!row) {
    return 0
  }

  const lastRequestMs = Date.parse(row.lastRequestAt)
  if (!Number.isFinite(lastRequestMs)) {
    return 0
  }

  const remainingMs = AISHUB_SEARCH_COOLDOWN_MS - (Date.now() - lastRequestMs)
  return remainingMs > 0 ? remainingMs : 0
}

function throwAisHubCooldownError(event: H3Event, remainingMs: number) {
  setResponseHeader(event, 'Retry-After', Math.ceil(remainingMs / 1000))
  throw createError({
    statusCode: 429,
    statusMessage: `AIS Hub only allows one upstream lookup per minute. Try again in ${Math.ceil(remainingMs / 1000)}s.`,
    data: { retryAfterMs: remainingMs },
  })
}

async function assertAisHubCooldownAvailable(event: H3Event) {
  const remainingMs = await getAisHubCooldownRemainingMs(event)
  if (remainingMs > 0) {
    throwAisHubCooldownError(event, remainingMs)
  }
}

async function recordAisHubRequest(event: H3Event, requestedAt: string) {
  const db = useAppDatabase(event)

  await db
    .insert(aishubRequestState)
    .values({
      id: AISHUB_GLOBAL_REQUEST_ID,
      lastRequestAt: requestedAt,
      updatedAt: requestedAt,
    })
    .onConflictDoUpdate({
      target: aishubRequestState.id,
      set: {
        lastRequestAt: requestedAt,
        updatedAt: requestedAt,
      },
    })
}

async function fetchAisHubApiByMmsis(mmsis: string[], intervalMinutes?: number | null) {
  const apiKey = useRuntimeConfig().aisHubKey?.trim() || ''
  const normalizedMmsis = normalizeRequestedMmsis(mmsis)
  if (!apiKey || !normalizedMmsis.length) {
    return null
  }

  const url = new URL(AISHUB_API_URL)
  url.searchParams.set('username', apiKey)
  url.searchParams.set('format', '1')
  url.searchParams.set('output', 'json')
  url.searchParams.set('compress', '0')
  url.searchParams.set('mmsi', normalizedMmsis.join(','))

  if (
    typeof intervalMinutes === 'number' &&
    Number.isFinite(intervalMinutes) &&
    intervalMinutes > 0
  ) {
    url.searchParams.set('interval', String(Math.trunc(intervalMinutes)))
  }

  const response = await fetch(url.toString(), {
    headers: {
      accept: 'application/json, text/plain;q=0.9, */*;q=0.8',
    },
  })

  if (!response.ok) {
    throw createError({
      statusCode: 502,
      statusMessage: 'AIS Hub lookup failed.',
    })
  }

  const payload = await response.text()
  if (!payload.trim()) {
    return []
  }

  return parseAisHubApiSearchResponse(payload)
}

async function fetchAisHubApiByMmsi(mmsi: string) {
  return await fetchAisHubApiByMmsis([mmsi])
}

export async function refreshAisHubResultsByMmsis(
  event: H3Event,
  mmsis: string[],
  options: {
    bestEffort?: boolean
    intervalMinutes?: number | null
  } = {},
) {
  const uniqueMmsis = normalizeRequestedMmsis(mmsis)
  if (!uniqueMmsis.length) {
    return {
      cachedAt: null,
      missingMmsis: [] as string[],
      results: [] as AisHubSearchResult[],
      retryAfterMs: null as number | null,
      source: 'local' as const,
    }
  }

  const storedResults = await getStoredAisHubResultsByMmsis(event, uniqueMmsis)
  const cooldownRemainingMs = await getAisHubCooldownRemainingMs(event)

  if (cooldownRemainingMs > 0) {
    if (!options.bestEffort) {
      throwAisHubCooldownError(event, cooldownRemainingMs)
    }

    return {
      cachedAt: null,
      missingMmsis: uniqueMmsis.filter((mmsi) => !storedResults.has(mmsi)),
      results: uniqueMmsis
        .map((mmsi) => storedResults.get(mmsi))
        .filter((result): result is AisHubSearchResult => Boolean(result)),
      retryAfterMs: cooldownRemainingMs,
      source: 'cooldown' as const,
    }
  }

  const fetchedAt = new Date().toISOString()
  const upstreamResults = await fetchAisHubApiByMmsis(uniqueMmsis, options.intervalMinutes)

  if (!upstreamResults) {
    return {
      cachedAt: null,
      missingMmsis: uniqueMmsis.filter((mmsi) => !storedResults.has(mmsi)),
      results: uniqueMmsis
        .map((mmsi) => storedResults.get(mmsi))
        .filter((result): result is AisHubSearchResult => Boolean(result)),
      retryAfterMs: null,
      source: 'local' as const,
    }
  }

  await recordAisHubRequest(event, fetchedAt)

  if (upstreamResults.length) {
    await rememberAisHubResults(event, upstreamResults, fetchedAt)
  }

  const upstreamResultsByMmsi = new Map(upstreamResults.map((result) => [result.mmsi, result]))

  return {
    cachedAt: fetchedAt,
    missingMmsis: uniqueMmsis.filter(
      (mmsi) => !upstreamResultsByMmsi.has(mmsi) && !storedResults.has(mmsi),
    ),
    results: uniqueMmsis
      .map((mmsi) => upstreamResultsByMmsi.get(mmsi) || storedResults.get(mmsi))
      .filter((result): result is AisHubSearchResult => Boolean(result)),
    retryAfterMs: null,
    source: 'upstream' as const,
  }
}

async function fetchAisHubVesselsPage(query: string, matchMode: AisHubSearchMode) {
  const url = new URL(AISHUB_VESSELS_URL)
  url.searchParams.set(matchMode === 'mmsi' ? 'Ship[mmsi]' : 'Ship[name]', query)

  const response = await fetch(url.toString(), {
    headers: {
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw createError({
      statusCode: 502,
      statusMessage: 'AIS Hub vessel search failed.',
    })
  }

  return parseAisHubVesselsHtml(await response.text(), matchMode)
}

export async function searchAisHubVessels(
  event: H3Event,
  rawQuery: string,
): Promise<AisHubSearchResponse> {
  const trimmedQuery = rawQuery.trim().replaceAll(/\s+/g, ' ')
  const { matchMode, normalizedQuery } = normalizeAisHubSearchQuery(trimmedQuery)

  const local = await searchStoredAisHubVessels(event, trimmedQuery)
  if (local.results.length) {
    return {
      query: trimmedQuery,
      matchMode,
      source: 'local',
      cachedAt: local.cachedAt,
      results: local.results,
    }
  }

  if (!canQueryUpstream(matchMode, normalizedQuery)) {
    return {
      query: trimmedQuery,
      matchMode,
      source: 'local',
      cachedAt: null,
      results: [],
    }
  }

  const cached = await getCachedSearch(event, matchMode, normalizedQuery, trimmedQuery)
  if (cached) {
    return cached
  }

  await assertAisHubCooldownAvailable(event)

  const results =
    matchMode === 'mmsi'
      ? (await fetchAisHubApiByMmsi(normalizedQuery)) ||
        (await fetchAisHubVesselsPage(normalizedQuery, matchMode))
      : await fetchAisHubVesselsPage(normalizedQuery, matchMode)

  const cachedAt = new Date().toISOString()
  await recordAisHubRequest(event, cachedAt)
  await rememberAisHubResults(event, results, cachedAt)

  const response: AisHubSearchResponse = {
    query: normalizedQuery,
    matchMode,
    source: 'upstream',
    cachedAt,
    results,
  }

  await setCachedSearch(event, response)
  return response
}
