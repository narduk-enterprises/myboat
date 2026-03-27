import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))
const appRoot = join(__dirname, '..', '..')
const layerDrizzleDir = join(
  appRoot,
  'node_modules/@narduk-enterprises/narduk-nuxt-template-layer/drizzle',
)
const appDrizzleDir = join(appRoot, 'drizzle')

function readMigrationFiles(dir: string) {
  return readdirSync(dir)
    .filter((file) => /^0.*\.sql$/.test(file))
    .sort()
    .map((file) => readFileSync(join(dir, file), 'utf-8'))
}

function buildSeededDatabase() {
  const db = new DatabaseSync(':memory:')

  for (const sql of [
    ...readMigrationFiles(layerDrizzleDir),
    ...readMigrationFiles(appDrizzleDir),
  ]) {
    db.exec(sql)
  }

  db.exec(readFileSync(join(layerDrizzleDir, 'seed.sql'), 'utf-8'))
  db.exec(readFileSync(join(appDrizzleDir, 'seed.sql'), 'utf-8'))

  return db
}

describe('apps/web local seed data', () => {
  it('seeds a populated demo fleet for the demo user', () => {
    const db = buildSeededDatabase()

    try {
      const profile = db
        .prepare(
          `
            SELECT username, home_port AS homePort
            FROM public_profiles
            WHERE user_id = ?
          `,
        )
        .get('00000000-0000-0000-0000-000000000001') as
        | { username: string; homePort: string | null }
        | undefined

      const counts = db
        .prepare(
          `
            SELECT
              (SELECT COUNT(*) FROM vessels WHERE owner_user_id = ?) AS vesselCount,
              (SELECT COUNT(*) FROM passages WHERE vessel_id IN (
                SELECT id FROM vessels WHERE owner_user_id = ?
              )) AS passageCount,
              (SELECT COUNT(*) FROM media_items WHERE vessel_id IN (
                SELECT id FROM vessels WHERE owner_user_id = ?
              )) AS mediaCount,
              (SELECT COUNT(*) FROM waypoints WHERE vessel_id IN (
                SELECT id FROM vessels WHERE owner_user_id = ?
              )) AS waypointCount
          `,
        )
        .get(
          '00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000001',
        ) as {
        vesselCount: number
        passageCount: number
        mediaCount: number
        waypointCount: number
      }

      expect(profile).toEqual({
        username: 'captain-tide',
        homePort: 'St. Petersburg, FL',
      })
      expect(counts).toEqual({
        vesselCount: 2,
        passageCount: 3,
        mediaCount: 3,
        waypointCount: 4,
      })
    } finally {
      db.close()
    }
  })

  it('points the primary demo installation at the Tideye public Signal K stream', () => {
    const db = buildSeededDatabase()

    try {
      const installation = db
        .prepare(
          `
            SELECT
              vessel_installations.installation_type AS installationType,
              vessel_installations.signalk_url AS signalKUrl,
              vessel_installations.connection_state AS connectionState,
              vessel_installations.is_primary AS isPrimary
            FROM vessel_installations
            INNER JOIN vessels ON vessels.id = vessel_installations.vessel_id
            WHERE vessels.owner_user_id = ?
            ORDER BY vessel_installations.is_primary DESC, vessel_installations.created_at ASC
            LIMIT 1
          `,
        )
        .get('00000000-0000-0000-0000-000000000001') as {
        installationType: string
        signalKUrl: string | null
        connectionState: string
        isPrimary: number
      }

      expect(installation).toEqual({
        installationType: 'direct_signalk',
        signalKUrl: 'wss://signalk-public.tideye.com/signalk/v1/stream',
        connectionState: 'live',
        isPrimary: 1,
      })
    } finally {
      db.close()
    }
  })
})
