import { describe, expect, it } from 'vitest'
import {
  normalizeAisHubSearchQuery,
  parseAisHubApiSearchResponse,
  parseAisHubListTimestamp,
  parseAisHubVesselsHtml,
} from '../../shared/aishub'

describe('AIS Hub helpers', () => {
  it('classifies exact MMSI searches separately from name searches', () => {
    expect(normalizeAisHubSearchQuery('244750034')).toEqual({
      matchMode: 'mmsi',
      normalizedQuery: '244750034',
    })

    expect(normalizeAisHubSearchQuery('  CHATEAUROUX  ')).toEqual({
      matchMode: 'name',
      normalizedQuery: 'CHATEAUROUX',
    })
  })

  it('parses the authenticated AIS Hub API JSON wrapper', () => {
    const payload =
      '[{"ERROR":false,"USERNAME":"REDACTED","FORMAT":"HUMAN","RECORDS":1},[{"MMSI":244750034,"TIME":"2026-03-28 16:50:52 GMT","LONGITUDE":5.03807,"LATITUDE":52.46028,"COG":360,"SOG":0,"HEADING":511,"ROT":128,"PAC":0,"NAVSTAT":8,"IMO":0,"NAME":"CHATEAUROUX","CALLSIGN":"PH7002","TYPE":69,"A":24,"B":6,"C":1,"D":5,"DRAUGHT":1.2,"DEST":"ENKHUIZEN","ETA":"01-01 00:00"}]]'

    expect(parseAisHubApiSearchResponse(payload)).toEqual([
      {
        source: 'aishub',
        matchMode: 'mmsi',
        mmsi: '244750034',
        imo: null,
        name: 'CHATEAUROUX',
        callSign: 'PH7002',
        destination: 'ENKHUIZEN',
        lastReportAt: '2026-03-28T16:50:52.000Z',
        positionLat: 52.46028,
        positionLng: 5.03807,
        shipType: 69,
        sourceStations: [],
      },
    ])
  })

  it('parses the public AIS Hub vessel search HTML', () => {
    const html = `
      <table>
        <tbody>
          <tr data-key="1">
            <td>244750034</td>
            <td>0</td>
            <td>CHATEAUROUX</td>
            <td>PH7002</td>
            <td>ENKHUIZEN</td>
            <td>28-03-2026 16:51 UTC</td>
            <td>
              <a href="https://www.aishub.net/stations/3293">3293</a>
              <a href="https://www.aishub.net/stations/2323">2323</a>
            </td>
          </tr>
        </tbody>
      </table>
    `

    expect(parseAisHubVesselsHtml(html, 'name')).toEqual([
      {
        source: 'aishub',
        matchMode: 'name',
        mmsi: '244750034',
        imo: null,
        name: 'CHATEAUROUX',
        callSign: 'PH7002',
        destination: 'ENKHUIZEN',
        lastReportAt: '2026-03-28T16:51:00.000Z',
        positionLat: null,
        positionLng: null,
        shipType: null,
        sourceStations: ['3293', '2323'],
      },
    ])
  })

  it('parses list timestamps into ISO strings', () => {
    expect(parseAisHubListTimestamp('28-03-2026 16:51 UTC')).toBe('2026-03-28T16:51:00.000Z')
    expect(parseAisHubListTimestamp('not-a-timestamp')).toBeNull()
  })
})
