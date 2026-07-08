import { useEffect, useRef, useCallback, useState } from 'react'

export type WsMessageHandler = (type: string, data: unknown) => void

/**
 * WebSocket hook for real-time updates from the worker.
 */
export function useWebSocket(onMessage?: WsMessageHandler) {
  const wsRef = useRef<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`)

    ws.onopen = () => {
      setConnected(true)
      console.log('[ws] Connected')
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        onMessage?.(msg.type, msg.data)
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

  return { connected, send }
}
