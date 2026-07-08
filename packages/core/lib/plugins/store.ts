import type { PluginDataStore } from '@pilot/plugin-sdk'
import type { PilotStore } from '../storage/sqlite'

/**
 * Plugin-scoped key-value store.
 * Each plugin gets isolated storage — plugins cannot read each other's data.
 */
export class PluginDataStoreImpl implements PluginDataStore {
  constructor(
    private readonly pluginName: string,
    private readonly store: PilotStore
  ) {}

  async get<T = unknown>(key: string): Promise<T | null> {
    const row = this.store.getPluginData(this.pluginName, key)
    if (!row) return null
    try {
      return JSON.parse(row.value) as T
    } catch {
      return row.value as unknown as T
    }
  }

  async set<T = unknown>(key: string, value: T): Promise<void> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value)
    this.store.setPluginData(this.pluginName, key, serialized)
  }

  async delete(key: string): Promise<void> {
    this.store.deletePluginData(this.pluginName, key)
  }

  async list(prefix?: string): Promise<Array<{ key: string; value: unknown }>> {
    const rows = this.store.listPluginData(this.pluginName, prefix)
    return rows.map((row) => ({
      key: row.key,
      value: (() => {
        try {
          return JSON.parse(row.value)
        } catch {
          return row.value
        }
      })(),
    }))
  }
}
