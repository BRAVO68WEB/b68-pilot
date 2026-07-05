import type { GitHubInstallationClient } from '../github/installation-client'

export interface ChangelogEntry {
    version: string
    date: string
    features: string[]
    bugfixes: string[]
    documentation: string[]
    other: string[]
}

export function formatChangelogEntry(entry: ChangelogEntry): string {
    const lines: string[] = []

    lines.push(`## [${entry.version}] - ${entry.date}`)
    lines.push('')

    if (entry.features.length > 0) {
        lines.push('### 🚀 Features')
        for (const item of entry.features) {
            lines.push(`- ${item}`)
        }
        lines.push('')
    }

    if (entry.bugfixes.length > 0) {
        lines.push('### 🐛 Bug Fixes')
        for (const item of entry.bugfixes) {
            lines.push(`- ${item}`)
        }
        lines.push('')
    }

    if (entry.documentation.length > 0) {
        lines.push('### 📝 Documentation')
        for (const item of entry.documentation) {
            lines.push(`- ${item}`)
        }
        lines.push('')
    }

    if (entry.other.length > 0) {
        lines.push('### 🔄 Other Changes')
        for (const item of entry.other) {
            lines.push(`- ${item}`)
        }
        lines.push('')
    }

    return lines.join('\n')
}

export async function updateChangelog(
    gh: GitHubInstallationClient,
    owner: string,
    repo: string,
    entry: ChangelogEntry,
    changelogPath: string = 'CHANGELOG.md'
): Promise<void> {
    // Get existing changelog
    const existing = await gh.getFileContent(owner, repo, changelogPath)

    const newSection = formatChangelogEntry(entry)

    let newContent: string

    if (existing) {
        // Insert new entry after the first heading
        const content = Buffer.from(existing.content, 'base64').toString('utf-8')
        const headingMatch = content.match(/^# Changelog\s*/)
        if (headingMatch) {
            const heading = headingMatch[0]
            const rest = content.slice(heading.length)
            newContent = `${heading}\n${newSection}\n${rest}`
        } else {
            newContent = `# Changelog\n\n${newSection}\n${content}`
        }

        // Update file
        await gh.updateFile(owner, repo, changelogPath, `docs: update changelog for ${entry.version}`, newContent, existing.sha)
    } else {
        // Create new changelog
        newContent = `# Changelog\n\n${newSection}`
        await gh.updateFile(owner, repo, changelogPath, `docs: create changelog for ${entry.version}`, newContent)
    }
}

export async function buildChangelogEntry(
    gh: GitHubInstallationClient,
    owner: string,
    repo: string,
    version: string,
    fromTag: string | null
): Promise<ChangelogEntry> {
    const date = new Date().toISOString().split('T')[0]

    // Get PRs merged since fromTag
    const prs = await gh.getClosedPullsSince(owner, repo, fromTag ?? '')

    // Filter to only merged PRs
    const mergedPrs = prs.filter(pr => pr.merged_at)

    const entry: ChangelogEntry = {
        version,
        date,
        features: [],
        bugfixes: [],
        documentation: [],
        other: []
    }

    for (const pr of mergedPrs) {
        const labels = pr.labels?.map(l => l.name) ?? []
        const author = pr.user ? ` @${pr.user.login}` : ''
        const item = `${pr.title} ([#${pr.number}](${pr.html_url}))${author}`

        if (labels.some(l => l === 'feature' || l === 'enhancement')) {
            entry.features.push(item)
        } else if (labels.some(l => l === 'bugfix' || l === 'bug')) {
            entry.bugfixes.push(item)
        } else if (labels.some(l => l === 'documentation' || l === 'docs')) {
            entry.documentation.push(item)
        } else {
            entry.other.push(item)
        }
    }

    return entry
}
