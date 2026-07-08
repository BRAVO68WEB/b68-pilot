import type { GitHubInstallationClient } from '../github/installation-client'

export type ReviewStrategy = 'round-robin' | 'codeowners' | 'load-balancing'

export interface ReviewAssignConfig {
    strategy: ReviewStrategy
    reviewers: string[]
}

export function getReviewAssignConfig(): ReviewAssignConfig {
    return {
        strategy: (Bun.env.GH_PILOT_REVIEW_STRATEGY ?? 'round-robin') as ReviewStrategy,
        reviewers: (Bun.env.GH_PILOT_REVIEWERS ?? '').split(',').map(r => r.trim()).filter(Boolean)
    }
}

let lastAssignedIndex = 0

export async function assignReviewers(
    gh: GitHubInstallationClient,
    owner: string,
    repo: string,
    prNumber: number,
    config: ReviewAssignConfig
): Promise<string[]> {
    switch (config.strategy) {
        case 'round-robin':
            return assignRoundRobin(gh, owner, repo, prNumber, config.reviewers)
        case 'codeowners':
            return assignCodeowners(gh, owner, repo, prNumber)
        case 'load-balancing':
            return assignLoadBalancing(gh, owner, repo, prNumber, config.reviewers)
        default:
            return []
    }
}

async function assignRoundRobin(
    gh: GitHubInstallationClient,
    owner: string,
    repo: string,
    prNumber: number,
    reviewers: string[]
): Promise<string[]> {
    if (reviewers.length === 0) return []

    const reviewer = reviewers[lastAssignedIndex % reviewers.length]
    lastAssignedIndex++

    await gh.request('POST', `/repos/${owner}/${repo}/pulls/${prNumber}/requested_reviewers`, {
        reviewers: [reviewer]
    })

    return [reviewer]
}

async function assignCodeowners(
    gh: GitHubInstallationClient,
    owner: string,
    repo: string,
    prNumber: number
): Promise<string[]> {
    // Get CODEOWNERS file
    const codeowners = await gh.getFileContent(owner, repo, '.github/CODEOWNERS')
    if (!codeowners) return []

    const content = Buffer.from(codeowners.content, 'base64').toString('utf-8')

    // Get PR files
    const files = await gh.getPullFiles(owner, repo, prNumber)
    const changedFiles = files.map(f => f.filename)

    // Parse CODEOWNERS and find matching reviewers
    const reviewers = new Set<string>()

    for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue

        const parts = trimmed.split(/\s+/)
        if (parts.length < 2) continue

        const pattern = parts[0]
        const owners = parts.slice(1)

        // Check if any changed file matches the pattern
        const regex = pattern
            .replace(/\*\*/g, '.*')
            .replace(/\*/g, '[^/]*')
            .replace(/\?/g, '[^/]')
            .replace(/\./g, '\\.')

        if (changedFiles.some(f => new RegExp(`^${regex}$`).test(f))) {
            owners.forEach(o => reviewers.add(o.replace('@', '')))
        }
    }

    if (reviewers.size === 0) return []

    const reviewerList = [...reviewers]
    await gh.request('POST', `/repos/${owner}/${repo}/pulls/${prNumber}/requested_reviewers`, {
        reviewers: reviewerList
    })

    return reviewerList
}

async function assignLoadBalancing(
    gh: GitHubInstallationClient,
    owner: string,
    repo: string,
    prNumber: number,
    reviewers: string[]
): Promise<string[]> {
    if (reviewers.length === 0) return []

    // Get active review counts for each reviewer
    const reviewCounts: Record<string, number> = {}

    for (const reviewer of reviewers) {
        // Count open PRs where this reviewer is requested
        const prs = await gh.request<any[]>('GET', `/repos/${owner}/${repo}/pulls?state=open&review_requested=${reviewer}`)
        reviewCounts[reviewer] = prs.length
    }

    // Find reviewer with fewest active reviews
    const sortedReviewers = reviewers.sort((a, b) => (reviewCounts[a] ?? 0) - (reviewCounts[b] ?? 0))
    const reviewer = sortedReviewers[0]

    await gh.request('POST', `/repos/${owner}/${repo}/pulls/${prNumber}/requested_reviewers`, {
        reviewers: [reviewer]
    })

    return [reviewer]
}
