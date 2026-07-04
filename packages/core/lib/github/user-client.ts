import { githubRequest } from './base-client'
import type { GitHubIssueLike, GitHubSearchResponse, GitHubUser } from './types'
import { splitFullName, type WorkItem, workItemId } from '../work-items/model'

export class GitHubUserClient {
    constructor(private readonly token: string) {}

    me(): Promise<GitHubUser> {
        return githubRequest<GitHubUser>({ token: this.token, path: '/user' })
    }

    async listInstallations(): Promise<unknown[]> {
        const response = await githubRequest<{ installations: unknown[] }>({
            token: this.token,
            path: '/user/installations',
        })
        return response.installations
    }

    async searchIssues(query: string): Promise<GitHubIssueLike[]> {
        const response = await githubRequest<GitHubSearchResponse<GitHubIssueLike>>({
            token: this.token,
            path: '/search/issues',
            query: { q: query, per_page: 50 },
        })
        return response.items
    }

    async nextWorkItems(login: string, repo?: string): Promise<WorkItem[]> {
        const repoQualifier = repo ? ` repo:${repo}` : ''
        const queries = [
            { type: 'issue' as const, reason: 'assigned', q: `is:issue is:open assignee:${login}${repoQualifier}` },
            { type: 'review_request' as const, reason: 'review requested', q: `is:pr is:open review-requested:${login}${repoQualifier}` },
            { type: 'pull_request' as const, reason: 'authored PR', q: `is:pr is:open author:${login}${repoQualifier}` },
            { type: 'mention' as const, reason: 'mentioned', q: `is:open mentions:${login}${repoQualifier}` },
        ]

        const results = await Promise.all(
            queries.map(async (query) => ({
                ...query,
                items: await this.searchIssues(query.q),
            }))
        )

        const byId = new Map<string, WorkItem>()
        for (const result of results) {
            for (const item of result.items) {
                const fullName = repoNameFromIssueUrl(item.html_url)
                if (!fullName) continue
                const { owner, repo: repoName } = splitFullName(fullName)
                const type = item.pull_request && result.type === 'issue' ? 'pull_request' : result.type
                const id = workItemId(owner, repoName, type, item.number)
                if (byId.has(id)) continue
                byId.set(id, {
                    id,
                    source: 'query',
                    owner,
                    repo: repoName,
                    type,
                    number: item.number,
                    title: item.title,
                    url: item.html_url,
                    reason: result.reason,
                    actor: item.user?.login,
                    assignees: item.assignees?.map((user) => user.login) ?? [],
                    requestedReviewers: item.requested_reviewers?.map((user) => user.login) ?? [],
                    state: item.state === 'open' ? 'open' : 'closed',
                    updatedAt: item.updated_at,
                })
            }
        }

        return [...byId.values()].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    }
}

function repoNameFromIssueUrl(url: string): string | null {
    const match = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/(?:issues|pull)\/\d+/.exec(url)
    return match?.[1] ?? null
}

