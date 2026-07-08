import type { PilotPlugin, TriggerEvent, PluginContext, TriggerResult } from '@pilot/plugin-sdk'

interface FileChange {
  filename: string
  status: string
  additions: number
  deletions: number
  patch?: string
}

interface PRStats {
  totalFiles: number
  totalAdditions: number
  totalDeletions: number
  filesByType: Record<string, number>
  breakingChanges: string[]
  affectedComponents: string[]
}

export default {
  name: 'pr-summary',
  version: '1.0.0',
  description: 'Generate comprehensive PR summaries using diff analysis',

  events: ['pull_request'],

  commands: [
    {
      name: 'summarize',
      description: 'Generate PR summary',
      usage: 'summarize',
      prOnly: true,
      handler: async (args: string[], ctx: any) => {
        return { message: 'Generating PR summary...', acted: true }
      },
    },
  ],

  onTrigger: async (event: TriggerEvent, ctx: PluginContext): Promise<TriggerResult | null> => {
    // Only summarize on PR open
    if (event.action !== 'opened') {
      return null
    }

    const settings = ctx.config.plugins.find(p => p.name === 'ai-pr-summary')?.settings
    const includeFileList = (settings?.includeFileList as boolean) ?? true
    const includeStats = (settings?.includeStats as boolean) ?? true
    const linkIssues = (settings?.linkIssues as boolean) ?? true
    const maxFiles = (settings?.maxFiles as number) ?? 20

    const repo = event.repo.split('/')
    if (repo.length !== 2 || !event.issueNumber) return null

    const [owner, repoName] = repo

    try {
      // Get PR details
      const pr = await ctx.github.request<any>('GET', `/repos/${owner}/${repoName}/pulls/${event.issueNumber}`)
      const files = await ctx.github.getPullFiles(owner, repoName, event.issueNumber)

      // Analyze changes
      const stats = analyzeChanges(files)
      const summary = generateSummary(pr, files, stats, {
        includeFileList,
        includeStats,
        linkIssues,
        maxFiles,
      })

      // Post summary comment
      await ctx.github.comment(owner, repoName, event.issueNumber, summary)

      // Add size label
      const sizeLabel = getSizeLabel(stats.totalAdditions + stats.totalDeletions)
      await ctx.github.addLabels(owner, repoName, event.issueNumber, [sizeLabel])

      // Detect breaking changes
      if (stats.breakingChanges.length > 0) {
        await ctx.github.addLabels(owner, repoName, event.issueNumber, ['breaking-change'])
      }

      return {
        handled: true,
        message: 'PR summary generated',
      }
    } catch (error) {
      ctx.logger.error('PR summary generation failed', { error: String(error) })
      return null
    }
  },
} satisfies PilotPlugin

function analyzeChanges(files: FileChange[]): PRStats {
  const stats: PRStats = {
    totalFiles: files.length,
    totalAdditions: files.reduce((sum, f) => sum + f.additions, 0),
    totalDeletions: files.reduce((sum, f) => sum + f.deletions, 0),
    filesByType: {},
    breakingChanges: [],
    affectedComponents: [],
  }

  for (const file of files) {
    // Count by file type
    const ext = file.filename.split('.').pop() ?? 'unknown'
    stats.filesByType[ext] = (stats.filesByType[ext] ?? 0) + 1

    // Detect breaking changes
    if (file.patch) {
      // API changes
      if (file.patch.includes('export') && file.patch.includes('-')) {
        if (file.filename.includes('api') || file.filename.includes('types')) {
          stats.breakingChanges.push(file.filename)
        }
      }

      // Database migrations
      if (file.filename.includes('migration')) {
        stats.breakingChanges.push(file.filename)
      }
    }

    // Detect affected components
    const parts = file.filename.split('/')
    if (parts.length > 2) {
      const component = parts[1] // e.g., src/components/Button -> components
      if (!stats.affectedComponents.includes(component)) {
        stats.affectedComponents.push(component)
      }
    }
  }

  return stats
}

function generateSummary(
  pr: any,
  files: FileChange[],
  stats: PRStats,
  options: {
    includeFileList: boolean
    includeStats: boolean
    linkIssues: boolean
    maxFiles: number
  }
): string {
  let summary = '## 📋 PR Summary\n\n'

  // PR description
  if (pr.body) {
    summary += `${pr.body}\n\n`
  }

  // Statistics
  if (options.includeStats) {
    summary += '### 📊 Statistics\n\n'
    summary += `| Metric | Value |\n`
    summary += `|--------|-------|\n`
    summary += `| Files Changed | ${stats.totalFiles} |\n`
    summary += `| Additions | +${stats.totalAdditions} |\n`
    summary += `| Deletions | -${stats.totalDeletions} |\n`
    summary += `| Net Change | ${stats.totalAdditions - stats.totalDeletions} |\n\n`

    // File types
    if (Object.keys(stats.filesByType).length > 0) {
      summary += '### 📁 File Types\n\n'
      for (const [ext, count] of Object.entries(stats.filesByType)) {
        summary += `- **.${ext}**: ${count} file(s)\n`
      }
      summary += '\n'
    }

    // Affected components
    if (stats.affectedComponents.length > 0) {
      summary += '### 🧩 Affected Components\n\n'
      summary += stats.affectedComponents.map(c => `- ${c}`).join('\n') + '\n\n'
    }
  }

  // Breaking changes warning
  if (stats.breakingChanges.length > 0) {
    summary += '### ⚠️ Breaking Changes\n\n'
    summary += 'This PR contains potential breaking changes:\n\n'
    for (const file of stats.breakingChanges) {
      summary += `- \`${file}\`\n`
    }
    summary += '\n'
  }

  // File list
  if (options.includeFileList) {
    summary += '### 📝 Changed Files\n\n'
    const displayFiles = files.slice(0, options.maxFiles)

    for (const file of displayFiles) {
      const icon = getFileIcon(file.status)
      summary += `${icon} \`${file.filename}\` (+${file.additions}/-${file.deletions})\n`
    }

    if (files.length > options.maxFiles) {
      summary += `\n... and ${files.length - options.maxFiles} more files\n`
    }
    summary += '\n'
  }

  // Auto-link issues
  if (options.linkIssues) {
    const issueRefs = extractIssueRefs(pr.title + ' ' + (pr.body ?? ''))
    if (issueRefs.length > 0) {
      summary += '### 🔗 Related Issues\n\n'
      for (const ref of issueRefs) {
        summary += `- ${ref}\n`
      }
      summary += '\n'
    }
  }

  summary += '---\n*Generated by gh-pilot PR Summary*'
  return summary
}

function getFileIcon(status: string): string {
  switch (status) {
    case 'added': return '🆕'
    case 'removed': return '🗑️'
    case 'modified': return '✏️'
    case 'renamed': return '📝'
    default return '📄'
  }
}

function getSizeLabel(lines: number): string {
  if (lines < 50) return 'size/S'
  if (lines < 200) return 'size/M'
  if (lines < 500) return 'size/L'
  return 'size/XL'
}

function extractIssueRefs(text: string): string[] {
  const refs: string[] = []
  const patterns = [
    /(?:fixes|closes|resolves)\s+#(\d+)/gi,
    /(?:fixes|closes|resolves)\s+(\w+\/\w+#\d+)/gi,
    /#(\d+)/g,
  ]

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(text)) !== null) {
      if (!refs.includes(match[0])) {
        refs.push(match[0])
      }
    }
  }

  return refs
}
