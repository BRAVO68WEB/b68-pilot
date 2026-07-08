// packages/core/lib/config/hot-reload.ts
// Config hot-reload with file watching

import { watch } from 'node:fs'
import { join } from 'node:path'
import type { RepoConfig } from '@pilot/plugin-sdk'
import type { ConfigStore } from './store'

export type ConfigChangeListener = (repo: string, config: RepoConfig) => void

export class ConfigHotReload {
  private readonly listeners = new Set<ConfigChangeListener>()
  private watcher: ReturnType<typeof watch> | null = null
  private readonly configDir: string

  constructor(
    private readonly configStore: ConfigStore,
    configDir?: string
  ) {
    this.configDir = configDir ?? join(process.cwd(), '.gh-pilot')
  }

  /**
   * Start watching for config changes
   */
  start(): void {
    if (this.watcher) return

    try {
      this.watcher = watch(this.configDir, { recursive: true }, (eventType, filename) => {
        if (!filename?.endsWith('.yml') && !filename?.endsWith('.yaml') && !filename?.endsWith('.json')) {
          return
        }

        console.log(`[config] Config file changed: ${filename}`)
        
        // Extract repo name from filename
        const repo = this.extractRepoFromFilename(filename)
        if (repo) {
          this.reloadRepo(repo)
        }
      })

      console.log(`[config] Watching ${this.configDir} for changes`)
    } catch (error) {
      console.error('[config] Failed to start watching:', error)
    }
  }

  /**
   * Stop watching
   */
  stop(): void {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
      console.log('[config] Stopped watching')
    }
  }

  /**
   * Subscribe to config changes
   */
  onChange(listener: ConfigChangeListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Reload config for a repo
   */
  private reloadRepo(repo: string): void {
    try {
      const config = this.configStore.getRepo(repo)
      
      // Notify listeners
      for (const listener of this.listeners) {
        try {
          listener(repo, config)
        } catch (error) {
          console.error(`[config] Listener error for ${repo}:`, error)
        }
      }
    } catch (error) {
      console.error(`[config] Failed to reload ${repo}:`, error)
    }
  }

  /**
   * Extract repo name from config filename
   * Supports: owner/repo.yml, owner-repo.json, etc.
   */
  private extractRepoFromFilename(filename: string): string | null {
    // Remove extension
    const base = filename.replace(/\.(yml|yaml|json)$/, '')
    
    // Try owner/repo format
    if (base.includes('/')) {
      return base
    }
    
    // Try owner-repo format
    const parts = base.split('-')
    if (parts.length >= 2) {
      return parts.join('/')
    }
    
    return null
  }
}
