import type { PilotPlugin, TriggerEvent, PluginContext, TriggerResult } from '@pilot/plugin-sdk'

export default {
  name: 'label-sync',
  version: '1.0.0',
  description: 'Sync labels across repositories',

  events: ['pull_request'],

  commands: [
    {
      name: 'sync-labels',
      description: 'Sync labels from source repository',
      usage: 'sync-labels',
      handler: async (args: string[], ctx: any) => {
        const settings = ctx.config.plugins.find(p => p.name === 'label-sync')?.settings
        const sourceRepo = settings?.sourceRepo as string

        if (!sourceRepo) {
          return { message: 'Source repository not configured. Set `sourceRepo` in plugin settings.', acted: false }
        }

        // TODO: Implement label sync from source repo
        return { message: `Label sync from ${sourceRepo} initiated.`, acted: true }
      },
    },
  ],

  onTrigger: async (event: TriggerEvent, ctx: PluginContext): Promise<TriggerResult | null> => {
    // Only trigger on PR open
    if (event.action !== 'opened') {
      return null
    }

    const settings = ctx.config.plugins.find(p => p.name === 'label-sync')?.settings
    const autoSync = settings?.autoSync as boolean ?? false
    const sourceRepo = settings?.sourceRepo as string

    if (!autoSync || !sourceRepo) {
      return null
    }

    // TODO: Implement auto-sync on PR open
    return null
  },
} satisfies PilotPlugin
