import type { PilotPlugin, TriggerEvent, PluginContext, TriggerResult } from '@pilot/plugin-sdk'

export default {
  name: 'release-notes',
  version: '1.0.0',
  description: 'Auto-generate release notes from merged PRs',

  events: ['release'],

  commands: [
    {
      name: 'release-notes',
      description: 'Generate release notes for current version',
      usage: 'release-notes [version]',
      handler: async (args: string[], ctx: any) => {
        return { message: 'Generating release notes...', acted: true }
      },
    },
  ],

  onTrigger: async (event: TriggerEvent, ctx: PluginContext): Promise<TriggerResult | null> => {
    if (event.action !== 'published') return null

    const settings = ctx.config.plugins.find(p => p.name === 'release-notes')?.settings
    const categories = (settings?.categories as Record<string, string[]>) ?? {}
    const excludeLabels = (settings?.excludeLabels as string[]) ?? []

    const repo = event.repo.split('/')
    if (repo.length !== 2) return null

    const [owner, repoName] = repo
    const tagName = (event.payload?.release as any)?.tag_name ?? ''

    try {
      // Get PRs merged since last release
      const prs = await getMergedPRs(ctx, owner, repoName, tagName)

      // Categorize PRs
      const categorized: Record<string, Array<{ number: number; title: string; url: string }>> = {}

      for (const pr of prs) {
        // Skip excluded PRs
        const labels = pr.labels?.map((l: any) => l.name) ?? []
        if (labels.some((l: string) => excludeLabels.includes(l))) continue

        // Categorize by title prefix
        let category = 'Other'
        for (const [cat, prefixes] of Object.entries(categories)) {
          if (prefixes.some(prefix => pr.title.toLowerCase().startsWith(prefix))) {
            category = cat
            break
          }
        }

        if (!categorized[category]) {
          categorized[category] = []
        }
        categorized[category].push({
          number: pr.number,
          title: pr.title,
          url: pr.html_url,
        })
      }

      // Generate release notes
      let notes = `## ${tagName}\n\n`

      for (const [category, items] of Object.entries(categorized)) {
        if (items.length === 0) continue

        notes += `### ${category}\n\n`
        for (const item of items) {
          notes += `- ${item.title} ([#${item.number}](${item.url}))\n`
        }
        notes += '\n'
      }

      // Update release body
      const releaseId = (event.payload?.release as any)?.id
      if (releaseId) {
        await ctx.github.request('PATCH', `/repos/${owner}/${repoName}/releases/${releaseId}`, {
          body: notes,
        })
      }

      return {
        handled: true,
        message: 'Release notes generated',
      }
    } catch (error) {
      ctx.logger.error('Release notes generation failed', { error: String(error) })
      return null
    }
  },
} satisfies PilotPlugin

async function getMergedPRs(ctx: PluginContext, owner: string, repo: string, currentTag: string) {
  // Get the previous release
  const releases = await ctx.github.request<any>('GET', `/repos/${owner}/${repo}/releases?per_page=2`)
  const previousTag = releases.length > 1 ? releases[1].tag_name : null

  // Get commits between tags
  let commits: any[] = []
  if (previousTag) {
    const compare = await ctx.github.request<any>('GET', `/repos/${owner}/${repo}/compare/${previousTag}...${currentTag}`)
    commits = compare.commits ?? []
  }

  // Get PRs from commits
  const prs: any[] = []
  for (const commit of commits) {
    const message = commit.commit.message
    const prMatch = message.match(/\(#(\d+)\)/)
    if (prMatch) {
      const prNumber = parseInt(prMatch[1])
      try {
        const pr = await ctx.github.request<any>('GET', `/repos/${owner}/${repo}/pulls/${prNumber}`)
        prs.push(pr)
      } catch {
        // Skip if PR not found
      }
    }
  }

  return prs
}
