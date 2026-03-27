import { runCommand } from './command'

type LocationFlag = '--local' | '--remote'

function parseArgs(argv: string[]) {
  const dbName = argv[2]
  const location = argv.includes('--remote') ? '--remote' : '--local'

  if (!dbName) {
    throw new Error('Usage: tsx tools/backfill-myboat-legacy.ts <db-name> [--local|--remote]')
  }

  return { dbName, location }
}

function executeJson(dbName: string, location: LocationFlag, sql: string, cwd: string) {
  const output = runCommand(
    'wrangler',
    ['d1', 'execute', dbName, location, '--command', sql, '--json'],
    { cwd },
  )

  const parsed = JSON.parse(output) as Array<{
    results?: Array<Record<string, unknown>>
    success?: boolean
  }>

  return parsed
}

function executeSql(dbName: string, location: LocationFlag, sql: string, cwd: string) {
  runCommand('wrangler', ['d1', 'execute', dbName, location, '--command', sql], {
    cwd,
    stdio: 'inherit',
  })
}

function tableExists(dbName: string, location: LocationFlag, cwd: string, tableName: string) {
  const escaped = tableName.replaceAll("'", "''")
  const rows = executeJson(
    dbName,
    location,
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${escaped}' LIMIT 1;`,
    cwd,
  )

  return Boolean(rows[0]?.results?.length)
}

function main() {
  const { dbName, location } = parseArgs(process.argv)
  const cwd = process.cwd()

  const hasLegacyInstalls = tableExists(dbName, location, cwd, 'installs')
  const hasLegacyKeys = tableExists(dbName, location, cwd, 'ingest_keys')
  const hasLegacyEvents = tableExists(dbName, location, cwd, 'ingest_events')
  const hasLegacyUsernames = tableExists(dbName, location, cwd, 'usernames')

  if (!hasLegacyInstalls && !hasLegacyKeys && !hasLegacyEvents && !hasLegacyUsernames) {
    console.log('No legacy MyBoat tables detected. Skipping backfill.')
    return
  }

  const statements: string[] = []

  if (hasLegacyUsernames) {
    statements.push(`
INSERT OR IGNORE INTO public_profiles (
  user_id,
  username,
  share_profile,
  created_at,
  updated_at
)
SELECT
  user_id,
  username,
  1,
  created_at,
  created_at
FROM usernames;`)
  }

  if (hasLegacyInstalls) {
    statements.push(`
INSERT OR IGNORE INTO vessels (
  id,
  owner_user_id,
  slug,
  name,
  vessel_type,
  summary,
  is_primary,
  share_public,
  created_at,
  updated_at
)
SELECT
  installs.id,
  installs.user_id,
  lower(
    trim(
      replace(
        replace(
          replace(installs.name, ' ', '-'),
          '_',
          '-'
        ),
        '.',
        '-'
      ),
      '-'
    )
  ) || '-' || substr(installs.id, 1, 6),
  installs.name,
  installs.description,
  installs.description,
  CASE
    WHEN (
      SELECT count(*)
      FROM installs siblings
      WHERE siblings.user_id = installs.user_id
    ) = 1 THEN 1
    ELSE 0
  END,
  0,
  installs.created_at,
  installs.created_at
FROM installs;`)

    const installationStatsJoin = hasLegacyEvents
      ? `
LEFT JOIN (
  SELECT
    install_id,
    max(ts) AS last_seen_at,
    count(*) AS event_count
  FROM ingest_events
  GROUP BY install_id
) install_stats
  ON install_stats.install_id = installs.id`
      : ''

    const lastSeenSelect = hasLegacyEvents ? 'install_stats.last_seen_at' : 'NULL'
    const eventCountSelect = hasLegacyEvents ? 'coalesce(install_stats.event_count, 0)' : '0'
    const connectionStateSelect = hasLegacyEvents
      ? "CASE WHEN install_stats.last_seen_at IS NULL THEN 'pending' ELSE 'live' END"
      : "'pending'"
    const updatedAtSelect = hasLegacyEvents
      ? "coalesce(install_stats.last_seen_at, installs.created_at)"
      : 'installs.created_at'

    statements.push(`
INSERT OR IGNORE INTO vessel_installations (
  id,
  vessel_id,
  label,
  connection_state,
  last_seen_at,
  event_count,
  created_at,
  updated_at
)
SELECT
  installs.id,
  installs.id,
  installs.name,
  ${connectionStateSelect},
  ${lastSeenSelect},
  ${eventCountSelect},
  installs.created_at,
  ${updatedAtSelect}
FROM installs
${installationStatsJoin};`)
  }

  if (hasLegacyInstalls && hasLegacyKeys) {
    statements.push(`
INSERT OR IGNORE INTO api_keys (
  id,
  user_id,
  name,
  key_hash,
  key_prefix,
  created_at
)
SELECT
  ingest_keys.id,
  installs.user_id,
  'Legacy ingest key ' || ingest_keys.key_prefix,
  ingest_keys.key_hash,
  ingest_keys.key_prefix,
  ingest_keys.created_at
FROM ingest_keys
INNER JOIN installs
  ON installs.id = ingest_keys.install_id
WHERE ingest_keys.revoked_at IS NULL;`)

    statements.push(`
INSERT OR IGNORE INTO vessel_installation_api_keys (
  api_key_id,
  installation_id,
  created_at
)
SELECT
  ingest_keys.id,
  ingest_keys.install_id,
  ingest_keys.created_at
FROM ingest_keys
WHERE ingest_keys.revoked_at IS NULL;`)
  }

  if (!statements.length) {
    console.log('Legacy MyBoat tables detected, but no compatible backfill actions were needed.')
    return
  }

  const sql = statements.map((statement) => statement.trim().replace(/;+\s*$/, '')).join(';\n')
  console.log(`Backfilling legacy MyBoat data (${location})...`)
  executeSql(dbName, location, sql, cwd)
}

main()
