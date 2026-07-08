import type { PilotPlugin, TriggerEvent, PluginContext, TriggerResult } from '@pilot/plugin-sdk'

const DEFAULT_CHECKLIST = [
  'Tests pass',
  'Docs updated',
  'No breaking changes',
]

export default {
  name: 'pr-checklist',
  version: '1.0.0',
  description: 'Auto-post review checklist on PR open',

  events: ['pull_request'],

  commands: [
    {
      name: 'checklist',
      description: 'Post review checklist',
      usage: 'checklist',
      handler: async (args: string[], ctx: any) => {
        const items = DEFAULT_CHECKLIST
        const checklist = items.map((item: string) => `- [ ] ${item}`).join('\n')
        
        await ctx.github.comment(ctx.owner, ctx.repo, ctx.issueNumber, 
          `## Review Checklist\n\n${checklist}`
        )
        
        return { message: 'Checklist posted!', acted: true }
      },
    },
  ],

  onTrigger: async (event: TriggerEvent, ctx: PluginContext): Promise<TriggerResult | null> => {
    // Only trigger on PR open
    if (event.action !== 'opened') {
      return null
    }

    // Get checklist from settings or use default
    const settings = ctx.config.plugins.find(p => p.name === 'pr-checklist')?.settings
    const items = (settings?.checklistItems as string[]) ?? DEFAULT_CHECKLIST

    // Build checklist
    const checklist = items.map((item: string) => `- [ ] ${item}`).join('\n')

    // Post comment
    const issueNumber = event.issueNumber
    if (issueNumber) {
      const repo = event.repo.split('/')
      if (repo.length === 2) {
        await ctx.github.comment(repo[0], repo[1], issueNumber,
          `## Review Checklist\n\n${checklist}`
        )
      }
    }

    return {
      handled: true,
      message: 'Checklist posted',
    }
  },
} satisfies PilotPlugin
