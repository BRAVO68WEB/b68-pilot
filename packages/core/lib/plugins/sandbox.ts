import type { PilotPlugin } from '@pilot/plugin-sdk'

/**
 * Plugin execution sandbox — provides timeout protection and error isolation.
 * This is NOT a security sandbox (JS doesn't have true sandboxing without Workers).
 * It prevents plugins from crashing the main process and enforces execution limits.
 */

const DEFAULT_TIMEOUT_MS = 5000 // 5 seconds per hook

export interface SandboxConfig {
  /** Max execution time per hook call (ms) */
  timeoutMs: number

  /** Plugin name for logging */
  pluginName: string
}

export interface PluginSandbox {
  /** Execute a hook with timeout and error isolation */
  executeHook<T>(hookName: string, fn: () => Promise<T> | T): Promise<T | null>
}

export function createPluginSandbox(
  _plugin: PilotPlugin,
  pluginName: string,
  config?: Partial<SandboxConfig>
): PluginSandbox {
  const timeoutMs = config?.timeoutMs ?? DEFAULT_TIMEOUT_MS

  return {
    async executeHook<T>(hookName: string, fn: () => Promise<T> | T): Promise<T | null> {
      const start = Date.now()
      const label = `[${pluginName}:${hookName}]`

      try {
        // Race the hook against a timeout
        const result = await Promise.race([
          Promise.resolve(fn()),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
          ),
        ])

        const elapsed = Date.now() - start
        if (elapsed > timeoutMs * 0.8) {
          console.warn(`${label} took ${elapsed}ms (close to ${timeoutMs}ms timeout)`)
        }

        return result
      } catch (error) {
        const elapsed = Date.now() - start
        console.error(`${label} failed after ${elapsed}ms:`, error)
        return null
      }
    },
  }
}
