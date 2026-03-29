import worker from './.output/server/index.mjs'
import { matchVesselLiveRoute, toVesselDetailPath } from './worker/liveRoute'
import { VesselLiveBroker } from './worker/VesselLiveBroker'

type LiveWorkerEnv = {
  VESSEL_LIVE_BROKER: DurableObjectNamespace
}

type NitroWorker = {
  fetch(request: Request, env: LiveWorkerEnv, ctx: ExecutionContext): Promise<Response> | Response
  [key: string]: unknown
}

const LIVE_BROKER_DEBUG_PREFIX = 'LIVE_BROKER_DEBUG'
const nitroWorker = worker as NitroWorker

function emitLiveBrokerDebug(event: string, fields: Record<string, unknown>) {
  console.info(LIVE_BROKER_DEBUG_PREFIX, {
    event,
    ...fields,
  })
}

function isWebSocketUpgrade(request: Request) {
  return request.headers.get('upgrade')?.toLowerCase() === 'websocket'
}

function createDetailRequest(request: Request, detailPath: string) {
  const url = new URL(request.url)
  url.pathname = detailPath
  url.search = ''

  const headers = new Headers(request.headers)
  for (const header of [
    'connection',
    'content-length',
    'sec-websocket-extensions',
    'sec-websocket-key',
    'sec-websocket-protocol',
    'sec-websocket-version',
    'upgrade',
  ]) {
    headers.delete(header)
  }
  headers.set('accept', 'application/json')

  return new Request(url, {
    method: 'GET',
    headers,
  })
}

async function resolveLiveVesselId(
  request: Request,
  env: LiveWorkerEnv,
  ctx: ExecutionContext,
  route: NonNullable<ReturnType<typeof matchVesselLiveRoute>>,
) {
  const detailPath = toVesselDetailPath(route)
  const detailResponse = await nitroWorker.fetch(createDetailRequest(request, detailPath), env, ctx)

  emitLiveBrokerDebug('entry_live_resolve_result', {
    namespace: route.namespace,
    detailPath,
    status: detailResponse.status,
  })

  if (!detailResponse.ok) {
    return {
      vesselId: null,
      response: detailResponse,
    }
  }

  const detailPayload = (await detailResponse.json()) as {
    vessel?: {
      id?: string
    }
  }
  const vesselId = detailPayload.vessel?.id

  if (!vesselId) {
    return {
      vesselId: null,
      response: new Response('Live vessel resolution failed.', {
        status: 502,
      }),
    }
  }

  return {
    vesselId,
    response: null,
  }
}

const wrappedWorker = {
  ...nitroWorker,
  async fetch(request: Request, env: LiveWorkerEnv, ctx: ExecutionContext) {
    const url = new URL(request.url)
    const route = matchVesselLiveRoute(url.pathname)

    if (!route || !isWebSocketUpgrade(request)) {
      return nitroWorker.fetch(request, env, ctx)
    }

    emitLiveBrokerDebug('entry_live_upgrade_start', {
      pathname: url.pathname,
      namespace: route.namespace,
    })

    const resolved = await resolveLiveVesselId(request, env, ctx, route)

    if (!resolved.vesselId) {
      return resolved.response!
    }

    emitLiveBrokerDebug('entry_live_forward_do', {
      namespace: route.namespace,
      vesselId: resolved.vesselId,
    })

    return env.VESSEL_LIVE_BROKER.getByName(resolved.vesselId).fetch(request)
  },
}

export default wrappedWorker
export { VesselLiveBroker }
