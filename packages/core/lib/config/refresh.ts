import type { RepoConfig } from '@pilot/plugin-sdk'

/**
 * Config refresh mechanism — allows the dashboard to push config updates
 * to the worker in real-time.
 *
 * Uses a simple polling approach as fallback when WebSocket isn't available.
 */

export type ConfigRefreshListener = (repo: string, config: RepoConfig) => void

export class ConfigRefreshManager {
  private readonly listeners = new Map<string, Set<ConfigRefreshListener>>()
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private lastRefresh = new Map<string, string>() // repo → last config hash

  constructor(
    private readonly configGetter: (repo: string) => RepoConfig,
    private readonly pollIntervalMs: number = 30_000 // 30 seconds
  ) {}

  /** Subscribe to config changes for a specific repo */
  on(repo: string, listener: ConfigRefreshListener): () => void {
    if (!this.listeners.has(repo)) {
      this.listeners.set(repo, new Set())
    }
    this.listeners.get(repo)!.add(listener)

    // Return unsubscribe function
    return () => {
      this.listeners.get(repo)?.delete(listener)
    }
  }

  /** Subscribe to config changes for all repos */
  onAny(listener: ConfigRefreshListener): () => void {
    return this.on('*', listener)
  }

  /** Notify listeners that a repo's config has changed */
  notify(repo: string, config: RepoConfig): void {
    const hash = this.hashConfig(config)

    // Skip if config hasn't changed
    if (this.lastRefresh.get(repo) === hash) return
    this.lastRefresh.set(repo, hash)

    // Notify repo-specific listeners
    const repoListeners = this.listeners.get(repo)
    if (repoListeners) {
      for (const listener of repoListeners) {
        try {
          listener(repo, config)
        } catch (error) {
          console.error(`[config-refresh] Listener error for ${repo}:`, error)
        }
      }
    }

    // Notify wildcard listeners
    const anyListeners = this.listeners.get('*')
    if (anyListeners) {
      for (const listener of anyListeners) {
        try {
          listener(repo, config)
        } catch (error) {
          console.error(`[config-refresh] Wildcard listener error:`, error)
        }
      }
    }
  }

  /** Start polling for config changes */
  startPolling(): void {
    if (this.pollTimer) return

    this.pollTimer = setInterval(() => {
      this.checkAll()
    }, this.pollIntervalMs)
  }

  /** Stop polling */
  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  /** Check all repos for config changes */
  private checkAll(): void {
    // This is a simplified version — in production, you'd query the DB
    // for all repos and check each one
    for (const [repo] of this.listeners) {
      if (repo === '*') continue
      try {
        const config = this.configGetter(repo)
        this.notify(repo, config)
      } catch (error) {
        console.error(`[config-refresh] Error checking config for ${repo}:`, error)
      }
    }
  }

  /** Simple hash to detect config changes */
  private hashConfig(config: RepoConfig): string {
    return JSON.stringify(config)
  }
}
