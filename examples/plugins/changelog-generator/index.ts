import type { PilotPlugin, TriggerEvent, PluginContext, TriggerResult } from '@pilot/plugin-sdk'

export default {
  name: 'changelog-generator',
  version: '1.0.0',
  description: 'Auto-generate CHANGELOG.md from merged PRs',

  events: ['pull_request'],

  commands: [
    {
      name: 'changelog',
      description: 'Generate or update changelog',
      usage: 'changelog [version]',
      handler: async (args: string[], ctx: any) => {
        return { message: 'Generating changelog...', acted: true }
      },
    },
  ],

  onTrigger: async (event: TriggerEvent, ctx: PluginContext): Promise<TriggerResult | null> => {
    if (event.action !== 'closed') return null

    const pr = event.payload?.pull_request as any
    if (!pr?.merged) return null

    const settings = ctx.config.plugins.find(p => p.name === 'changelog-generator')?.settings
    const autoUpdate = (settings?.autoUpdate as boolean) ?? false
    const categories = (settings?.categories as Record<string, string[]>) ?? {}

    if (!autoUpdate) return null

    const repo = event.repo.split('/')
    if (repo.length !== 2) return null

    const [owner, repoName] = repo

    try {
      // Determine category from PR title
      const title = pr.title.toLowerCase()
      let category = 'Changed'

      for (const [cat, prefixes] of Object.entries(categories)) {
        if (prefixes.some(prefix => title.startsWith(prefix))) {
          category = cat
          break
        }
      }

      // Create changelog entry
      const entry = `- ${pr.title} ([#${pr.number}](${pr.html_url}))`

      // Get current changelog
      const changelogPath = (settings?.changelogPath as string) ?? 'CHANGELOG.md'
      let changelog = ''

      try {
        const file = await ctx.github.request<any>('GET', `/repos/${owner}/${repoName}/contents/${changelogPath}`)
        changelog = Buffer.from(file.content, 'base64').toString('utf-8')
      } catch {
        changelog = '# Changelog\n\n'
      }

      // Insert entry under category
      const categoryHeader = `## ${category}`
      if (changelog.includes(categoryHeader)) {
        const index = changelog.indexOf(categoryHeader) + categoryHeader.length
        changelog = changelog.slice(0, index) + '\n' + entry + changelog.slice(index)
      } else {
        changelog += `\n## ${category}\n${entry}\n`
      }

      // Update file
      const sha = await getFileSha(ctx, owner, repoName, changelogPath)
      await ctx.github.request('PUT', `/repos/${owner}/${repoName}/contents/${changelogPath}`, {
        message: `docs: update changelog for #${pr.number}`,
        content: Buffer.from(changelog).toString('base64'),
        sha,
      })

      return {
        handled: true,
        message: 'Changelog updated',
      }
    } catch (error) {
      ctx.logger.error('Changelog generation failed', { error: String(error) })
      return null
    }
  },
} satisfies PilotPlugin

async function getFileSha(ctx: PluginContext, owner: string, repo: string, path: string): Promise<string | undefined> {
  try {
    const file = await ctx.github.request<any>('GET', `/repos/${owner}/${repo}/contents/${path}`)
    return file.sha
  } catch {
    return undefined
  }
}
