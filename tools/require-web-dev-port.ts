import process from 'node:process'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const DEFAULT_PORT = 3000

async function main() {
  const rawPort =
    process.env.REQUIRED_PORT ||
    process.env.NUXT_PORT ||
    process.env.NITRO_PORT ||
    process.env.PORT ||
    ''
  const port = Number.parseInt(rawPort, 10)
  const requestedPort = Number.isFinite(port) && port > 0 ? port : DEFAULT_PORT
  const label = process.env.REQUIRED_PORT_LABEL?.trim() || 'Dev web port'

  try {
    const { stdout } = await execFileAsync('lsof', [
      '-nP',
      `-iTCP:${requestedPort}`,
      '-sTCP:LISTEN',
    ])

    if (stdout.trim()) {
      console.error(
        [
          `❌ ${label} ${requestedPort} is already in use.`,
          label === 'Dev web port'
            ? 'Nuxt will silently choose a different port if this is not caught first.'
            : 'The local dev startup expects to bind this port itself.',
          label === 'Dev web port'
            ? 'Stop the existing listener or pick a different NUXT_PORT before running `pnpm dev`.'
            : 'Stop the existing listener or change the configured broker port before running `pnpm dev`.',
          '',
          stdout.trim(),
        ].join('\n'),
      )
      process.exitCode = 1
      return
    }
  } catch (error: unknown) {
    const typedError = error as { code?: number | string }
    if (typedError?.code !== 1) {
      throw error
    }
  }

  console.log(`✅ ${label} ${requestedPort} is available.`)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`❌ Failed to verify NUXT_PORT availability: ${message}`)
  process.exitCode = 1
})
