import { useParams } from 'react-router-dom'
import { useAsync } from '../../hooks/useAsync'
import { getRepoConfig, updateRepoConfig } from '../../lib/api'
import { useState } from 'react'
import type { RepoConfig } from '../../types'

export default function RepoConfig() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>()
  const fullName = `${owner}/${repo}`
  const { data: config, loading, error, refetch } = useAsync(() => getRepoConfig(owner!, repo!), [owner, repo])
  const [saving, setSaving] = useState(false)

  if (loading) return <div className="text-center py-8">Loading...</div>
  if (error) return <div className="text-center py-8 text-red-600">{error}</div>
  if (!config) return null

  const handleToggle = async (field: keyof RepoConfig) => {
    if (!config) return
    setSaving(true)
    try {
      const updated = { ...config, [field]: !config[field] }
      await updateRepoConfig(owner!, repo!, updated)
      refetch()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{fullName}</h1>

      {/* General Settings */}
      <section className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">General</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Enabled</p>
              <p className="text-sm text-gray-500">Enable gh-pilot for this repository</p>
            </div>
            <button
              onClick={() => handleToggle('enabled')}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full ${config.enabled ? 'bg-blue-600' : 'bg-gray-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${config.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>
      </section>

      {/* Automation Settings */}
      <section className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Automation</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Auto Release</p>
              <p className="text-sm text-gray-500">Create releases when PRs are merged</p>
            </div>
            <button
              onClick={async () => {
                setSaving(true)
                try {
                  await updateRepoConfig(owner!, repo!, {
                    ...config,
                    automation: { ...config.automation, autoRelease: !config.automation.autoRelease },
                  })
                  refetch()
                } finally {
                  setSaving(false)
                }
              }}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full ${config.automation.autoRelease ? 'bg-blue-600' : 'bg-gray-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${config.automation.autoRelease ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div>
            <label className="block font-medium mb-1">Default Bump</label>
            <select
              value={config.automation.defaultBump}
              onChange={async (e) => {
                setSaving(true)
                try {
                  await updateRepoConfig(owner!, repo!, {
                    ...config,
                    automation: { ...config.automation, defaultBump: e.target.value as any },
                  })
                  refetch()
                } finally {
                  setSaving(false)
                }
              }}
              className="border rounded px-3 py-2"
            >
              <option value="patch">Patch</option>
              <option value="minor">Minor</option>
              <option value="major">Major</option>
            </select>
          </div>
        </div>
      </section>

      {/* Plugins */}
      <section className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Plugins</h2>
        {config.plugins.length === 0 ? (
          <p className="text-gray-500">No plugins configured.</p>
        ) : (
          <div className="space-y-3">
            {config.plugins.map((plugin) => (
              <div key={plugin.name} className="flex items-center justify-between border-b pb-3">
                <div>
                  <p className="font-medium">{plugin.name}</p>
                  <p className="text-sm text-gray-500">
                    {Object.keys(plugin.settings).length} settings
                  </p>
                </div>
                <button
                  onClick={async () => {
                    setSaving(true)
                    try {
                      await updateRepoConfig(owner!, repo!, {
                        ...config,
                        plugins: config.plugins.map((p) =>
                          p.name === plugin.name ? { ...p, enabled: !p.enabled } : p
                        ),
                      })
                      refetch()
                    } finally {
                      setSaving(false)
                    }
                  }}
                  disabled={saving}
                  className={`px-3 py-1 rounded text-sm ${plugin.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
                >
                  {plugin.enabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Rules */}
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Rules</h2>
        {config.rules.length === 0 ? (
          <p className="text-gray-500">No rules configured.</p>
        ) : (
          <div className="space-y-3">
            {config.rules.map((rule) => (
              <div key={rule.id} className="border-b pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{rule.name}</p>
                    <p className="text-sm text-gray-500">
                      Trigger: {rule.event} • {rule.conditions.length} conditions • {rule.actions.length} actions
                    </p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${rule.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {rule.enabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
