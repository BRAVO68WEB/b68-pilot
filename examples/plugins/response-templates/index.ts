import type { PilotPlugin, TriggerEvent, PluginContext, TriggerResult } from '@pilot/plugin-sdk'

export default {
  name: 'response-templates',
  version: '1.0.0',
  description: 'Automated response templates for common issues',

  events: ['issues', 'issue_comment'],

  commands: [
    {
      name: 'template',
      description: 'Apply a response template',
      usage: 'template <name> [variables]',
      handler: async (args: string[], ctx: any) => {
        const templateName = args[0]
        if (!templateName) {
          return { message: 'Usage: @gh-pilot template <name> [variables]', acted: false }
        }

        const settings = ctx.config.plugins.find(p => p.name === 'response-templates')?.settings
        const templates = (settings?.templates as Record<string, string>) ?? {}
        const template = templates[templateName]

        if (!template) {
          const available = Object.keys(templates).join(', ')
          return { message: `Template not found. Available: ${available}`, acted: false }
        }

        // Parse variables from args
        const variables: Record<string, string> = {}
        for (const arg of args.slice(1)) {
          const [key, value] = arg.split('=')
          if (key && value) {
            variables[key] = value
          }
        }

        // Replace variables in template
        let response = template
        for (const [key, value] of Object.entries(variables)) {
          response = response.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
        }

        return { message: response, acted: true }
      },
    },
  ],

  onTrigger: async (event: TriggerEvent, ctx: PluginContext): Promise<TriggerResult | null> => {
    // Only respond to issue comments with template commands
    if (event.event !== 'issue_comment' || event.action !== 'created') return null

    const body = (event.payload?.comment as any)?.body ?? ''
    if (!body.includes('@gh-pilot template')) return null

    // Template command is handled by the command handler
    return null
  },
} satisfies PilotPlugin
