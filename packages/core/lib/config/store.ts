import type { RepoConfig, PluginConfig, RuleConfig } from '@pilot/plugin-sdk'
import type { PilotStore } from '../storage/sqlite'

/**
 * Config store — manages per-repo configuration in SQLite.
 * The dashboard writes configs here; the worker reads them.
 */
export class ConfigStore {
  constructor(private readonly store: PilotStore) {}

  /** Get config for a repo. Returns default config if none exists. */
  getRepo(repo: string): RepoConfig {
    const json = this.store.getRepoConfig(repo)
    if (!json) return this.defaultConfig(repo)
    try {
      return JSON.parse(json) as RepoConfig
    } catch {
      return this.defaultConfig(repo)
    }
  }

  /** Save config for a repo */
  saveRepo(repo: string, config: RepoConfig): void {
    this.validateConfig(config)
    this.store.setRepoConfig(repo, JSON.stringify(config))
  }

  /** Delete config for a repo */
  deleteRepo(repo: string): void {
    this.store.deleteRepoConfig(repo)
  }

  /** List all configured repos */
  listRepos(): Array<{ repo: string; config: RepoConfig; updatedAt: string }> {
    const rows = this.store.listRepoConfigs()
    return rows.map((row) => ({
      repo: row.repo,
      config: (() => {
        try {
          return JSON.parse(row.config_json) as RepoConfig
        } catch {
          return this.defaultConfig(row.repo)
        }
      })(),
      updatedAt: row.updated_at,
    }))
  }

  /** Update a single plugin's config within a repo */
  updatePluginConfig(repo: string, pluginName: string, settings: Record<string, unknown>): void {
    const config = this.getRepo(repo)
    const existing = config.plugins.find((p) => p.name === pluginName)
    if (existing) {
      existing.settings = settings
    } else {
      config.plugins.push({ name: pluginName, enabled: true, settings })
    }
    this.saveRepo(repo, config)
  }

  /** Enable/disable a plugin for a repo */
  setPluginEnabled(repo: string, pluginName: string, enabled: boolean): void {
    const config = this.getRepo(repo)
    const existing = config.plugins.find((p) => p.name === pluginName)
    if (existing) {
      existing.enabled = enabled
    } else if (enabled) {
      config.plugins.push({ name: pluginName, enabled: true, settings: {} })
    }
    this.saveRepo(repo, config)
  }

  /** Add a rule to a repo */
  addRule(repo: string, rule: RuleConfig): void {
    const config = this.getRepo(repo)
    config.rules.push(rule)
    this.saveRepo(repo, config)
  }

  /** Update a rule in a repo */
  updateRule(repo: string, ruleId: string, updates: Partial<RuleConfig>): void {
    const config = this.getRepo(repo)
    const idx = config.rules.findIndex((r) => r.id === ruleId)
    if (idx === -1) throw new Error(`Rule ${ruleId} not found`)
    config.rules[idx] = { ...config.rules[idx], ...updates }
    this.saveRepo(repo, config)
  }

  /** Delete a rule from a repo */
  deleteRule(repo: string, ruleId: string): void {
    const config = this.getRepo(repo)
    config.rules = config.rules.filter((r) => r.id !== ruleId)
    this.saveRepo(repo, config)
  }

  /** Validate a config object */
  private validateConfig(config: RepoConfig): void {
    if (!config.repo) throw new Error('Config missing "repo" field')
    if (!Array.isArray(config.plugins)) throw new Error('Config "plugins" must be an array')
    if (!Array.isArray(config.rules)) throw new Error('Config "rules" must be an array')

    // Validate each plugin config
    for (const plugin of config.plugins) {
      if (!plugin.name) throw new Error('Plugin config missing "name"')
      if (typeof plugin.enabled !== 'boolean') throw new Error(`Plugin "${plugin.name}" missing "enabled" boolean`)
    }

    // Validate each rule
    for (const rule of config.rules) {
      if (!rule.id) throw new Error('Rule missing "id"')
      if (!rule.name) throw new Error('Rule missing "name"')
      if (!rule.event) throw new Error('Rule missing "event"')
      if (!Array.isArray(rule.conditions)) throw new Error('Rule "conditions" must be an array')
      if (!Array.isArray(rule.actions)) throw new Error('Rule "actions" must be an array')
    }
  }

  /** Generate a default config for a repo */
  private defaultConfig(repo: string): RepoConfig {
    return {
      repo,
      enabled: true,
      plugins: [],
      rules: [],
      commands: [],
      notifications: {},
      automation: {
        autoRelease: true,
        defaultBump: 'patch',
        staleDays: 15,
        staleCloseDays: 7,
        reviewStrategy: 'round-robin',
        reviewers: [],
      },
    }
  }
}
