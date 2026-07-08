import { IMethod } from '..'
import { gh_client } from './client'

const API_BASE = 'https://api.github.com'

function pathFromUrl(url: string): string {
    return url.replace(API_BASE, '')
}

export class GitHub {
    constructor(private readonly token: string) {}

    private request<T>(
        method: IMethod,
        path: string,
        body: Record<string, unknown> = {}
    ): Promise<T> {
        return gh_client<T>(
            { path, token: this.token, useBearer: true },
            body,
            { method }
        )
    }

    async notifications(): Promise<GitHubNotification[]> {
        return this.request<GitHubNotification[]>(IMethod.GET, '/notifications')
    }

    async markAsRead(url: string): Promise<unknown> {
        return this.request(IMethod.PATCH, pathFromUrl(url))
    }

    async fetch<T = unknown>(url: string): Promise<T> {
        return this.request<T>(IMethod.GET, pathFromUrl(url))
    }

    async listIssues(owner: string, repo: string): Promise<unknown[]> {
        return this.request<unknown[]>(IMethod.GET, `/repos/${owner}/${repo}/issues`)
    }

    async listPRs(owner: string, repo: string): Promise<unknown[]> {
        return this.request<unknown[]>(IMethod.GET, `/repos/${owner}/${repo}/pulls`)
    }

    async close(url: string): Promise<unknown> {
        return this.request(IMethod.PATCH, pathFromUrl(url), { state: 'closed' })
    }

    async approvePR(url: string): Promise<unknown> {
        return this.request(IMethod.POST, pathFromUrl(url) + '/reviews', {
            event: 'APPROVE',
            body: 'LGTM',
        })
    }

    async mergePR(url: string): Promise<unknown> {
        return this.request(IMethod.PUT, pathFromUrl(url) + '/merge', {
            commit_title: 'Merged by @gh-pilot',
            commit_message: 'Merged by @gh-pilot',
        })
    }
}

/** Minimal type for GitHub notification items from /notifications */
export interface GitHubNotification {
    id: string
    url: string
    reason: string
    subject: { url: string; latest_comment_url?: string }
    repository: { full_name: string }
}
