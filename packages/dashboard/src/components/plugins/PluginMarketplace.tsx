// packages/dashboard/src/components/plugins/PluginMarketplace.tsx
// Plugin marketplace UI

import { useState, useEffect } from 'react'
import { listPlugins } from '../../lib/api'

interface Plugin {
  name: string
  version: string
  description?: string
  enabled?: boolean
}

export default function PluginMarketplace() {
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [loading, setLoading] = useState(true)
  const [installing, setInstalling] = useState<string | null>(null)

  useEffect(() => {
    loadPlugins()
  }, [])

  async function loadPlugins() {
    try {
      const data = await listPlugins()
      setPlugins(data)
    } catch (error) {
      console.error('Failed to load plugins:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleInstall(pluginName: string) {
    setInstalling(pluginName)
    // TODO: Implement plugin installation
    setTimeout(() => setInstalling(null), 1000)
  }

  if (loading) {
    return <div className="text-center py-8">Loading plugins...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Plugin Marketplace</h1>
        <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Install from URL
        </button>
      </div>

      {plugins.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500 mb-4">No plugins installed yet.</p>
          <p className="text-sm text-gray-400">
            Install plugins from npm, GitHub, or local path.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plugins.map(plugin => (
            <div key={plugin.name} className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-semibold">{plugin.name}</h3>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  plugin.enabled 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {plugin.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              
              <p className="text-sm text-gray-500 mb-4">
                {plugin.description || 'No description'}
              </p>
              
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">v{plugin.version}</span>
                <button
                  onClick={() => handleInstall(plugin.name)}
                  disabled={installing === plugin.name}
                  className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
                >
                  {installing === plugin.name ? 'Installing...' : 'Configure'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
