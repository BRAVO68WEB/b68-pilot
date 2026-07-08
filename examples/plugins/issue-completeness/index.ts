import type { PilotPlugin, TriggerEvent, PluginContext, TriggerResult } from '@pilot/plugin-sdk'

export default {
  name: 'issue-completeness',
  version: '1.0.0',
  description: 'Validate issue completeness and request missing information',

  events: ['issues'],

  onTrigger: async (event: TriggerEvent, ctx: PluginContext): Promise<TriggerResult | null> => {
    if (event.action !== 'opened') return null

    const settings = ctx.config.plugins.find(p => p.name === 'issue-completeness')?.settings
    const bugRequirements = (settings?.bugTemplate as string[]) ?? ['steps to reproduce', 'expected behavior', 'actual behavior', 'version']
    const featureRequirements = (settings?.featureTemplate as string[]) ?? ['use case', 'proposed solution', 'alternatives considered']
    const autoComment = (settings?.autoComment as boolean) ?? true
    const autoLabel = (settings?.autoLabel as boolean) ?? true

    const repo = event.repo.split('/')
    if (repo.length !== 2 || !event.issueNumber) return null

    const [owner, repoName] = repo
    const title = event.title ?? ''
    const body = event.body ?? ''
    const content = `${title} ${body}`.toLowerCase()

    // Detect issue type
    const isBug = /bug|error|crash|fail|broken/i.test(content)
    const isFeature = /feature|request|enhancement|improvement/i.test(content)

    const requirements = isBug ? bugRequirements : isFeature ? featureRequirements : []
    if (requirements.length === 0) return null

    // Check for missing information
    const missing: string[] = []
    for (const req of requirements) {
      const keywords = req.split(/\s+/)
      const found = keywords.some(kw => content.includes(kw.toLowerCase()))
      if (!found) {
        missing.push(req)
      }
    }

    if (missing.length === 0) return null

    // Generate comment
    let comment = '## ℹ️ Missing Information\n\n'
    comment += 'To help us investigate this issue, please provide:\n\n'
    for (const item of missing) {
      comment += `- [ ] ${item}\n`
    }
    comment += '\nThis will help us resolve your issue faster.\n\n'
    comment += '---\n*Completeness check by gh-pilot*'

    if (autoComment) {
      await ctx.github.comment(owner, repoName, event.issueNumber, comment)
    }

    if (autoLabel) {
      await ctx.github.addLabels(owner, repoName, event.issueNumber, ['needs-info'])
    }

    return {
      handled: true,
      message: `Missing ${missing.length} required field(s)`,
    }
  },
} satisfies PilotPlugin
