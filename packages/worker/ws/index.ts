// packages/worker/ws/index.ts
// WebSocket server with pub/sub

import { addClient, removeClient, broadcast, broadcastWebhookEvent, broadcastConfigChange } from './broadcast'

export interface WsClient {
  userId?: string
  subscribedRepos: Set<string>
}

export function setupWebSocket(server: any) {
  // WebSocket upgrade handler
  server.upgrade = (req: Request) => {
    const url = new URL(req.url)
    
    if (url.pathname === '/ws') {
      // Extract session from cookie for auth
      const cookies = parseCookies(req.headers.get('Cookie') || '')
      const sessionCookie = cookies['__Host-session']
      
      // For now, allow all connections (auth can be added later)
      return true
    }
    
    return false
  }

  // WebSocket handlers
  server.websocket = {
    open(ws: any) {
      const client: WsClient = {
        subscribedRepos: new Set(),
      }
      ws.data = client
      addClient(ws)
      console.log('[ws] Client connected')
    },

    message(ws: any, message: string) {
      try {
        const msg = JSON.parse(message)
        const client = ws.data as WsClient

        switch (msg.type) {
          case 'subscribe':
            if (msg.repo) {
              client.subscribedRepos.add(msg.repo)
              console.log(`[ws] Client subscribed to ${msg.repo}`)
            }
            break

          case 'unsubscribe':
            if (msg.repo) {
              client.subscribedRepos.delete(msg.repo)
              console.log(`[ws] Client unsubscribed from ${msg.repo}`)
            }
            break

          case 'ping':
            ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }))
            break
        }
      } catch (error) {
        console.error('[ws] Failed to parse message:', error)
      }
    },

    close(ws: any) {
      removeClient(ws)
      console.log('[ws] Client disconnected')
    },
  }
}

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {}
  for (const pair of cookieHeader.split(';')) {
    const [name, ...rest] = pair.split('=')
    if (name && rest.length > 0) {
      cookies[name.trim()] = rest.join('=').trim()
    }
  }
  return cookies
}

export { broadcast, broadcastWebhookEvent, broadcastConfigChange }
