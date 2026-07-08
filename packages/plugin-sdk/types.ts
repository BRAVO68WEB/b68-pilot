/**
 * Core plugin interface — every plugin must implement this.
 *
 * Lifecycle order:
 *   onInit → onEntry → onTrigger → onExit
 *   onError fires on any unhandled error during the above.
 */
import type { PluginContext } from './context'
import type { TriggerEvent, TriggerResult, WebhookEvent } from './events'
import type { CommandDefinition } from './commands'

export interface PilotPlugin {
  /** Unique plugin name (used as key in config and data store) */
  name: string

  /** Semver version */
  version: string

  /** Human-readable description */
  description?: string

  /** Author name or GitHub handle */
  author?: string

  /** Called once when the plugin is loaded by the PluginManager */
  onInit?(ctx: PluginContext): Promise<void> | void

  /**
   * Called for every webhook event that matches the plugin's declared events.
   * Return `TriggerResult` to short-circuit (handled=true stops later plugins).
   * Return null/undefined to pass to the next plugin.
   */
  onTrigger?(event: TriggerEvent, ctx: PluginContext): Promise<TriggerResult | null> | TriggerResult | null

  /** Called before built-in event handling — use for pre-processing */
  onEntry?(event: WebhookEvent, ctx: PluginContext): Promise<void> | void

  /** Called after built-in event handling — use for post-processing */
  onExit?(event: WebhookEvent, ctx: PluginContext): Promise<void> | void

  /** Called when any lifecycle hook throws. Use for cleanup/alerting. */
  onError?(error: Error, event: WebhookEvent, ctx: PluginContext): Promise<void> | void

  /** Custom bot commands this plugin provides */
  commands?: CommandDefinition[]

  /**
   * Webhook events this plugin wants to receive.
   * Omit or set to ['*'] to receive all events.
   * Examples: ['pull_request', 'issues', 'issue_comment']
   */
  events?: string[]

  /** Plugin settings schema — dashboard uses this to render config UI */
  settings?: SettingDefinition[]
}

/** Manifest for plugin discovery (what the loader reads) */
export interface PluginManifest {
  name: string
  version: string
  description?: string
  author?: string
  entry: string
  commands?: string[]
  hooks?: Array<'onInit' | 'onTrigger' | 'onEntry' | 'onExit' | 'onError'>
  events?: string[]
  permissions?: PluginPermission[]
  settings?: SettingDefinition[]
}

/** Permissions a plugin can request */
export type PluginPermission =
  | 'github:comment'
  | 'github:label'
  | 'github:assign'
  | 'github:merge'
  | 'github:close'
  | 'github:review'
  | 'github:read'
  | 'store:read'
  | 'store:write'
  | 'config:read'

/** A single setting definition (used by dashboard to render forms) */
export interface SettingDefinition {
  key: string
  label: string
  type: 'string' | 'number' | 'boolean' | 'select' | 'multi-select' | 'json'
  description?: string
  default?: unknown
  required?: boolean
  options?: Array<{ label: string; value: string }>
}

/** Loaded plugin with its runtime state */
export interface LoadedPlugin {
  manifest: PluginManifest
  instance: PilotPlugin
  enabled: boolean
  loadedAt: string
  error?: string
}
