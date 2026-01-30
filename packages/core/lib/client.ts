import { IClientInput, IInput, IMethod } from '../index.d'

const API_BASE = 'https://api.github.com'

export class GitHubApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly body: unknown
    ) {
        super(message)
        this.name = 'GitHubApiError'
    }
}

export async function gh_client<T = unknown>(
    input: IInput,
    body: Record<string, unknown>,
    cinput: IClientInput
): Promise<T> {
    const url = `${API_BASE}${input.path}${input.query ? `?${input.query}` : ''}`
    const useBearer = input.useBearer !== false
    const auth = useBearer ? `Bearer ${input.token}` : `token ${input.token}`

    const headers: Record<string, string> = {
        Accept: 'application/vnd.github.v3+json',
        Authorization: auth,
    }
    const init: { method: string; headers: Record<string, string>; body?: string } = {
        method: cinput.method,
        headers,
    }
    if (cinput.method !== IMethod.GET && Object.keys(body).length > 0) {
        init.body = JSON.stringify(body)
    }

    const response = await fetch(url, init)
    const text = await response.text()
    const data = text ? (JSON.parse(text) as T) : null

    if (!response.ok) {
        throw new GitHubApiError(
            `GitHub API error: ${response.status} ${response.statusText}`,
            response.status,
            data
        )
    }

    return data as T
}
