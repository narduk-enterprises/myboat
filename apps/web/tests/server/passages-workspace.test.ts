import { describe, expect, it } from 'vitest'
import type { PassageSummary } from '../../app/types/myboat'
import {
  buildPassageSearchText,
  buildPassageSelectionQuery,
  filterPassages,
  resolveSelectedPassageId,
  sortPassages,
} from '../../app/utils/passages-workspace'
import { buildTrackFeatureCollection } from '../../app/utils/marine'

const PASSAGES: PassageSummary[] = [
  {
    id: 'passage-alpha',
    title: 'Kemah Boardwalk Marina → Galveston Bay',
    summary: 'Easy harbor exit with a clean afternoon sea breeze.',
    departureName: 'Kemah Boardwalk Marina',
    arrivalName: 'Galveston Bay',
    startedAt: '2026-03-18T12:00:00.000Z',
    endedAt: '2026-03-18T15:00:00.000Z',
    distanceNm: 18.2,
    maxWindKn: 21,
    trackGeojson: '{"type":"LineString","coordinates":[[-95,29],[-94.9,29.1]]}',
  },
  {
    id: 'passage-bravo',
    title: 'Galveston Bay → Freeport',
    summary: 'Longer offshore leg with a squall on the final watch.',
    departureName: 'Galveston Bay',
    arrivalName: 'Freeport',
    startedAt: '2026-03-10T08:00:00.000Z',
    endedAt: '2026-03-10T19:00:00.000Z',
    distanceNm: 46.5,
    maxWindKn: 29,
    trackGeojson: '{"type":"LineString","coordinates":[[-94.9,29.1],[-95.2,28.9]]}',
  },
  {
    id: 'passage-charlie',
    title: 'Freeport → Kemah Boardwalk Marina',
    summary: null,
    departureName: 'Freeport',
    arrivalName: 'Kemah Boardwalk Marina',
    startedAt: '2026-03-22T05:00:00.000Z',
    endedAt: null,
    distanceNm: null,
    maxWindKn: null,
    trackGeojson: null,
  },
]

describe('passages workspace helpers', () => {
  it('builds searchable text from the route, summary, and distance fields', () => {
    expect(buildPassageSearchText(PASSAGES[0]!)).toContain('kemah boardwalk marina')
    expect(buildPassageSearchText(PASSAGES[0]!)).toContain('18.2 nm')
    expect(buildPassageSearchText(PASSAGES[1]!)).toContain('squall')
  })

  it('filters passages by title, route labels, or summary fragments', () => {
    expect(filterPassages(PASSAGES, 'freeport').map((passage) => passage.id)).toEqual([
      'passage-bravo',
      'passage-charlie',
    ])
    expect(filterPassages(PASSAGES, 'squall').map((passage) => passage.id)).toEqual([
      'passage-bravo',
    ])
    expect(filterPassages(PASSAGES, '').map((passage) => passage.id)).toEqual([
      'passage-alpha',
      'passage-bravo',
      'passage-charlie',
    ])
  })

  it('sorts passages by recency or logged distance', () => {
    expect(sortPassages(PASSAGES, 'date').map((passage) => passage.id)).toEqual([
      'passage-charlie',
      'passage-alpha',
      'passage-bravo',
    ])
    expect(sortPassages(PASSAGES, 'distance').map((passage) => passage.id)).toEqual([
      'passage-bravo',
      'passage-alpha',
      'passage-charlie',
    ])
  })

  it('keeps selection only when the requested passage exists in the current vessel log', () => {
    expect(resolveSelectedPassageId(PASSAGES, 'passage-alpha')).toBe('passage-alpha')
    expect(resolveSelectedPassageId(PASSAGES, 'missing')).toBeNull()
    expect(resolveSelectedPassageId([], 'passage-alpha')).toBeNull()
  })

  it('adds or removes the passage query param without disturbing other route state', () => {
    expect(
      buildPassageSelectionQuery(
        {
          vessel: 'north-star',
          mode: 'captain',
        },
        'passage-bravo',
      ),
    ).toEqual({
      vessel: 'north-star',
      mode: 'captain',
      p: 'passage-bravo',
    })

    expect(
      buildPassageSelectionQuery(
        {
          vessel: 'north-star',
          p: 'passage-bravo',
        },
        null,
      ),
    ).toEqual({
      vessel: 'north-star',
    })
  })

  it('normalizes feature-collection track payloads for the map layer', () => {
    const featureCollectionPassage: PassageSummary = {
      ...PASSAGES[0]!,
      id: 'passage-delta',
      trackGeojson: JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [
                [-80.1, 26.7],
                [-79.8, 26.8],
              ],
            },
            properties: { kind: 'voyage-track' },
          },
        ],
      }),
    }

    const collection = buildTrackFeatureCollection([featureCollectionPassage])
    expect(collection.features).toHaveLength(1)
    expect(collection.features[0]?.geometry.type).toBe('LineString')
    expect(collection.features[0]?.properties.id).toBe('passage-delta')
  })
})
