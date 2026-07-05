import type { GitHubInstallationClient } from '../github/installation-client'
import { incrementVersion } from './tag'

interface ReleaseOptions {
    tagName: string
    name?: string
    body?: string
    draft?: boolean
    prerelease?: boolean
}

export async function generateReleaseNotes(
    gh: GitHubInstallationClient,
    owner: string,
    repo: string,
    fromTag: string | null,
    toTag: string
): Promise<string> {
    const lines: string[] = []

    // Get PRs merged since fromTag
    const prs = await gh.getClosedPullsSince(owner, repo, fromTag ?? '')

    // Filter to only merged PRs
    const mergedPrs = prs.filter(pr => pr.merged_at)

    // Group by labels
    const groups: Record<string, Array<{ number: number; title: string; html_url: string; user?: { login: string } }>> = {
        '🚀 Features': [],
        '🐛 Bug Fixes': [],
        '📝 Documentation': [],
        '🔄 Other Changes': []
    }

    for (const pr of mergedPrs) {
        const labels = pr.labels?.map(l => l.name) ?? []
        const entry = { number: pr.number, title: pr.title, html_url: pr.html_url, user: pr.user }

        if (labels.some(l => l === 'feature' || l === 'enhancement')) {
            groups['🚀 Features'].push(entry)
        } else if (labels.some(l => l === 'bugfix' || l === 'bug')) {
            groups['🐛 Bug Fixes'].push(entry)
        } else if (labels.some(l => l === 'documentation' || l === 'docs')) {
            groups['📝 Documentation'].push(entry)
        } else {
            groups['🔄 Other Changes'].push(entry)
        }
    }

    // Build release notes
    for (const [category, items] of Object.entries(groups)) {
        if (items.length === 0) continue

        lines.push(`### ${category}`)
        for (const item of items) {
            const author = item.user ? ` @${item.user.login}` : ''
            lines.push(`- ${item.title} ([#${item.number}](${item.html_url}))${author}`)
        }
        lines.push('')
    }

    // Add comparison link
    if (fromTag) {
        lines.push(`**Full Changelog**: https://github.com/${owner}/${repo}/compare/${fromTag}...${toTag}`)
    }

    return lines.join('\n')
}

export async function createRelease(
    gh: GitHubInstallationClient,
    owner: string,
    repo: string,
    options: ReleaseOptions
): Promise<{ html_url: string }> {
    const result = await gh.createRelease(owner, repo, {
        tag_name: options.tagName,
        name: options.name ?? options.tagName,
        body: options.body,
        draft: options.draft ?? false,
        prerelease: options.prerelease ?? false
    })

    return { html_url: result.html_url }
}

export async function autoRelease(
    gh: GitHubInstallationClient,
    owner: string,
    repo: string,
    bump: 'major' | 'minor' | 'patch',
    mergeSha: string,
    pullNumber: number
): Promise<{ tag: string; releaseUrl: string } | null> {
    // Get latest tag
    const latestTag = await gh.getLatestTag(owner, repo)
    const fromTag = latestTag?.name ?? null

    // Calculate next version
    const nextVersion = fromTag ? incrementVersion(fromTag, bump) : 'v0.1.0'

    // Create tag on merge commit
    await gh.createRef(owner, repo, `refs/tags/${nextVersion}`, mergeSha)

    // Generate release notes
    const body = await generateReleaseNotes(gh, owner, repo, fromTag, nextVersion)

    // Create release
    const release = await createRelease(gh, owner, repo, {
        tagName: nextVersion,
        name: nextVersion,
        body
    })

    // Comment on PR
    await gh.comment(owner, repo, pullNumber,
        `🎉 Release ${nextVersion} created!\n\n` +
        `📦 Release: ${release.html_url}\n` +
        `📋 Tag: ${nextVersion}`
    )

    return { tag: nextVersion, releaseUrl: release.html_url }
}
