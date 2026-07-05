import { GitHubAppClient } from './app-client'
import { apiPathFromUrl, githubRequest } from './base-client'
import type { GitHubIssueLike, InstallationAccessToken } from './types'

interface CachedInstallationToken {
    token: string
    expiresAt: number
}

export class InstallationTokenCache {
    private readonly tokens = new Map<number, CachedInstallationToken>()

    constructor(private readonly appClient: GitHubAppClient) {}

    async tokenFor(installationId: number): Promise<string> {
        const cached = this.tokens.get(installationId)
        if (cached && cached.expiresAt - Date.now() > 5 * 60 * 1000) {
            return cached.token
        }

        const created = await this.appClient.createInstallationAccessToken(installationId)
        this.tokens.set(installationId, {
            token: created.token,
            expiresAt: Date.parse(created.expires_at),
        })
        return created.token
    }
}

export class GitHubInstallationClient {
    constructor(private readonly token: string) {}

    static async create(
        installationId: number,
        cache: InstallationTokenCache
    ): Promise<GitHubInstallationClient> {
        return new GitHubInstallationClient(await cache.tokenFor(installationId))
    }

    request<T>(method: string, path: string, body?: unknown): Promise<T> {
        return githubRequest<T>({
            token: this.token,
            method,
            path: apiPathFromUrl(path),
            body,
        })
    }

    get<T>(path: string): Promise<T> {
        return this.request<T>('GET', path)
    }

    async closeIssueOrPull(url: string): Promise<unknown> {
        return this.request('PATCH', url, { state: 'closed' })
    }

    async comment(owner: string, repo: string, issueNumber: number, body: string): Promise<unknown> {
        return this.request('POST', `/repos/${owner}/${repo}/issues/${issueNumber}/comments`, { body })
    }

    async approvePull(owner: string, repo: string, pullNumber: number, body = 'Approved by b68-pilot.'): Promise<unknown> {
        return this.request('POST', `/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`, {
            event: 'APPROVE',
            body,
        })
    }

    async mergePull(owner: string, repo: string, pullNumber: number): Promise<unknown> {
        return this.request('PUT', `/repos/${owner}/${repo}/pulls/${pullNumber}/merge`, {
            commit_title: `Merge pull request #${pullNumber} from b68-pilot`,
            commit_message: 'Merged by b68-pilot.',
        })
    }

    async listOpenIssues(owner: string, repo: string): Promise<GitHubIssueLike[]> {
        return this.request<GitHubIssueLike[]>('GET', `/repos/${owner}/${repo}/issues?state=open`)
    }

    async listRepositories(): Promise<Array<{ full_name: string; name: string; owner: { login: string } }>> {
        const response = await this.request<{ repositories: Array<{ full_name: string; name: string; owner: { login: string } }> }>(
            'GET',
            '/installation/repositories?per_page=100'
        )
        return response.repositories
    }

    async listOpenPulls(owner: string, repo: string): Promise<Array<{
        number: number
        title: string
        html_url: string
        state: string
        user?: { login: string }
        assignees?: Array<{ login: string }>
        requested_reviewers?: Array<{ login: string }>
        updated_at: string
    }>> {
        return this.request('GET', `/repos/${owner}/${repo}/pulls?state=open&per_page=100`)
    }

    // Tag operations
    async getLatestTag(owner: string, repo: string): Promise<{ name: string; sha: string } | null> {
        const tags = await this.request<Array<{ name: string; commit: { sha: string } }>>(
            'GET',
            `/repos/${owner}/${repo}/tags?per_page=1`
        )
        return tags.length > 0 ? { name: tags[0].name, sha: tags[0].commit.sha } : null
    }

    async createTag(owner: string, repo: string, tag: string, sha: string, message: string): Promise<{ sha: string }> {
        return this.request('POST', `/repos/${owner}/${repo}/git/tags`, {
            tag,
            message,
            object: sha,
            type: 'commit'
        })
    }

    async createRef(owner: string, repo: string, ref: string, sha: string): Promise<void> {
        await this.request('POST', `/repos/${owner}/${repo}/git/refs`, { ref, sha })
    }

    async listTags(owner: string, repo: string): Promise<Array<{ name: string }>> {
        return this.request('GET', `/repos/${owner}/${repo}/tags?per_page=100`)
    }

    // Release operations
    async createRelease(owner: string, repo: string, options: {
        tag_name: string
        name?: string
        body?: string
        draft?: boolean
        prerelease?: boolean
        target_commitish?: string
    }): Promise<{ html_url: string; id: number }> {
        return this.request('POST', `/repos/${owner}/${repo}/releases`, options)
    }

    // PR operations
    async getClosedPullsSince(owner: string, repo: string, since: string): Promise<Array<{
        number: number
        title: string
        html_url: string
        merged_at: string | null
        user?: { login: string }
        labels?: Array<{ name: string }>
    }>> {
        return this.request('GET', `/repos/${owner}/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=100`)
    }

    async getPullFiles(owner: string, repo: string, prNumber: number): Promise<Array<{
        filename: string
        additions: number
        deletions: number
        status: string
    }>> {
        return this.request('GET', `/repos/${owner}/${repo}/pulls/${prNumber}/files`)
    }

    async getLabels(owner: string, repo: string, issueNumber: number): Promise<Array<{ name: string }>> {
        return this.request('GET', `/repos/${owner}/${repo}/issues/${issueNumber}/labels`)
    }

    async addLabels(owner: string, repo: string, issueNumber: number, labels: string[]): Promise<void> {
        await this.request('POST', `/repos/${owner}/${repo}/issues/${issueNumber}/labels`, { labels })
    }

    async removeLabel(owner: string, repo: string, issueNumber: number, label: string): Promise<void> {
        await this.request('DELETE', `/repos/${owner}/${repo}/issues/${issueNumber}/labels/${encodeURIComponent(label)}`)
    }

    // Issue operations
    async getIssuesSince(owner: string, repo: string, since: string): Promise<GitHubIssueLike[]> {
        return this.request('GET', `/repos/${owner}/${repo}/issues?state=all&since=${since}&per_page=100`)
    }

    // File operations
    async getFileContent(owner: string, repo: string, path: string): Promise<{ content: string; sha: string } | null> {
        try {
            return await this.request('GET', `/repos/${owner}/${repo}/contents/${path}`)
        } catch {
            return null
        }
    }

    async updateFile(owner: string, repo: string, path: string, message: string, content: string, sha?: string): Promise<void> {
        await this.request('PUT', `/repos/${owner}/${repo}/contents/${path}`, {
            message,
            content: Buffer.from(content).toString('base64'),
            sha
        })
    }
}

export type { InstallationAccessToken }

