import type { PilotPlugin, TriggerEvent, PluginContext, TriggerResult } from '@pilot/plugin-sdk'
import { IssueAnalyzer } from 'core'

export default {
  name: 'issue-triage',
  version: '1.0.0',
  description: 'AI-powered issue triage with auto-labeling',

  events: ['issues'],

  onTrigger: async (event: TriggerEvent, ctx: PluginContext): Promise<TriggerResult | null> => {
    if (event.action !== 'opened') return null

    const settings = ctx.config.plugins.find(p => p.name === 'issue-triage')?.settings
    const useAI = (settings?.useAI as boolean) ?? true
    const autoLabel = (settings?.autoLabel as boolean) ?? true
    const priorityRules = (settings?.priorityRules as Record<string, string[]>) ?? {}
    const categoryLabels = (settings?.categoryLabels as Record<string, string[]>) ?? {}

    const repo = event.repo.split('/')
    if (repo.length !== 2 || !event.issueNumber) return null

    const [owner, repoName] = repo
    const title = event.title ?? ''
    const body = event.body ?? ''
    const content = `${title} ${body}`.toLowerCase()

    const labels: string[] = []
    let priority = 'medium'
    let category = 'other'

    // Step 1: Pattern-based categorization
    for (const [cat, keywords] of Object.entries(categoryLabels)) {
      if (keywords.some(kw => content.includes(kw))) {
        category = cat
        labels.push(cat)
        break
      }
    }

    // Step 2: Priority detection
    for (const [pri, keywords] of Object.entries(priorityRules)) {
      if (keywords.some(kw => content.includes(kw))) {
        priority = pri
        labels.push(`priority:${pri}`)
        break
      }
    }

    // Step 3: AI enhancement
    if (useAI) {
      const openaiKey = Bun.env.OPENAI_API_KEY
      if (openaiKey) {
        try {
          const analyzer = new IssueAnalyzer(openaiKey)
          const analysis = await analyzer.analyze({ title, body })

          // Merge AI labels with pattern labels
          for (const label of analysis.suggestedLabels) {
            if (!labels.includes(label)) {
              labels.push(label)
            }
          }

          // Use AI category if pattern didn't match
          if (category === 'other' && analysis.category !== 'other') {
            category = analysis.category
            if (!labels.includes(category)) {
              labels.push(category)
            }
          }

          // Use AI priority if higher
          if (analysis.priority === 'critical' || analysis.priority === 'high') {
            priority = analysis.priority
          }
        } catch (error) {
          ctx.logger.warn('AI triage failed', { error: String(error) })
        }
      }
    }

    // Step 4: Apply labels
    if (autoLabel && labels.length > 0) {
      await ctx.github.addLabels(owner, repoName, event.issueNumber, labels)
    }

    return {
      handled: true,
      message: `Issue triaged: ${category} (${priority})`,
      data: { category, priority, labels },
    }
  },
} satisfies PilotPlugin
