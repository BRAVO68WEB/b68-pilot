/**
 * WebSocket handler for real-time updates (config changes, activity feed).
 */

export type WsMessageHandler = (data: unknown) => void

export interface WsServer {
  /** Broadcast a message to all connected clients */
  broadcast(type: string, data: unknown): void

  /** Get number of connected clients */
  clients(): number
}

export function createWsServer(): WsServer & { handleUpgrade: (req: Request) => Response | null } {
  const sockets = new Set<any>()

  return {
    broadcast(type: string, data: unknown) {
      const message = JSON.stringify({ type, data, timestamp: new Date().toISOString() })
      for (const ws of sockets) {
        try {
          ws.send(message)
        } catch {
          sockets.delete(ws)
        }
      }
    },

    clients() {
      return sockets.size
    },

    handleUpgrade(req: Request): Response | null {
      // Bun's WebSocket support
      const url = new URL(req.url)
      if (url.pathname !== '/ws') return null

      // This is handled by Bun.serve's websocket option
      return null
    },
  }
}
