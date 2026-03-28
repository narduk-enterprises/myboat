import type { AisHubSearchResult } from '../app/types/myboat'

export const AISHUB_SEARCH_COOLDOWN_MS = 60_000

const AISHUB_SEARCH_RESULT_LIMIT = 12

const HTML_ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&gt;': '>',
  '&lt;': '<',
  '&nbsp;': ' ',
  '&#039;': "'",
  '&quot;': '"',
}

type AisHubSearchMode = AisHubSearchResult['matchMode']

function emptyToNull(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function decodeHtmlEntities(value: string) {
  return value
    .replaceAll(/&(amp|gt|lt|nbsp|quot|#039);/g, (match) => HTML_ENTITY_MAP[match] || match)
    .replaceAll(/&#(\d+);/g, (_, decimal) => {
      const codePoint = Number(decimal)
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : ''
    })
    .replaceAll(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const codePoint = Number.parseInt(hex, 16)
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : ''
    })
}

function stripHtml(value: string) {
  return decodeHtmlEntities(value.replaceAll(/<[^>]+>/g, ' '))
    .replaceAll(/\s+/g, ' ')
    .trim()
}

function normalizeImo(value: string | null | undefined) {
  const normalized = emptyToNull(value)
  return normalized && normalized !== '0' ? normalized : null
}

function normalizeApiTimestamp(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null
}

export function parseAisHubListTimestamp(value: string) {
  const match = value.match(
    /^(?<day>\d{2})-(?<month>\d{2})-(?<year>\d{4}) (?<hour>\d{2}):(?<minute>\d{2}) UTC$/,
  )

  if (!match?.groups) {
    return null
  }

  const year = Number(match.groups.year)
  const month = Number(match.groups.month)
  const day = Number(match.groups.day)
  const hour = Number(match.groups.hour)
  const minute = Number(match.groups.minute)

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute)
  ) {
    return null
  }

  return new Date(Date.UTC(year, month - 1, day, hour, minute)).toISOString()
}

export function normalizeAisHubSearchQuery(value: string) {
  const trimmed = value.trim()
  const compactDigits = trimmed.replaceAll(/\s+/g, '')

  if (/^\d{9}$/.test(compactDigits)) {
    return {
      matchMode: 'mmsi' as const,
      normalizedQuery: compactDigits,
    }
  }

  return {
    matchMode: 'name' as const,
    normalizedQuery: trimmed.replaceAll(/\s+/g, ' '),
  }
}

export function parseAisHubApiSearchResponse(payload: string): AisHubSearchResult[] {
  const parsed = JSON.parse(payload) as unknown

  if (!Array.isArray(parsed) || parsed.length < 2 || !Array.isArray(parsed[1])) {
    return []
  }

  const results: AisHubSearchResult[] = []

  for (const row of parsed[1]) {
    if (!row || typeof row !== 'object') {
      continue
    }

    const record = row as Record<string, unknown>
    const mmsi = String(record.MMSI || '').trim()
    if (!mmsi) {
      continue
    }

    results.push({
      source: 'aishub',
      matchMode: 'mmsi',
      mmsi,
      imo: normalizeImo(String(record.IMO || '')),
      name: emptyToNull(String(record.NAME || '')) || `MMSI ${mmsi}`,
      callSign: emptyToNull(String(record.CALLSIGN || '')),
      destination: emptyToNull(String(record.DEST || '')),
      lastReportAt: normalizeApiTimestamp(record.TIME),
      positionLat: typeof record.LATITUDE === 'number' ? record.LATITUDE : null,
      positionLng: typeof record.LONGITUDE === 'number' ? record.LONGITUDE : null,
      shipType: typeof record.TYPE === 'number' ? record.TYPE : null,
      sourceStations: [],
    })
  }

  return results
}

function extractRowCells(rowHtml: string) {
  const cells: string[] = []

  for (const cellChunk of rowHtml.split('</td>')) {
    if (!cellChunk.includes('<td')) {
      continue
    }

    const cellStart = cellChunk.indexOf('>')
    if (cellStart === -1) {
      continue
    }

    cells.push(stripHtml(cellChunk.slice(cellStart + 1)))
  }

  return cells
}

export function parseAisHubVesselsHtml(
  html: string,
  matchMode: AisHubSearchMode,
): AisHubSearchResult[] {
  const tbodyStart = html.search(/<tbody>/i)
  const tbodyEnd = html.search(/<\/tbody>/i)

  if (tbodyStart === -1 || tbodyEnd === -1 || tbodyEnd <= tbodyStart) {
    return []
  }

  const tbodyHtml = html.slice(tbodyStart + '<tbody>'.length, tbodyEnd)
  const results: AisHubSearchResult[] = []

  for (const rowChunk of tbodyHtml.split('</tr>')) {
    if (!rowChunk.includes('<td')) {
      continue
    }

    const cells = extractRowCells(rowChunk)
    if (cells.length < 6) {
      continue
    }

    const mmsi = cells[0]?.trim() || ''
    if (!mmsi) {
      continue
    }

    const sourceStations = [...rowChunk.matchAll(/\/stations\/(\d+)/g)].map((match) => match[1]!)

    results.push({
      source: 'aishub',
      matchMode,
      mmsi,
      imo: normalizeImo(cells[1]),
      name: emptyToNull(cells[2]) || `MMSI ${mmsi}`,
      callSign: emptyToNull(cells[3]),
      destination: emptyToNull(cells[4]),
      lastReportAt: parseAisHubListTimestamp(cells[5] || ''),
      positionLat: null,
      positionLng: null,
      shipType: null,
      sourceStations,
    })

    if (results.length >= AISHUB_SEARCH_RESULT_LIMIT) {
      break
    }
  }

  return results
}
