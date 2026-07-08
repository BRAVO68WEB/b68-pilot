import { useState } from 'react'

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    staleDays: 15,
    staleCloseDays: 7,
    autoRelease: true,
    defaultBump: 'patch',
    discordWebhookUrl: '',
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    // TODO: Save settings to API
    setTimeout(() => setSaving(false), 1000)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="space-y-6">
        {/* Stale Issues */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Stale Issues</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Days before marking stale
              </label>
              <input
                type="number"
                value={settings.staleDays}
                onChange={e => setSettings(s => ({ ...s, staleDays: parseInt(e.target.value) }))}
                className="border rounded px-3 py-2 w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Days before closing
              </label>
              <input
                type="number"
                value={settings.staleCloseDays}
                onChange={e => setSettings(s => ({ ...s, staleCloseDays: parseInt(e.target.value) }))}
                className="border rounded px-3 py-2 w-full"
              />
            </div>
          </div>
        </section>

        {/* Release Settings */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Release</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Auto Release</p>
                <p className="text-sm text-gray-500">Create releases when PRs merge</p>
              </div>
              <button
                onClick={() => setSettings(s => ({ ...s, autoRelease: !s.autoRelease }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full ${settings.autoRelease ? 'bg-blue-600' : 'bg-gray-200'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${settings.autoRelease ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default version bump
              </label>
              <select
                value={settings.defaultBump}
                onChange={e => setSettings(s => ({ ...s, defaultBump: e.target.value }))}
                className="border rounded px-3 py-2"
              >
                <option value="patch">Patch</option>
                <option value="minor">Minor</option>
                <option value="major">Major</option>
              </select>
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Notifications</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Discord Webhook URL
            </label>
            <input
              type="url"
              value={settings.discordWebhookUrl}
              onChange={e => setSettings(s => ({ ...s, discordWebhookUrl: e.target.value }))}
              placeholder="https://discord.com/api/webhooks/..."
              className="border rounded px-3 py-2 w-full"
            />
          </div>
        </section>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}
