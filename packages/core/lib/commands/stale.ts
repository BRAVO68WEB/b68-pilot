import type { GitHubInstallationClient } from '../github/installation-client'
import type { PilotStore } from '../storage/sqlite'

export interface StaleConfig {
    days: number
    closeDays: number
    exemptLabels: string[]
    behavior: 'label' | 'label-then-close'
    staleLabel: string
}

export function getStaleConfig(): StaleConfig {
    return {
        days: parseInt(Bun.env.GH_PILOT_STALE_DAYS ?? '15'),
        closeDays: parseInt(Bun.env.GH_PILOT_STALE_CLOSE_DAYS ?? '7'),
        exemptLabels: (Bun.env.GH_PILOT_STALE_EXEMPT_LABELS ?? 'pinned,security,bug').split(',').map(l => l.trim()),
        behavior: (Bun.env.GH_PILOT_STALE_BEHAVIOR ?? 'label-then-close') as 'label' | 'label-then-close',
        staleLabel: Bun.env.GH_PILOT_STALE_LABEL ?? 'stale'
    }
}

export async function checkStaleIssues(
    gh: GitHubInstallationClient,
    owner: string,
    repo: string,
    config: StaleConfig
): Promise<{ marked: number; closed: number }> {
    const now = new Date()
    const staleDate = new Date(now.getTime() - config.days * 24 * 60 * 60 * 1000)
    const closeDate = new Date(now.getTime() - config.closeDays * 24 * 60 * 60 * 1000)

    // Get all open issues
    const issues = await gh.getIssuesSince(owner, repo, staleDate.toISOString())

    let marked = 0
    let closed = 0

    for (const issue of issues) {
        // Skip pull requests
        if (issue.pull_request) continue

        // Check if issue has exempt labels
        const labels = issue.assignees?.map((a: any) => a.login) ?? []
        if (config.exemptLabels.some(l => labels.includes(l))) continue

        const updatedAt = new Date(issue.updated_at)

        // Check if issue is stale
        if (updatedAt < staleDate) {
            const hasStaleLabel = labels.includes(config.staleLabel)

            if (config.behavior === 'label-then-close' && hasStaleLabel) {
                // Check if it's time to close
                if (updatedAt < closeDate) {
                    await gh.closeIssueOrPull(issue.html_url)
                    await gh.comment(owner, repo, issue.number,
                        `This issue has been automatically closed due to inactivity. Feel free to reopen if it's still relevant.`
                    )
                    closed++
                }
            } else if (!hasStaleLabel) {
                // Mark as stale
                await gh.addLabels(owner, repo, issue.number, [config.staleLabel])
                await gh.comment(owner, repo, issue.number,
                    `This issue has been automatically marked as stale due to inactivity. It will be closed in ${config.closeDays} days if no further activity occurs.`
                )
                marked++
            }
        }
    }

    return { marked, closed }
}

export async function excludeFromStale(
    gh: GitHubInstallationClient,
    owner: string,
    repo: string,
    issueNumber: number,
    config: StaleConfig
): Promise<void> {
    // Remove stale label if present
    try {
        await gh.removeLabel(owner, repo, issueNumber, config.staleLabel)
    } catch {
        // Label might not be present
    }

    // Add exempt label
    await gh.addLabels(owner, repo, issueNumber, ['pinned'])
}
