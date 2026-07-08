// packages/core/lib/plugins/runtime.ts
// Plugin runtime with Worker thread isolation

import type { PilotPlugin, PluginManifest, PluginContext, TriggerEvent, TriggerResult, WebhookEvent } from '@pilot/plugin-sdk'
import { Worker } from 'worker_threads'
import { join } from 'node:path'

export interface PluginRuntimeConfig {
  timeout: number        // ms
  memoryLimit: number    // MB
}

const DEFAULT_CONFIG: PluginRuntimeConfig = {
  timeout: 5000,
  memoryLimit: 64,
}

export class PluginRuntime {
  private readonly workers = new Map<string, Worker>()
  private readonly configs = new Map<string, PluginRuntimeConfig>()

  constructor(private readonly pluginDir: string) {}

  /**
   * Load a plugin in an isolated Worker thread
   */
  async load(manifest: PluginManifest, config?: Partial<PluginRuntimeConfig>): Promise<void> {
    const fullConfig = { ...DEFAULT_CONFIG, ...config }
    this.configs.set(manifest.name, fullConfig)

    const entryPath = join(this.pluginDir, manifest.name, manifest.entry)
    
    const worker = new Worker(join(__dirname, 'worker-entry.js'), {
      workerData: {
        pluginName: manifest.name,
        entryPath,
        config: fullConfig,
      },
    })

    worker.on('error', (error) => {
      console.error(`[plugin-runtime] Worker error for ${manifest.name}:`, error)
    })

    worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`[plugin-runtime] Worker exited with code ${code} for ${manifest.name}`)
      }
      this.workers.delete(manifest.name)
    })

    this.workers.set(manifest.name, worker)
  }

  /**
   * Execute a plugin hook in its isolated Worker
   */
  async executeHook<T>(
    pluginName: string,
    hookName: string,
    event: WebhookEvent | TriggerEvent,
    ctx: PluginContext
  ): Promise<T | null> {
    const worker = this.workers.get(pluginName)
    if (!worker) return null

    const config = this.configs.get(pluginName) ?? DEFAULT_CONFIG

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Plugin ${pluginName}:${hookName} timed out after ${config.timeout}ms`))
      }, config.timeout)

      worker.postMessage({
        type: 'execute-hook',
        hookName,
        event,
        ctx: serializeContext(ctx),
      })

      worker.once('message', (result) => {
        clearTimeout(timeout)
        resolve(result)
      })

      worker.once('error', (error) => {
        clearTimeout(timeout)
        reject(error)
      })
    })
  }

  /**
   * Unload a plugin and terminate its Worker
   */
  async unload(pluginName: string): Promise<void> {
    const worker = this.workers.get(pluginName)
    if (worker) {
      await worker.terminate()
      this.workers.delete(pluginName)
      this.configs.delete(pluginName)
    }
  }

  /**
   * Unload all plugins
   */
  async unloadAll(): Promise<void> {
    for (const [name] of this.workers) {
      await this.unload(name)
    }
  }

  /**
   * Get loaded plugin names
   */
  getLoadedPlugins(): string[] {
    return Array.from(this.workers.keys())
  }
}

/**
 * Serialize context for Worker message passing
 * (Functions can't be passed to Workers)
 */
function serializeContext(ctx: PluginContext): Record<string, unknown> {
  return {
    repo: ctx.repo,
    installationId: ctx.installationId,
    config: ctx.config,
  }
}
