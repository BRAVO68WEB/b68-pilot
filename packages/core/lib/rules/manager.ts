// packages/core/lib/rules/manager.ts
// Rule manager - loads and manages rules per repo

import type { Rule, RuleConfig } from './schema'
import { DEFAULT_RULE_CONFIG } from './schema'
import type { PilotStore } from '../storage/sqlite'

export class RuleManager {
  private readonly configs = new Map<string, RuleConfig>()

  constructor(private readonly store: PilotStore) {}

  /**
   * Load rules for a repo from config
   */
  loadRepoRules(repo: string): RuleConfig {
    const configJson = this.store.getRepoConfig(repo)
    if (!configJson) {
      return DEFAULT_RULE_CONFIG
    }

    try {
      const config = JSON.parse(configJson) as any
      const ruleConfig: RuleConfig = {
        rules: config.rules ?? [],
        defaults: config.defaults ?? DEFAULT_RULE_CONFIG.defaults,
      }
      this.configs.set(repo, ruleConfig)
      return ruleConfig
    } catch {
      return DEFAULT_RULE_CONFIG
    }
  }

  /**
   * Get rules for a repo
   */
  getRules(repo: string): Rule[] {
    return this.configs.get(repo)?.rules ?? []
  }

  /**
   * Add a rule to a repo
   */
  addRule(repo: string, rule: Rule): void {
    const config = this.configs.get(repo) ?? { ...DEFAULT_RULE_CONFIG }
    config.rules.push(rule)
    this.saveConfig(repo, config)
  }

  /**
   * Update a rule in a repo
   */
  updateRule(repo: string, ruleName: string, updates: Partial<Rule>): void {
    const config = this.configs.get(repo)
    if (!config) return

    const index = config.rules.findIndex(r => r.name === ruleName)
    if (index === -1) return

    config.rules[index] = { ...config.rules[index], ...updates }
    this.saveConfig(repo, config)
  }

  /**
   * Delete a rule from a repo
   */
  deleteRule(repo: string, ruleName: string): void {
    const config = this.configs.get(repo)
    if (!config) return

    config.rules = config.rules.filter(r => r.name !== ruleName)
    this.saveConfig(repo, config)
  }

  /**
   * Enable/disable a rule
   */
  setRuleEnabled(repo: string, ruleName: string, enabled: boolean): void {
    this.updateRule(repo, ruleName, { enabled })
  }

  /**
   * Save config to store
   */
  private saveConfig(repo: string, config: RuleConfig): void {
    this.configs.set(repo, config)
    
    // Get existing repo config and merge rules
    const existingJson = this.store.getRepoConfig(repo)
    let existing: any = {}
    
    if (existingJson) {
      try {
        existing = JSON.parse(existingJson)
      } catch {
        // Ignore parse errors
      }
    }

    existing.rules = config.rules
    existing.defaults = config.defaults
    
    this.store.setRepoConfig(repo, JSON.stringify(existing))
  }
}
