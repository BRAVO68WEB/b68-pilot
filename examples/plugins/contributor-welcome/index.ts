import type { PilotPlugin, TriggerEvent, PluginContext, TriggerResult } from '@pilot/plugin-sdk'

export default {
  name: 'contributor-welcome',
  version: '1.0.0',
  description: 'Welcome new contributors with personalized messages',

  events: ['pull_request'],

  onTrigger: async (event: TriggerEvent, ctx: PluginContext): Promise<TriggerResult | null> => {
    if (event.action !== 'opened') return null

    const settings = ctx.config.plugins.find(p => p.name === 'contributor-welcome')?.settings
    const welcomeTemplate = (settings?.welcomeMessage as string) ?? 'Welcome! Thanks for your first contribution!'
    const goodFirstIssueLabel = (settings?.goodFirstIssueLabel as string) ?? 'good first issue'
    const suggestGoodFirstIssues = (settings?.suggestGoodFirstIssues as boolean) ?? true
    const autoLabel = (settings?.autoLabel as boolean) ?? true

    const repo = event.repo.split('/')
    if (repo.length !== 2 || !event.issueNumber) return null

    const [owner, repoName] = repo
    const sender = event.sender ?? ''

    try {
      // Check if this is their first PR
      const userPRs = await ctx.github.request<any>('GET', `/repos/${owner}/${repoName}/pulls?state=all&per_page=1`)
      const isFirstPR = userPRs.length === 0 || userPRs[0].user?.login !== sender

      if (!isFirstPR) return null

      // Build welcome message
      let message = welcomeTemplate.replace('{repo}', `${owner}/${repoName}`)

      // Suggest good first issues
      if (suggestGoodFirstIssues) {
        const issues = await ctx.github.request<any>('GET', `/repos/${owner}/${repoName}/issues?labels=${encodeURIComponent(goodFirstIssueLabel)}&state=open&per_page=3`)

        if (issues.length > 0) {
          message += '\n\n### 💡 Good First Issues\n\n'
          message += 'If you\'re looking for more ways to contribute, check out these issues:\n\n'
          for (const issue of issues) {
            message += `- #${issue.number}: ${issue.title}\n`
          }
        }
      }

      await ctx.github.comment(owner, repoName, event.issueNumber, message)

      if (autoLabel) {
        await ctx.github.addLabels(owner, repoName, event.issueNumber, ['first-time-contributor'])
      }

      return {
        handled: true,
        message: 'Welcome message sent',
      }
    } catch (error) {
      ctx.logger.error('Welcome message failed', { error: String(error) })
      return null
    }
  },
} satisfies PilotPlugin
