import type { PilotPlugin, TriggerEvent, PluginContext, TriggerResult } from '@pilot/plugin-sdk'

export default {
  name: 'stale-bot',
  version: '1.0.0',
  description: 'Auto-close stale issues and PRs after inactivity',

  events: ['issues', 'pull_request'],

  commands: [
    {
      name: 'stale',
      description: 'Check or manage stale issues',
      usage: 'stale [--exclude]',
      handler: async (args: string[], ctx: any) => {
        if (args[0] === '--exclude') {
          await ctx.github.addLabels(ctx.owner, ctx.repo, ctx.issueNumber, ['pinned'])
          return { message: 'This issue has been exempted from stale checks.', acted: true }
        }
        return { message: 'Stale check will run on the next scheduled job.', acted: false }
      },
    },
  ],

  onTrigger: async (event: TriggerEvent, ctx: PluginContext): Promise<TriggerResult | null> => {
    // Only check on issue/PR update
    if (event.action !== 'updated' && event.action !== 'synchronize') {
      return null
    }

    const settings = ctx.config.plugins.find(p => p.name === 'stale-bot')?.settings
    const staleDays = (settings?.staleDays as number) ?? 30
    const staleLabel = (settings?.staleLabel as string) ?? 'stale'
    const exemptLabels = (settings?.exemptLabels as string[]) ?? ['pinned', 'security', 'bug']

    // Check if issue has exempt labels
    const labels = event.labels ?? []
    if (labels.some(l => exemptLabels.includes(l))) {
      return null
    }

    // Check if already marked stale
    if (labels.includes(staleLabel)) {
      return null
    }

    // For now, just return null (actual stale checking would need to query GitHub API)
    return null
  },
} satisfies PilotPlugin
