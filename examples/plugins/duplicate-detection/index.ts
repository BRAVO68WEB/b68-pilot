import type { PilotPlugin, TriggerEvent, PluginContext, TriggerResult } from '@pilot/plugin-sdk'
import { IssueAnalyzer } from 'core'

export default {
  name: 'duplicate-detection',
  version: '1.0.0',
  description: 'AI-powered duplicate issue detection',

  events: ['issues'],

  onTrigger: async (event: TriggerEvent, ctx: PluginContext): Promise<TriggerResult | null> => {
    if (event.action !== 'opened') return null

    const settings = ctx.config.plugins.find(p => p.name === 'duplicate-detection')?.settings
    const threshold = (settings?.similarityThreshold as number) ?? 0.7
    const searchClosed = (settings?.searchClosed as boolean) ?? true
    const maxResults = (settings?.maxResults as number) ?? 5
    const autoLabel = (settings?.autoLabel as boolean) ?? true

    const repo = event.repo.split('/')
    if (repo.length !== 2 || !event.issueNumber) return null

    const [owner, repoName] = repo
    const title = event.title ?? ''
    const body = event.body ?? ''

    try {
      // Search for similar issues
      const query = `${title.split(' ').slice(0, 5).join(' ')} repo:${owner}/${repoName}`
      const results = await ctx.github.request<any>('GET', `/search/issues?q=${encodeURIComponent(query)}&per_page=20`)

      const similarIssues = (results.items ?? [])
        .filter((issue: any) => issue.number !== event.issueNumber)
        .filter((issue: any) => searchClosed || issue.state === 'open')
        .map((issue: any) => ({
          number: issue.number,
          title: issue.title,
          state: issue.state,
          url: issue.html_url,
          similarity: calculateSimilarity(title, issue.title),
        }))
        .filter((issue: any) => issue.similarity >= threshold)
        .sort((a: any, b: any) => b.similarity - a.similarity)
        .slice(0, maxResults)

      if (similarIssues.length === 0) return null

      // Generate comment
      let comment = '## 🔍 Potential Duplicates Found\n\n'
      comment += 'I found similar issues that might be related:\n\n'

      for (const issue of similarIssues) {
        const confidence = Math.round(issue.similarity * 100)
        comment += `- **#${issue.number}**: ${issue.title} (${confidence}% similar, ${issue.state})\n`
        comment += `  [View issue](${issue.url})\n`
      }

      comment += '\nIf any of these resolve your issue, please close this one. '
      comment += 'If not, add more details to help us understand the difference.\n\n'
      comment += '---\n*Duplicate detection by gh-pilot*'

      await ctx.github.comment(owner, repoName, event.issueNumber, comment)

      // Auto-label
      if (autoLabel) {
        await ctx.github.addLabels(owner, repoName, event.issueNumber, ['potential-duplicate'])
      }

      return {
        handled: true,
        message: `Found ${similarIssues.length} potential duplicate(s)`,
      }
    } catch (error) {
      ctx.logger.error('Duplicate detection failed', { error: String(error) })
      return null
    }
  },
} satisfies PilotPlugin

function calculateSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.toLowerCase().split(/\s+/).filter(w => w.length > 3))
  const words2 = new Set(str2.toLowerCase().split(/\s+/).filter(w => w.length > 3))

  const intersection = new Set([...words1].filter(w => words2.has(w)))
  const union = new Set([...words1, ...words2])

  return union.size > 0 ? intersection.size / union.size : 0
}
