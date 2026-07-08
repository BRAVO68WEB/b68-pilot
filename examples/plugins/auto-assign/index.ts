import type { PilotPlugin, TriggerEvent, PluginContext, TriggerResult } from '@pilot/plugin-sdk'

let lastAssignedIndex = 0

export default {
  name: 'auto-assign',
  version: '1.0.0',
  description: 'Auto-assign PRs to team members using round-robin',

  events: ['pull_request'],

  onTrigger: async (event: TriggerEvent, ctx: PluginContext): Promise<TriggerResult | null> => {
    // Only trigger on PR open
    if (event.action !== 'opened') {
      return null
    }

    // Get settings
    const settings = ctx.config.plugins.find(p => p.name === 'auto-assign')?.settings
    const reviewers = (settings?.reviewers as string[]) ?? []
    const strategy = (settings?.strategy as string) ?? 'round-robin'

    if (reviewers.length === 0) {
      return null
    }

    // Select reviewer based on strategy
    let selectedReviewer: string

    switch (strategy) {
      case 'random':
        selectedReviewer = reviewers[Math.floor(Math.random() * reviewers.length)]
        break
      case 'round-robin':
      default:
        selectedReviewer = reviewers[lastAssignedIndex % reviewers.length]
        lastAssignedIndex++
        break
    }

    // Assign reviewer
    const repo = event.repo.split('/')
    if (repo.length === 2 && event.issueNumber) {
      await ctx.github.assign(repo[0], repo[1], event.issueNumber, [selectedReviewer])
    }

    return {
      handled: true,
      message: `Assigned to @${selectedReviewer}`,
    }
  },
} satisfies PilotPlugin
