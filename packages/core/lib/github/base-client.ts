import { GitHubApiError } from '../client'
import { createLogger } from '../logger'

const log = createLogger('github-api')

export const GITHUB_API_BASE = 'https://api.github.com'

export interface GitHubRequestOptions {
    token: string
    method?: string
    path: string
    query?: Record<string, string | number | boolean | undefined>
    body?: unknown
    accept?: string
}

export class RateLimitError extends GitHubApiError {
    constructor(
        message: string,
        public readonly resetAt: number,
        body?: unknown
    ) {
        super(message, 403, body)
        this.name = 'RateLimitError'
    }
}

export async function githubRequest<T>(options: GitHubRequestOptions): Promise<T> {
    const url = new URL(options.path, GITHUB_API_BASE)
    for (const [key, value] of Object.entries(options.query ?? {})) {
        if (value !== undefined) url.searchParams.set(key, String(value))
    }

    const headers: Record<string, string> = {
        Accept: options.accept ?? 'application/vnd.github+json',
        Authorization: `Bearer ${options.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
    }

    const init: RequestInit = {
        method: options.method ?? 'GET',
        headers,
    }

    if (options.body !== undefined) {
        headers['Content-Type'] = 'application/json'
        init.body = JSON.stringify(options.body)
    }

    const response = await fetch(url, init)
    const remaining = response.headers.get('X-RateLimit-Remaining')
    const reset = response.headers.get('X-RateLimit-Reset')

    if (remaining !== null && reset !== null) {
        const remainingNum = parseInt(remaining, 10)
        const resetAt = parseInt(reset, 10) * 1000
        if (remainingNum < 5) {
            log.warn('GitHub rate limit nearly exhausted', {
                remaining: remainingNum,
                resetAt: new Date(resetAt).toISOString(),
                path: options.path,
            })
        }
    }

    const text = await response.text()
    const data = text ? safeJson(text) : null

    if (!response.ok) {
        if (response.status === 403 && isRateLimitError(data)) {
            const resetAt = reset ? parseInt(reset, 10) * 1000 : Date.now() + 60000
            throw new RateLimitError(
                `GitHub rate limit exceeded. Resets at ${new Date(resetAt).toISOString()}`,
                resetAt,
                data
            )
        }

        throw new GitHubApiError(
            `GitHub API error: ${response.status} ${response.statusText}`,
            response.status,
            data
        )
    }

    return data as T
}

export function apiPathFromUrl(urlOrPath: string): string {
    return urlOrPath.startsWith(GITHUB_API_BASE)
        ? urlOrPath.slice(GITHUB_API_BASE.length)
        : urlOrPath
}

function safeJson(text: string): unknown {
    try {
        return JSON.parse(text)
    } catch {
        return text
    }
}

function isRateLimitError(data: unknown): boolean {
    if (!data || typeof data !== 'object') return false
    const obj = data as Record<string, unknown>
    return obj.message === 'API rate limit exceeded' ||
        (typeof obj.message === 'string' && obj.message.includes('rate limit'))
}
