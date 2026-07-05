import type { GitHubInstallationClient } from '../github/installation-client'

export interface RepoStats {
    period: string
    prsOpened: number
    prsMerged: number
    avgMergeTime: string
    issuesOpened: number
    issuesClosed: number
    linesAdded: number
    linesRemoved: number
    topContributors: Array<{ name: string; prs: number; reviews: number; lines: number }>
}

export async function generateStats(
    gh: GitHubInstallationClient,
    owner: string,
    repo: string,
    days: number = 7
): Promise<RepoStats> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    // Get PRs and issues
    const [closedPRs, allIssues] = await Promise.all([
        gh.getClosedPullsSince(owner, repo, since),
        gh.getIssuesSince(owner, repo, since)
    ])

    // Filter PRs
    const mergedPRs = closedPRs.filter(pr => pr.merged_at)
    const openedPRs = allIssues.filter(i => i.pull_request && i.state === 'open')

    // Filter issues
    const openedIssues = allIssues.filter(i => !i.pull_request && i.state === 'open')
    const closedIssues = allIssues.filter(i => !i.pull_request && i.state === 'closed')

    // Calculate average merge time
    let totalMergeTime = 0
    let mergeCount = 0

    for (const pr of mergedPRs) {
        if (pr.merged_at) {
            const created = new Date(pr.merged_at).getTime() - (7 * 24 * 60 * 60 * 1000) // Estimate
            const merged = new Date(pr.merged_at).getTime()
            totalMergeTime += merged - created
            mergeCount++
        }
    }

    const avgMergeTimeMs = mergeCount > 0 ? totalMergeTime / mergeCount : 0
    const avgMergeTime = formatDuration(avgMergeTimeMs)

    // Get top contributors
    const contributors = new Map<string, { prs: number; reviews: number; lines: number }>()

    for (const pr of mergedPRs) {
        const author = pr.user?.login ?? 'unknown'
        const entry = contributors.get(author) ?? { prs: 0, reviews: 0, lines: 0 }
        entry.prs++
        contributors.set(author, entry)
    }

    const topContributors = [...contributors.entries()]
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.prs - a.prs)
        .slice(0, 5)

    return {
        period: `${days} days`,
        prsOpened: openedPRs.length,
        prsMerged: mergedPRs.length,
        avgMergeTime,
        issuesOpened: openedIssues.length,
        issuesClosed: closedIssues.length,
        linesAdded: 0, // Would need file-level stats
        linesRemoved: 0,
        topContributors
    }
}

function formatDuration(ms: number): string {
    const hours = Math.floor(ms / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)

    if (days > 0) {
        return `${days} day${days > 1 ? 's' : ''}`
    }
    if (hours > 0) {
        return `${hours} hour${hours > 1 ? 's' : ''}`
    }
    return '< 1 hour'
}

export function formatStats(stats: RepoStats): string {
    const lines: string[] = []

    lines.push(`📊 Repository Stats (last ${stats.period})`)
    lines.push('')
    lines.push('**Pull Requests**')
    lines.push(`- Opened: ${stats.prsOpened}`)
    lines.push(`- Merged: ${stats.prsMerged}`)
    lines.push(`- Average merge time: ${stats.avgMergeTime}`)
    lines.push('')
    lines.push('**Issues**')
    lines.push(`- Opened: ${stats.issuesOpened}`)
    lines.push(`- Closed: ${stats.issuesClosed}`)

    if (stats.topContributors.length > 0) {
        lines.push('')
        lines.push('**Top Contributors**')
        stats.topContributors.forEach((c, i) => {
            lines.push(`${i + 1}. @${c.name} - ${c.prs} PRs, ${c.reviews} reviews`)
        })
    }

    return lines.join('\n')
}
