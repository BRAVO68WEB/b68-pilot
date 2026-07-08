import type { PilotPlugin, TriggerEvent, PluginContext, TriggerResult } from '@pilot/plugin-sdk'
import { IssueAnalyzer, type IssueAnalysisResult } from 'core'

interface PatternMatch {
  pattern: RegExp
  solution: string
  category: string
  confidence: number
}

export default {
  name: 'issue-solver',
  version: '2.0.0',
  description: 'AI-powered issue analysis with pattern matching and OpenAI solutions',

  events: ['issues'],

  commands: [
    {
      name: 'suggest',
      description: 'Get AI-powered solution suggestions',
      usage: 'suggest',
      handler: async (args: string[], ctx: any) => {
        return { message: 'Analyzing issue with AI...', acted: true }
      },
    },
  ],

  onTrigger: async (event: TriggerEvent, ctx: PluginContext): Promise<TriggerResult | null> => {
    // Only analyze new issues
    if (event.action !== 'opened') {
      return null
    }

    const settings = ctx.config.plugins.find(p => p.name === 'issue-solver')?.settings
    const useAI = (settings?.useAI as boolean) ?? true
    const maxSuggestions = (settings?.maxSuggestions as number) ?? 3
    const autoLabel = (settings?.autoLabel as boolean) ?? true

    const repo = event.repo.split('/')
    if (repo.length !== 2 || !event.issueNumber) return null

    const [owner, repoName] = repo
    const title = event.title ?? ''
    const body = event.body ?? ''

    try {
      // Step 1: Pattern matching (fast, no API call)
      const patternResults = analyzeWithPatterns(title, body)

      // Step 2: Search for similar issues
      const similarIssues = await findSimilarIssues(ctx, owner, repoName, title)

      // Step 3: AI analysis (if enabled and API key available)
      let aiResults: IssueAnalysisResult | null = null
      const openaiKey = Bun.env.OPENAI_API_KEY

      if (useAI && openaiKey) {
        try {
          const analyzer = new IssueAnalyzer(openaiKey)
          aiResults = await analyzer.analyze({
            title,
            body,
            similarIssues: similarIssues.map(i => ({
              number: i.number,
              title: i.title,
              state: i.state,
            })),
          })
        } catch (error) {
          ctx.logger.warn('AI analysis failed, falling back to pattern matching', { error: String(error) })
        }
      }

      // Merge results
      const mergedResults = mergeResults(patternResults, aiResults, similarIssues, maxSuggestions)

      // Auto-label
      if (autoLabel) {
        const labels = determineLabels(mergedResults, aiResults)
        if (labels.length > 0) {
          await ctx.github.addLabels(owner, repoName, event.issueNumber, labels)
        }
      }

      // Generate and post comment
      if (mergedResults.suggestions.length > 0 || aiResults) {
        const comment = generateSuggestionComment(mergedResults, aiResults, similarIssues)
        await ctx.github.comment(owner, repoName, event.issueNumber, comment)

        return {
          handled: true,
          message: `Found ${mergedResults.suggestions.length} suggestion(s)`,
        }
      }

      return null
    } catch (error) {
      ctx.logger.error('Issue analysis failed', { error: String(error) })
      return null
    }
  },
} satisfies PilotPlugin

// ─── Pattern Matching ──────────────────────────────────────────────────

const PATTERN_MATCHES: PatternMatch[] = [
  // JavaScript/TypeScript errors
  {
    pattern: /cannot find module/i,
    solution: 'Run `npm install` or `bun install` to install missing dependencies. If the module is local, check the import path.',
    category: 'dependency',
    confidence: 0.9,
  },
  {
    pattern: /typeerror|referenceerror|syntaxerror/i,
    solution: 'Check for typos, missing imports, or incorrect function calls. Use TypeScript for better type safety.',
    category: 'bug',
    confidence: 0.7,
  },
  {
    pattern: /unhandled promise rejection|async.*error/i,
    solution: 'Add try/catch blocks around async operations. Use .catch() for promise chains.',
    category: 'bug',
    confidence: 0.8,
  },

  // Network/API errors
  {
    pattern: /cors|cross-origin/i,
    solution: 'Configure CORS headers on your server. Add Access-Control-Allow-Origin header.',
    category: 'configuration',
    confidence: 0.9,
  },
  {
    pattern: /401|unauthorized|authentication/i,
    solution: 'Check your authentication credentials. Ensure tokens are valid and not expired.',
    category: 'auth',
    confidence: 0.8,
  },
  {
    pattern: /403|forbidden|permission/i,
    solution: 'Check user permissions. Ensure the authenticated user has access to the resource.',
    category: 'auth',
    confidence: 0.8,
  },
  {
    pattern: /404|not found/i,
    solution: 'Verify the URL/endpoint exists. Check for typos in the path.',
    category: 'bug',
    confidence: 0.7,
  },
  {
    pattern: /500|internal server error/i,
    solution: 'Check server logs for the root cause. Look for unhandled exceptions or database errors.',
    category: 'bug',
    confidence: 0.6,
  },
  {
    pattern: /timeout|etimedout/i,
    solution: 'Increase timeout values. Check network connectivity. Consider implementing retry logic.',
    category: 'performance',
    confidence: 0.8,
  },

  // Database errors
  {
    pattern: /connection refused|econnrefused/i,
    solution: 'Ensure the database server is running. Check connection string and credentials.',
    category: 'database',
    confidence: 0.9,
  },
  {
    pattern: /duplicate key|unique constraint/i,
    solution: 'The record already exists. Use upsert operations or check for existence before insert.',
    category: 'database',
    confidence: 0.9,
  },
  {
    pattern: /migration|schema/i,
    solution: 'Run database migrations. Check migration files for errors.',
    category: 'database',
    confidence: 0.7,
  },

  // Performance issues
  {
    pattern: /slow|performance|memory leak|cpu/i,
    solution: 'Profile the application to identify bottlenecks. Check for memory leaks and optimize hot paths.',
    category: 'performance',
    confidence: 0.6,
  },

  // Security issues
  {
    pattern: /security|vulnerability|xss|injection/i,
    solution: 'Validate and sanitize all user input. Use parameterized queries. Implement Content Security Policy.',
    category: 'security',
    confidence: 0.8,
  },
]

function analyzeWithPatterns(title: string, body: string): Array<{ solution: string; category: string; confidence: number }> {
  const content = `${title} ${body}`.toLowerCase()
  const results: Array<{ solution: string; category: string; confidence: number }> = []

  for (const match of PATTERN_MATCHES) {
    if (match.pattern.test(content)) {
      results.push({
        solution: match.solution,
        category: match.category,
        confidence: match.confidence,
      })
    }
  }

  return results
}

// ─── Similar Issue Search ──────────────────────────────────────────────

interface SimilarIssue {
  number: number
  title: string
  url: string
  state: string
  similarity: number
}

async function findSimilarIssues(
  ctx: PluginContext,
  owner: string,
  repo: string,
  title: string
): Promise<SimilarIssue[]> {
  const query = `${title.split(' ').slice(0, 5).join(' ')} repo:${owner}/${repo}`

  try {
    const results = await ctx.github.request<any>('GET', `/search/issues?q=${encodeURIComponent(query)}&per_page=10`)

    return (results.items ?? []).map((issue: any) => ({
      number: issue.number,
      title: issue.title,
      url: issue.html_url,
      state: issue.state,
      similarity: calculateSimilarity(title, issue.title),
    }))
  } catch {
    return []
  }
}

function calculateSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.toLowerCase().split(/\s+/))
  const words2 = new Set(str2.toLowerCase().split(/\s+/))

  const intersection = new Set([...words1].filter(w => words2.has(w)))
  const union = new Set([...words1, ...words2])

  return intersection.size / union.size
}

// ─── Result Merging ────────────────────────────────────────────────────

interface MergedResults {
  suggestions: Array<{
    title: string
    description: string
    confidence: number
    steps?: string[]
    source: 'pattern' | 'ai' | 'similar'
  }>
  category: string
  priority: string
}

function mergeResults(
  patternResults: Array<{ solution: string; category: string; confidence: number }>,
  aiResults: IssueAnalysisResult | null,
  similarIssues: SimilarIssue[],
  maxSuggestions: number
): MergedResults {
  const suggestions: MergedResults['suggestions'] = []

  // Add pattern-based suggestions
  for (const result of patternResults) {
    suggestions.push({
      title: `Solution (${result.category})`,
      description: result.solution,
      confidence: result.confidence,
      source: 'pattern',
    })
  }

  // Add AI-based suggestions
  if (aiResults) {
    for (const solution of aiResults.suggestedSolutions) {
      suggestions.push({
        title: solution.title,
        description: solution.description,
        confidence: solution.confidence,
        steps: solution.steps,
        source: 'ai',
      })
    }
  }

  // Add similar issue suggestions
  for (const issue of similarIssues.filter(i => i.similarity > 0.5).slice(0, 2)) {
    suggestions.push({
      title: `Similar issue: #${issue.number}`,
      description: issue.title,
      confidence: issue.similarity,
      source: 'similar',
    })
  }

  // Sort by confidence and limit
  suggestions.sort((a, b) => b.confidence - a.confidence)
  const limitedSuggestions = suggestions.slice(0, maxSuggestions)

  return {
    suggestions: limitedSuggestions,
    category: aiResults?.category ?? patternResults[0]?.category ?? 'other',
    priority: aiResults?.priority ?? 'medium',
  }
}

// ─── Label Determination ───────────────────────────────────────────────

function determineLabels(results: MergedResults, aiResults: IssueAnalysisResult | null): string[] {
  const labels: string[] = []

  // Category-based labels
  const categoryLabels: Record<string, string> = {
    bug: 'bug',
    feature: 'enhancement',
    question: 'question',
    documentation: 'documentation',
    security: 'security',
    performance: 'performance',
  }

  if (categoryLabels[results.category]) {
    labels.push(categoryLabels[results.category])
  }

  // Priority-based labels
  if (results.priority === 'critical' || results.priority === 'high') {
    labels.push(`priority:${results.priority}`)
  }

  // AI-suggested labels
  if (aiResults?.suggestedLabels) {
    for (const label of aiResults.suggestedLabels) {
      if (!labels.includes(label)) {
        labels.push(label)
      }
    }
  }

  return labels
}

// ─── Comment Generation ────────────────────────────────────────────────

function generateSuggestionComment(
  results: MergedResults,
  aiResults: IssueAnalysisResult | null,
  similarIssues: SimilarIssue[]
): string {
  let comment = '## 💡 Issue Analysis\n\n'

  // AI Summary
  if (aiResults?.summary) {
    comment += `### Summary\n\n${aiResults.summary}\n\n`
  }

  // Category and Priority
  comment += `**Category:** ${results.category} | **Priority:** ${results.priority}\n\n`

  // Duplicate check
  if (aiResults?.isDuplicate && aiResults.duplicateOf) {
    comment += `⚠️ **Possible Duplicate of #${aiResults.duplicateOf}**\n\n`
  }

  // Suggestions
  if (results.suggestions.length > 0) {
    comment += '### Suggested Solutions\n\n'

    for (const suggestion of results.suggestions) {
      const icon = suggestion.source === 'ai' ? '🤖' : suggestion.source === 'pattern' ? '🔍' : '🔗'
      comment += `${icon} **${suggestion.title}** (confidence: ${Math.round(suggestion.confidence * 100)}%)\n`
      comment += `   ${suggestion.description}\n`

      if (suggestion.steps && suggestion.steps.length > 0) {
        comment += '   \n   **Steps:**\n'
        for (const step of suggestion.steps) {
          comment += `   1. ${step}\n`
        }
      }
      comment += '\n'
    }
  }

  // Similar issues
  if (similarIssues.length > 0) {
    comment += '### Similar Issues\n\n'
    for (const issue of similarIssues.filter(i => i.similarity > 0.3).slice(0, 3)) {
      comment += `- #${issue.number}: ${issue.title} (${Math.round(issue.similarity * 100)}% similar, ${issue.state})\n`
    }
    comment += '\n'
  }

  comment += '---\n*AI-powered analysis by gh-pilot*'
  return comment
}
