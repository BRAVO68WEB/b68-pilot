// packages/worker/ws/broadcast.ts
// WebSocket broadcast for real-time dashboard updates

export interface WsMessage {
  type: string
  data: unknown
  timestamp: string
}

const clients = new Set<any>()

export function addClient(ws: any) {
  clients.add(ws)
}

export function removeClient(ws: any) {
  clients.delete(ws)
}

export function broadcast(type: string, data: unknown) {
  const message: WsMessage = {
    type,
    data,
    timestamp: new Date().toISOString(),
  }

  const json = JSON.stringify(message)
  
  for (const client of clients) {
    try {
      if (client.readyState === 1) { // OPEN
        client.send(json)
      }
    } catch {
      clients.delete(client)
    }
  }
}

export function broadcastWebhookEvent(repo: string, event: unknown) {
  broadcast('webhook', { repo, event })
}

export function broadcastConfigChange(repo: string, config: unknown) {
  broadcast('config.update', { repo, config })
}

export function getClientCount(): number {
  return clients.size
}
