import { VesselLiveBroker } from './VesselLiveBroker'

type BrokerWorkerEnv = {
  VESSEL_LIVE_BROKER_SELF: DurableObjectNamespace
}

export { VesselLiveBroker }

export default {
  async fetch(request: Request, env: BrokerWorkerEnv) {
    const url = new URL(request.url)

    if (url.pathname === '/healthz') {
      return Response.json({
        ok: true,
        worker: 'myboat-vessel-live-broker',
      })
    }

    const match = url.pathname.match(/^\/vessels\/([^/]+)\/(connect|publish)$/)
    if (match) {
      const [, vesselId, action] = match
      const stub = env.VESSEL_LIVE_BROKER_SELF.getByName(vesselId)

      if (action === 'connect') {
        return stub.fetch('https://vessel-live.internal/connect', {
          method: request.method,
          headers: request.headers,
        })
      }

      return stub.fetch('https://vessel-live.internal/publish', {
        method: 'POST',
        headers: {
          'content-type': request.headers.get('content-type') || 'application/json',
        },
        body: await request.text(),
      })
    }

    return new Response('myboat-vessel-live-broker', {
      status: 200,
    })
  },
}
