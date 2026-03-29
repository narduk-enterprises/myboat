import type { H3Event } from 'h3'
import { getHeader, getRequestURL, toWebRequest } from 'h3'
import { useRuntimeConfig } from '#imports'
import type { VesselLivePublishMessage } from '../../shared/myboatLive'

type VesselLiveBrokerEnv = {
  VESSEL_LIVE_BROKER?: DurableObjectNamespace
}

const LIVE_BROKER_DEBUG_PREFIX = 'LIVE_BROKER_DEBUG'

function emitLiveBrokerDebug(event: string, fields: Record<string, unknown>) {
  console.info(LIVE_BROKER_DEBUG_PREFIX, {
    event,
    ...fields,
  })
}

function useVesselLiveBrokerNamespace(event: H3Event) {
  const env = event.context.cloudflare?.env as VesselLiveBrokerEnv | undefined
  const namespace = env?.VESSEL_LIVE_BROKER

  if (!namespace) {
    throw createError({
      statusCode: 500,
      message: 'Vessel live broker binding is not configured.',
    })
  }

  return namespace
}

function getVesselLiveBrokerStub(event: H3Event, vesselId: string) {
  return useVesselLiveBrokerNamespace(event).getByName(vesselId)
}

function getLocalBrokerOrigin(event: H3Event) {
  const configured = useRuntimeConfig(event).localBrokerOrigin
  return typeof configured === 'string' && configured.trim() ? configured.trim() : ''
}

function toProxyRequest(event: H3Event, url?: string | URL) {
  const request = toWebRequest(event)
  return url ? new Request(url, request) : request
}

export async function proxyVesselLiveUpgrade(event: H3Event, vesselId: string) {
  const upgrade = getHeader(event, 'upgrade')?.toLowerCase()
  const localBrokerOrigin = getLocalBrokerOrigin(event)

  emitLiveBrokerDebug('route_upgrade_start', {
    vesselId,
    requestUrl: getRequestURL(event).toString(),
    upgrade: upgrade || null,
    hasLocalBrokerOrigin: Boolean(localBrokerOrigin),
  })

  if (upgrade !== 'websocket') {
    throw createError({
      statusCode: 426,
      message: 'Expected a websocket upgrade request.',
    })
  }

  if (localBrokerOrigin) {
    const target = new URL(`/vessels/${vesselId}/connect`, localBrokerOrigin)
    emitLiveBrokerDebug('route_upgrade_forward_local', {
      vesselId,
      target: target.toString(),
    })
    return fetch(toProxyRequest(event, target))
  }

  emitLiveBrokerDebug('route_upgrade_forward_do', {
    vesselId,
    target: vesselId,
  })
  return getVesselLiveBrokerStub(event, vesselId).fetch(toProxyRequest(event))
}

export async function publishVesselLiveMessage(
  event: H3Event,
  vesselId: string,
  payload: VesselLivePublishMessage,
) {
  const localBrokerOrigin = getLocalBrokerOrigin(event)
  emitLiveBrokerDebug('route_publish_start', {
    vesselId,
    target: localBrokerOrigin ? 'local' : 'durable_object',
  })
  const response = localBrokerOrigin
    ? await fetch(new URL(`/vessels/${vesselId}/publish`, localBrokerOrigin), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
    : await getVesselLiveBrokerStub(event, vesselId).fetch('https://vessel-live.internal/publish', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

  emitLiveBrokerDebug('route_publish_result', {
    vesselId,
    target: localBrokerOrigin ? 'local' : 'durable_object',
    status: response.status,
  })

  if (!response.ok) {
    throw createError({
      statusCode: 502,
      message: 'Failed to publish vessel live update.',
    })
  }
}
