import type {
  PilotPlugin,
  PluginManifest,
  LoadedPlugin,
  PluginContext,
  TriggerEvent,
  TriggerResult,
  WebhookEvent,
  CommandDefinition,
} from '@pilot/plugin-sdk'
import { loadPlugin, loadPluginManifest } from './loader'
import { createPluginSandbox } from './sandbox'
import { PluginDataStoreImpl } from './store'
import type { GitHubInstallationClient } from '../github/installation-client'
import type { PilotStore } from '../storage/sqlite'
import type { RepoConfig } from '@pilot/plugin-sdk'

export interface PluginManagerConfig {
  /** Directory containing local plugins */
  pluginDir: string

  /** Global enable/disable */
  enabled: boolean
}

export class PluginManager {
  private readonly plugins = new Map<string, LoadedPlugin>()
  private readonly dataStores = new Map<string, PluginDataStoreImpl>()
  private readonly config: PluginManagerConfig

  constructor(
    config: PluginManagerConfig,
    private readonly store: PilotStore
  ) {
    this.config = config
  }

  /** Load all plugins from the plugin directory */
  async loadAll(): Promise<void> {
    if (!this.config.enabled) return

    try {
      const manifests = await this.discoverPlugins()
      for (const manifest of manifests) {
        await this.load(manifest)
      }
    } catch (error) {
      console.error('[plugin-manager] Failed to load plugins:', error)
    }
  }

  /** Load a single plugin by manifest */
  async load(manifest: PluginManifest): Promise<void> {
    try {
      const instance = await loadPlugin(manifest, this.config.pluginDir)
      const loaded: LoadedPlugin = {
        manifest,
        instance,
        enabled: true,
        loadedAt: new Date().toISOString(),
      }

      // Create data store for this plugin
      const dataStore = new PluginDataStoreImpl(manifest.name, this.store)
      this.dataStores.set(manifest.name, dataStore)

      this.plugins.set(manifest.name, loaded)
      console.log(`[plugin-manager] Loaded plugin: ${manifest.name}@${manifest.version}`)
    } catch (error) {
      console.error(`[plugin-manager] Failed to load plugin ${manifest.name}:`, error)
      this.plugins.set(manifest.name, {
        manifest,
        instance: {} as PilotPlugin,
        enabled: false,
        loadedAt: new Date().toISOString(),
        error: String(error),
      })
    }
  }

  /** Unload a plugin */
  async unload(name: string): Promise<void> {
    const loaded = this.plugins.get(name)
    if (!loaded) return

    this.dataStores.delete(name)
    this.plugins.delete(name)
    console.log(`[plugin-manager] Unloaded plugin: ${name}`)
  }

  /** Execute onInit hooks for all loaded plugins */
  async initAll(ctxFactory: (pluginName: string) => PluginContext): Promise<void> {
    for (const [name, loaded] of this.plugins) {
      if (!loaded.enabled || !loaded.instance.onInit) continue
      try {
        const ctx = ctxFactory(name)
        await loaded.instance.onInit(ctx)
      } catch (error) {
        console.error(`[plugin-manager] onInit failed for ${name}:`, error)
      }
    }
  }

  /** Execute onEntry hooks for matching plugins */
  async executeEntryHooks(
    event: WebhookEvent,
    ctxFactory: (pluginName: string) => PluginContext
  ): Promise<void> {
    for (const [name, loaded] of this.plugins) {
      if (!loaded.enabled || !loaded.instance.onEntry) continue
      if (!this.matchesEvents(loaded, event.event)) continue
      try {
        const ctx = ctxFactory(name)
        const sandbox = createPluginSandbox(loaded.instance, name)
        await sandbox.executeHook('onEntry', () => loaded.instance.onEntry!(event, ctx))
      } catch (error) {
        console.error(`[plugin-manager] onEntry failed for ${name}:`, error)
      }
    }
  }

  /** Execute onTrigger hooks — first plugin with handled=true wins */
  async executeTriggerHooks(
    event: TriggerEvent,
    ctxFactory: (pluginName: string) => PluginContext
  ): Promise<TriggerResult | null> {
    for (const [name, loaded] of this.plugins) {
      if (!loaded.enabled || !loaded.instance.onTrigger) continue
      if (!this.matchesEvents(loaded, event.event)) continue
      try {
        const ctx = ctxFactory(name)
        const sandbox = createPluginSandbox(loaded.instance, name)
        const result = await sandbox.executeHook('onTrigger', () =>
          loaded.instance.onTrigger!(event, ctx)
        )
        if (result?.handled) return result
      } catch (error) {
        console.error(`[plugin-manager] onTrigger failed for ${name}:`, error)
      }
    }
    return null
  }

  /** Execute onExit hooks for matching plugins */
  async executeExitHooks(
    event: WebhookEvent,
    ctxFactory: (pluginName: string) => PluginContext
  ): Promise<void> {
    for (const [name, loaded] of this.plugins) {
      if (!loaded.enabled || !loaded.instance.onExit) continue
      if (!this.matchesEvents(loaded, event.event)) continue
      try {
        const ctx = ctxFactory(name)
        const sandbox = createPluginSandbox(loaded.instance, name)
        await sandbox.executeHook('onExit', () => loaded.instance.onExit!(event, ctx))
      } catch (error) {
        console.error(`[plugin-manager] onExit failed for ${name}:`, error)
      }
    }
  }

  /** Execute onError hooks for all plugins */
  async executeErrorHooks(
    error: Error,
    event: WebhookEvent,
    ctxFactory: (pluginName: string) => PluginContext
  ): Promise<void> {
    for (const [name, loaded] of this.plugins) {
      if (!loaded.enabled || !loaded.instance.onError) continue
      try {
        const ctx = ctxFactory(name)
        await loaded.instance.onError(error, event, ctx)
      } catch (hookError) {
        console.error(`[plugin-manager] onError failed for ${name}:`, hookError)
      }
    }
  }

  /** Get all registered commands from all plugins */
  getCommands(): Array<{ command: CommandDefinition; pluginName: string }> {
    const commands: Array<{ command: CommandDefinition; pluginName: string }> = []
    for (const [name, loaded] of this.plugins) {
      if (!loaded.enabled || !loaded.instance.commands) continue
      for (const cmd of loaded.instance.commands) {
        commands.push({ command: cmd, pluginName: name })
      }
    }
    return commands
  }

  /** List all loaded plugins */
  list(): LoadedPlugin[] {
    return Array.from(this.plugins.values())
  }

  /** Get a specific plugin */
  get(name: string): LoadedPlugin | undefined {
    return this.plugins.get(name)
  }

  /** Enable/disable a plugin */
  setEnabled(name: string, enabled: boolean): void {
    const loaded = this.plugins.get(name)
    if (loaded) {
      loaded.enabled = enabled
      console.log(`[plugin-manager] Plugin ${name} ${enabled ? 'enabled' : 'disabled'}`)
    }
  }

  /** Get the data store for a plugin */
  getDataStore(pluginName: string): PluginDataStoreImpl | undefined {
    return this.dataStores.get(pluginName)
  }

  /** Check if a plugin wants to receive a specific event */
  private matchesEvents(loaded: LoadedPlugin, event: string): boolean {
    if (!loaded.instance.events || loaded.instance.events.length === 0) return true
    if (loaded.instance.events.includes('*')) return true
    return loaded.instance.events.includes(event)
  }

  /** Discover plugin manifests from the plugin directory */
  private async discoverPlugins(): Promise<PluginManifest[]> {
    // This is a simplified version — in production, scan the directory
    // and read plugin.json files
    const manifests: PluginManifest[] = []
    // TODO: Implement directory scanning
    return manifests
  }
}
