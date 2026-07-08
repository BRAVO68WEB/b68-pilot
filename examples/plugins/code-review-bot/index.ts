import type { PilotPlugin, TriggerEvent, PluginContext, TriggerResult } from '@pilot/plugin-sdk'
import { OpenAIClient, type ReviewRequest, type ReviewResult } from 'core'

export default {
  name: 'code-review-bot',
  version: '2.0.0',
  description: 'AI-powered code review using OpenAI GPT-4',

  events: ['pull_request'],

  commands: [
    {
      name: 'review',
      description: 'Trigger AI code review',
      usage: 'review',
      prOnly: true,
      handler: async (args: string[], ctx: any) => {
        return { message: 'AI code review triggered. Results will be posted shortly.', acted: true }
      },
    },
  ],

  onTrigger: async (event: TriggerEvent, ctx: PluginContext): Promise<TriggerResult | null> => {
    // Only review on PR open or synchronize
    if (event.action !== 'opened' && event.action !== 'synchronize') {
      return null
    }

    // Check if OpenAI API key is configured
    const openaiKey = Bun.env.OPENAI_API_KEY
    if (!openaiKey) {
      ctx.logger.warn('OpenAI API key not configured, skipping AI review')
      return null
    }

    const settings = ctx.config.plugins.find(p => p.name === 'code-review-bot')?.settings
    const model = (settings?.openaiModel as string) ?? 'gpt-4o-mini'
    const maxTokens = (settings?.maxTokens as number) ?? 4000
    const autoReview = (settings?.autoReview as boolean) ?? true
    const autoApprove = (settings?.autoApprove as boolean) ?? false
    const requireTests = (settings?.requireTests as boolean) ?? true
    const maxPRSize = (settings?.maxPRSize as number) ?? 1000

    if (!autoReview && event.action === 'opened') {
      return null
    }

    const repo = event.repo.split('/')
    if (repo.length !== 2 || !event.issueNumber) return null

    const [owner, repoName] = repo

    try {
      // Get PR details
      const pr = await ctx.github.request<any>('GET', `/repos/${owner}/${repoName}/pulls/${event.issueNumber}`)
      const files = await ctx.github.getPullFiles(owner, repoName, event.issueNumber)

      // Check PR size
      const totalChanges = files.reduce((sum: number, f: any) => sum + f.additions + f.deletions, 0)
      if (totalChanges > maxPRSize) {
        await ctx.github.comment(owner, repoName, event.issueNumber,
          `⚠️ **PR Too Large**\n\nThis PR has ${totalChanges} lines changed (max: ${maxPRSize}). Please break it into smaller PRs for better review.`
        )
        return { handled: true, message: 'PR too large for review' }
      }

      // Check for tests
      if (requireTests) {
        const hasTests = files.some((f: any) =>
          f.filename.includes('.test.') ||
          f.filename.includes('.spec.') ||
          f.filename.includes('__tests__')
        )
        if (!hasTests && files.length > 3) {
          await ctx.github.addLabels(owner, repoName, event.issueNumber, ['needs-tests'])
        }
      }

      // Get diff content
      const diffResponse = await ctx.github.request<any>('GET', `/repos/${owner}/${repoName}/pulls/${event.issueNumber}`, {
        headers: { Accept: 'application/vnd.github.v3.diff' }
      })
      const diff = typeof diffResponse === 'string' ? diffResponse : ''

      // Initialize OpenAI client
      const openai = new OpenAIClient({
        apiKey: openaiKey,
        model,
        maxTokens,
      })

      // Generate AI review
      const reviewRequest: ReviewRequest = {
        diff,
        prTitle: pr.title,
        prDescription: pr.body,
        files: files.map((f: any) => ({
          filename: f.filename,
          status: f.status,
          additions: f.additions,
          deletions: f.deletions,
        })),
      }

      const review = await openai.reviewCode(reviewRequest)

      // Format and post review
      const reviewComment = formatReview(review)
      await ctx.github.comment(owner, repoName, event.issueNumber, reviewComment)

      // Add labels based on assessment
      if (review.overallAssessment === 'request_changes') {
        await ctx.github.addLabels(owner, repoName, event.issueNumber, ['needs-changes'])
      } else if (review.overallAssessment === 'approve') {
        await ctx.github.addLabels(owner, repoName, event.issueNumber, ['reviewed'])
        if (autoApprove) {
          await ctx.github.approvePull(owner, repoName, event.issueNumber, 'Auto-approved by AI review')
        }
      }

      // Request changes if critical issues found
      const criticalIssues = review.issues.filter(i => i.severity === 'critical')
      if (criticalIssues.length > 0) {
        await ctx.github.requestChanges(owner, repoName, event.issueNumber,
          `Found ${criticalIssues.length} critical issue(s). Please address them.`
        )
      }

      return {
        handled: true,
        message: `AI review complete: ${review.overallAssessment}`,
      }
    } catch (error) {
      ctx.logger.error('AI code review failed', { error: String(error) })
      return null
    }
  },
} satisfies PilotPlugin

function formatReview(review: ReviewResult): string {
  let comment = '## 🤖 AI Code Review\n\n'

  // Summary
  comment += '### Summary\n\n'
  comment += `${review.summary}\n\n`

  // Overall assessment
  const assessmentEmoji = {
    approve: '✅',
    request_changes: '❌',
    comment: '💬',
  }
  comment += `**Overall Assessment:** ${assessmentEmoji[review.overallAssessment]} ${review.overallAssessment.replace('_', ' ')}\n\n`

  // Critical issues
  const criticalIssues = review.issues.filter(i => i.severity === 'critical')
  if (criticalIssues.length > 0) {
    comment += '### 🚨 Critical Issues\n\n'
    for (const issue of criticalIssues) {
      comment += `- **${issue.file ?? 'General'}${issue.line ? `:${issue.line}` : ''}**: ${issue.message}\n`
      if (issue.suggestion) {
        comment += `  - *Suggestion:* ${issue.suggestion}\n`
      }
    }
    comment += '\n'
  }

  // Warnings
  const warnings = review.issues.filter(i => i.severity === 'warning')
  if (warnings.length > 0) {
    comment += '### ⚠️ Warnings\n\n'
    for (const issue of warnings) {
      comment += `- **${issue.file ?? 'General'}${issue.line ? `:${issue.line}` : ''}**: ${issue.message}\n`
      if (issue.suggestion) {
        comment += `  - *Suggestion:* ${issue.suggestion}\n`
      }
    }
    comment += '\n'
  }

  // Info
  const infoIssues = review.issues.filter(i => i.severity === 'info')
  if (infoIssues.length > 0) {
    comment += '### ℹ️ Suggestions\n\n'
    for (const issue of infoIssues) {
      comment += `- **${issue.file ?? 'General'}**: ${issue.message}\n`
    }
    comment += '\n'
  }

  // Security concerns
  if (review.securityConcerns.length > 0) {
    comment += '### 🔒 Security Concerns\n\n'
    for (const concern of review.securityConcerns) {
      comment += `- ${concern}\n`
    }
    comment += '\n'
  }

  // General suggestions
  if (review.suggestions.length > 0) {
    comment += '### 💡 Suggestions\n\n'
    for (const suggestion of review.suggestions) {
      comment += `- ${suggestion}\n`
    }
    comment += '\n'
  }

  comment += '---\n*AI-powered review by gh-pilot (OpenAI GPT-4)*'
  return comment
}
