/// <reference types="@cloudflare/workers-types" />
import { DurableObject } from 'cloudflare:workers'
import type { AisContactSummary, VesselSnapshotSummary } from '../app/types/myboat'
import type {
  LiveDemand,
  VesselLiveClientMessage,
  VesselLivePublishMessage,
  VesselLiveServerMessage,
  VesselLiveSyncMessage,
  VesselLiveConnectionState,
} from '../shared/myboatLive'
import {
  DEFAULT_LIVE_DEMAND,
  mergeAisContactSummary,
  normalizeLiveDemand,
} from '../shared/myboatLive'

type PersistedBrokerState = {
  aisContacts: Record<string, AisContactSummary>
  connectionState: VesselLiveConnectionState
  lastObservedAt: string | null
  snapshot: VesselSnapshotSummary | null
}

type SocketAttachment = {
  demand: LiveDemand
}

const STORAGE_KEY = 'state'

function createEmptyState(): PersistedBrokerState {
  return {
    snapshot: null,
    aisContacts: {},
    connectionState: 'idle',
    lastObservedAt: null,
  }
}

function isOpenSocket(socket: WebSocket) {
  return socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CLOSING
}

function parseClientMessage(message: string | ArrayBuffer): VesselLiveClientMessage | null {
  if (typeof message !== 'string') {
    return null
  }

  try {
    const parsed = JSON.parse(message) as VesselLiveClientMessage
    return parsed?.type === 'set_demand' ? parsed : null
  } catch {
    return null
  }
}

function sendSocketMessage(socket: WebSocket, message: VesselLiveServerMessage) {
  try {
    socket.send(JSON.stringify(message))
    return true
  } catch {
    // Durable Object hibernation sockets can still surface through getWebSockets()
    // during close handshakes; ignore failed sends and let later fanout attempts
    // target the remaining active sockets.
    return false
  }
}

export class VesselLiveBroker extends DurableObject {
  private stateRecord: PersistedBrokerState = createEmptyState()

  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env)

    this.ctx.blockConcurrencyWhile(async () => {
      const persisted = await this.ctx.storage.get<PersistedBrokerState>(STORAGE_KEY)
      if (persisted) {
        this.stateRecord = persisted
      }
    })
  }

  private socketAttachment(socket: WebSocket): SocketAttachment {
    const attachment = socket.deserializeAttachment() as SocketAttachment | null

    return {
      demand: normalizeLiveDemand(attachment?.demand),
    }
  }

  private updateSocketDemand(socket: WebSocket, demand: LiveDemand) {
    socket.serializeAttachment({
      demand,
    } satisfies SocketAttachment)
  }

  private buildSyncMessage(demand: LiveDemand): VesselLiveSyncMessage {
    return {
      type: 'sync',
      snapshot: demand.selfLevel === 'none' ? null : this.stateRecord.snapshot,
      aisContacts: demand.ais ? Object.values(this.stateRecord.aisContacts) : [],
      connectionState: this.stateRecord.connectionState,
      lastObservedAt: this.stateRecord.lastObservedAt,
    }
  }

  private async persistState() {
    await this.ctx.storage.put(STORAGE_KEY, this.stateRecord)
  }

  private fanout(message: VesselLiveServerMessage, predicate?: (demand: LiveDemand) => boolean) {
    const sockets = this.ctx.getWebSockets()

    for (const socket of sockets) {
      const demand = this.socketAttachment(socket).demand
      if (predicate && !predicate(demand)) {
        continue
      }
      sendSocketMessage(socket, message)
    }
  }

  private async handlePublish(payload: VesselLivePublishMessage) {
    const aisRemovals: string[] = []
    const aisUpserts: AisContactSummary[] = []

    if (payload.snapshot !== undefined) {
      this.stateRecord.snapshot = payload.snapshot || null
    }

    if (payload.connectionState) {
      this.stateRecord.connectionState = payload.connectionState
    }

    if (payload.lastObservedAt !== undefined) {
      this.stateRecord.lastObservedAt = payload.lastObservedAt || null
    }

    for (const contact of payload.aisContacts || []) {
      if (!contact?.id) {
        continue
      }

      const mergedContact = mergeAisContactSummary(
        this.stateRecord.aisContacts[contact.id],
        contact,
      )
      this.stateRecord.aisContacts[contact.id] = mergedContact
      aisUpserts.push(mergedContact)
    }

    await this.persistState()

    if (payload.snapshot !== undefined) {
      this.fanout(
        {
          type: 'snapshot',
          snapshot: this.stateRecord.snapshot!,
        },
        (demand) => demand.selfLevel !== 'none' && Boolean(this.stateRecord.snapshot),
      )
    }

    for (const contact of aisUpserts) {
      this.fanout(
        {
          type: 'ais_upsert',
          contact,
        },
        (demand) => demand.ais,
      )
    }

    for (const contactId of aisRemovals) {
      this.fanout(
        {
          type: 'ais_remove',
          contactId,
        },
        (demand) => demand.ais,
      )
    }

    this.fanout({
      type: 'status',
      connectionState: this.stateRecord.connectionState,
      lastObservedAt: this.stateRecord.lastObservedAt,
    })
  }

  async fetch(request: Request) {
    const url = new URL(request.url)

    if (url.pathname === '/publish' && request.method === 'POST') {
      const payload = (await request.json()) as VesselLivePublishMessage
      await this.handlePublish(payload)
      return new Response(null, { status: 204 })
    }

    if (request.method === 'GET' && url.pathname.startsWith('/contacts/')) {
      const contactId = decodeURIComponent(url.pathname.slice('/contacts/'.length))
      const contact = this.stateRecord.aisContacts[contactId] || null

      return Response.json(
        {
          contact,
        },
        {
          status: contact ? 200 : 404,
        },
      )
    }

    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected websocket upgrade.', { status: 426 })
    }

    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1]

    this.updateSocketDemand(server, DEFAULT_LIVE_DEMAND)
    this.ctx.acceptWebSocket(server)
    sendSocketMessage(server, this.buildSyncMessage(DEFAULT_LIVE_DEMAND))

    return new Response(null, {
      status: 101,
      webSocket: client,
    })
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) {
    const parsed = parseClientMessage(message)

    if (!parsed) {
      return
    }

    const demand = normalizeLiveDemand(parsed.demand || parsed)
    this.updateSocketDemand(socket, demand)
    sendSocketMessage(socket, this.buildSyncMessage(demand))
  }

  webSocketClose(socket: WebSocket) {
    if (isOpenSocket(socket)) {
      socket.close(1000, 'Closed')
    }
  }

  webSocketError(socket: WebSocket) {
    if (isOpenSocket(socket)) {
      socket.close(1011, 'Broker error')
    }
  }
}
