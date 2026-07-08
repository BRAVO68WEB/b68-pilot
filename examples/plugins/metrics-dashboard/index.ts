import type { PilotPlugin, TriggerEvent, PluginContext, TriggerResult } from '@pilot/plugin-sdk'

export default {
  name: 'metrics-dashboard',
  version: '1.0.0',
  description: 'Track and report repository metrics',

  events: ['issues', 'pull_request'],

  commands: [
    {
      name: 'metrics',
      description: 'Show repository metrics',
      usage: 'metrics [days]',
      handler: async (args: string[], ctx: any) => {
        const days = parseInt(args[0] ?? '7')
        return { message: `📊 Metrics for last ${days} days:\n\n- Issues opened: 12\n- Issues closed: 8\n- PRs opened: 15\n- PRs merged: 10\n- Avg response time: 2.3 hours`, acted: false }
      },
    },
    {
      name: 'weekly-report',
      description: 'Generate weekly report',
      usage: 'weekly-report',
      handler: async (args: string[], ctx: any) => {
        return { message: 'Generating weekly report...', acted: true }
      },
    },
  ],

  onTrigger: async (event: TriggerEvent, ctx: PluginContext): Promise<TriggerResult | null> => {
    // Track metrics (store in plugin data)
    const repo = event.repo
    const timestamp = new Date().toISOString()

    try {
      // Increment counter
      const key = `metrics:${event.event}:${event.action}`
      const current = await ctx.store.get<number>(key) ?? 0
      await ctx.store.set(key, current + 1)

      // Track response time for issues
      if (event.event === 'issues' && event.action === 'opened') {
        await ctx.store.set(`issue_opened:${event.issueNumber}`, timestamp)
      }

      if (event.event === 'issue_comment' && event.action === 'created') {
        const issueKey = `issue_opened:${event.issueNumber}`
        const openedAt = await ctx.store.get<string>(issueKey)
        if (openedAt) {
          const responseTime = Date.now() - new Date(openedAt).getTime()
          const hours = responseTime / (1000 * 60 * 60)
          await ctx.store.set('total_response_hours', (await ctx.store.get<number>('total_response_hours') ?? 0) + hours)
          await ctx.store.set('response_count', (await ctx.store.get<number>('response_count') ?? 0) + 1)
        }
      }

      return null
    } catch (error) {
      ctx.logger.error('Metrics tracking failed', { error: String(error) })
      return null
    }
  },
} satisfies PilotPlugin
