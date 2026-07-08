import { useEffect, useRef, useCallback, useState } from 'react'

export type WsMessageHandler = (type: string, data: unknown) => void

interface WsMessage {
  type: string
  data: unknown
  timestamp: string
}

type MessageHandler = (message: WsMessage) => void

/**
 * WebSocket hook for real-time updates from the worker.
 */
export function useWebSocket(onMessage?: WsMessageHandler) {
  const wsRef = useRef<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const handlersRef = useRef<Map<string, Set<MessageHandler>>>(new Map())

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`)

    ws.onopen = () => {
      setConnected(true)
      console.log('[ws] Connected')
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WsMessage
        onMessage?.(msg.type, msg.data)
        
        // Call registered handlers
        const handlers = handlersRef.current.get(msg.type)
        if (handlers) {
          for (const handler of handlers) {
            handler(msg)
          }
        }
      } catch (error) {
        console.error('[ws] Failed to parse message:', error)
      }
    }

    ws.onclose = () => {
      setConnected(false)
      console.log('[ws] Disconnected')
    }

    ws.onerror = (error) => {
      console.error('[ws] Error:', error)
    }

    wsRef.current = ws

    return () => {
      ws.close()
    }
  }, [onMessage])

  const send = useCallback((type: string, data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, data }))
    }
  }, [])

  const subscribe = useCallback((type: string, handler: MessageHandler) => {
    if (!handlersRef.current.has(type)) {
      handlersRef.current.set(type, new Set())
    }
    handlersRef.current.get(type)!.add(handler)

    // Return unsubscribe function
    return () => {
      handlersRef.current.get(type)?.delete(handler)
    }
  }, [])

  return { connected, send, subscribe }
}
