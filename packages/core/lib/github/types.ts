export type AuthMode = 'app' | 'installation' | 'user'

export interface GitHubAppConfig {
    appId: string
    privateKey: string
    clientId: string
    clientSecret?: string
    webhookSecret: string
    appSlug: string
}

export interface InstallationContext {
    installationId: number
    owner: string
    repo?: string
}

export interface GitHubRepositoryRef {
    id?: number
    owner: string
    name: string
    fullName: string
}

export interface GitHubInstallationAccount {
    login: string
    type: string
}

export interface GitHubInstallation {
    id: number
    account?: GitHubInstallationAccount
    repository_selection?: string
}

export interface InstallationAccessToken {
    token: string
    expires_at: string
    permissions?: Record<string, string>
    repository_selection?: string
}

export interface GitHubUser {
    id: number
    login: string
    name?: string | null
}

export interface GitHubIssueLike {
    number: number
    title: string
    html_url: string
    state: string
    user?: { login: string }
    assignees?: Array<{ login: string }>
    requested_reviewers?: Array<{ login: string }>
    pull_request?: unknown
    updated_at: string
}

export interface GitHubSearchResponse<T> {
    total_count: number
    incomplete_results: boolean
    items: T[]
}

