import type { PilotPlugin, PluginManifest } from '@pilot/plugin-sdk'
import { join } from 'node:path'
import { existsSync, readdirSync, readFileSync } from 'node:fs'

/**
 * Load plugins from filesystem or npm packages.
 *
 * Plugin structure:
 *   plugin-name/
 *   ├── plugin.json        (manifest)
 *   └── index.ts           (entry point exporting PilotPlugin)
 */

/** Load a plugin manifest from a directory */
export async function loadPluginManifest(pluginDir: string): Promise<PluginManifest | null> {
  const manifestPath = join(pluginDir, 'plugin.json')
  if (!existsSync(manifestPath)) return null

  try {
    const raw = readFileSync(manifestPath, 'utf-8')
    const manifest = JSON.parse(raw) as PluginManifest
    validateManifest(manifest)
    return manifest
  } catch (error) {
    console.error(`[plugin-loader] Invalid manifest in ${pluginDir}:`, error)
    return null
  }
}

/** Load a plugin instance from its manifest and directory */
export async function loadPlugin(
  manifest: PluginManifest,
  baseDir: string
): Promise<PilotPlugin> {
  const pluginDir = join(baseDir, manifest.name)
  const entryPath = join(pluginDir, manifest.entry)

  if (!existsSync(entryPath)) {
    throw new Error(`Plugin entry point not found: ${entryPath}`)
  }

  try {
    // Dynamic import of the plugin module
    const module = await import(entryPath)

    // Plugin can export default or named export
    const plugin: PilotPlugin = module.default ?? module.plugin ?? module

    validatePlugin(plugin, manifest)
    return plugin
  } catch (error) {
    throw new Error(`Failed to load plugin ${manifest.name}: ${error}`)
  }
}

/** Discover all plugins in a directory */
export async function discoverPlugins(pluginDir: string): Promise<PluginManifest[]> {
  if (!existsSync(pluginDir)) return []

  const manifests: PluginManifest[] = []
  const entries = readdirSync(pluginDir, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const manifest = await loadPluginManifest(join(pluginDir, entry.name))
    if (manifest) manifests.push(manifest)
  }

  return manifests
}

/** Validate a plugin manifest has required fields */
function validateManifest(manifest: PluginManifest): void {
  if (!manifest.name) throw new Error('Plugin manifest missing "name"')
  if (!manifest.version) throw new Error('Plugin manifest missing "version"')
  if (!manifest.entry) throw new Error('Plugin manifest missing "entry"')
}

/** Validate a plugin instance matches its manifest */
function validatePlugin(plugin: PilotPlugin, manifest: PluginManifest): void {
  if (!plugin.name) throw new Error('Plugin missing "name" property')
  if (!plugin.version) throw new Error('Plugin missing "version" property')

  // Warn if plugin name doesn't match manifest
  if (plugin.name !== manifest.name) {
    console.warn(
      `[plugin-loader] Plugin name mismatch: manifest="${manifest.name}", instance="${plugin.name}"`
    )
  }
}

/** Load a plugin from an npm package name */
export async function loadPluginFromNpm(packageName: string): Promise<PilotPlugin> {
  try {
    const module = await import(packageName)
    const plugin: PilotPlugin = module.default ?? module.plugin ?? module
    if (!plugin.name || !plugin.version) {
      throw new Error(`Invalid plugin export from ${packageName}`)
    }
    return plugin
  } catch (error) {
    throw new Error(`Failed to load plugin from ${packageName}: ${error}`)
  }
}
