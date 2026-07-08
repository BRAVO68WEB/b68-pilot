// packages/dashboard/src/components/common/ConnectionStatus.tsx
// WebSocket connection status indicator

import { useWebSocket } from '../../hooks/useWebSocket'

export default function ConnectionStatus() {
  const { connected } = useWebSocket()

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
      <span className="text-xs text-gray-500">
        {connected ? 'Connected' : 'Disconnected'}
      </span>
    </div>
  )
}
