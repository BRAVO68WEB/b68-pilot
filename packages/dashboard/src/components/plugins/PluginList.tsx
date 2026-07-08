import { useAsync } from '../../hooks/useAsync'
import { listPlugins } from '../../lib/api'

export default function PluginList() {
  const { data: plugins, loading, error } = useAsync(() => listPlugins())

  if (loading) return <div className="text-center py-8">Loading...</div>
  if (error) return <div className="text-center py-8 text-red-600">{error}</div>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Plugins</h1>
      {plugins && plugins.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
          No plugins installed. Add plugins to <code className="bg-gray-100 px-2 py-1 rounded">~/.config/gh-pilot/plugins/</code>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plugins?.map((plugin) => (
            <div key={plugin.name} className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-2">{plugin.name}</h3>
              <p className="text-sm text-gray-500 mb-4">{plugin.description ?? 'No description'}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">v{plugin.version}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
