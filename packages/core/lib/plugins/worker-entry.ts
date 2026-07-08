// packages/core/lib/plugins/worker-entry.ts
// Worker thread entry point for plugin execution

import { parentPort, workerData } from 'worker_threads'

interface WorkerData {
  pluginName: string
  entryPath: string
  config: {
    timeout: number
    memoryLimit: number
  }
}

interface HookMessage {
  type: 'execute-hook'
  hookName: string
  event: any
  ctx: any
}

const { pluginName, entryPath, config } = workerData as WorkerData

let plugin: any = null

async function loadPlugin() {
  try {
    const module = await import(entryPath)
    plugin = module.default ?? module.plugin ?? module
    parentPort?.postMessage({ type: 'loaded', pluginName })
  } catch (error) {
    parentPort?.postMessage({ type: 'error', pluginName, error: String(error) })
  }
}

async function executeHook(message: HookMessage) {
  if (!plugin) {
    parentPort?.postMessage({ type: 'error', pluginName, error: 'Plugin not loaded' })
    return
  }

  const { hookName, event, ctx } = message
  const hook = plugin[hookName]

  if (!hook || typeof hook !== 'function') {
    parentPort?.postMessage({ type: 'hook-result', pluginName, hookName, result: null })
    return
  }

  try {
    const result = await hook(event, ctx)
    parentPort?.postMessage({ type: 'hook-result', pluginName, hookName, result })
  } catch (error) {
    parentPort?.postMessage({ type: 'error', pluginName, hookName, error: String(error) })
  }
}

// Listen for messages from main thread
parentPort?.on('message', async (message) => {
  if (message.type === 'load') {
    await loadPlugin()
  } else if (message.type === 'execute-hook') {
    await executeHook(message)
  } else if (message.type === 'unload') {
    process.exit(0)
  }
})

// Load plugin on start
loadPlugin()
