import type { GitHubAppConfig } from '../github/types'

export function loadGitHubAppConfig(env: Record<string, string | undefined>): GitHubAppConfig {
    const appId = required(env.GH_PILOT_GITHUB_APP_ID, 'GH_PILOT_GITHUB_APP_ID')
    const privateKey = normalizePrivateKey(required(env.GH_PILOT_GITHUB_APP_PRIVATE_KEY, 'GH_PILOT_GITHUB_APP_PRIVATE_KEY'))
    const webhookSecret = required(env.GH_PILOT_GITHUB_WEBHOOK_SECRET, 'GH_PILOT_GITHUB_WEBHOOK_SECRET')
    const clientId = required(env.GH_PILOT_GITHUB_CLIENT_ID, 'GH_PILOT_GITHUB_CLIENT_ID')
    const appSlug = required(env.GH_PILOT_GITHUB_APP_SLUG, 'GH_PILOT_GITHUB_APP_SLUG')
    const clientSecret = optional(env.GH_PILOT_GITHUB_CLIENT_SECRET)

    return { appId, privateKey, webhookSecret, clientId, clientSecret, appSlug }
}

export function defaultDbPath(env: Record<string, string | undefined>): string {
    return optional(env.GH_PILOT_DB_PATH) ?? '.data/gh-pilot.sqlite'
}

function required(value: string | undefined, name: string): string {
    const normalized = optional(value)
    if (!normalized) throw new Error(`${name} is required`)
    return normalized
}

function optional(value: string | undefined): string | undefined {
    const normalized = value?.trim()
    return normalized ? normalized : undefined
}

function normalizePrivateKey(value: string): string {
    return value.includes('\\n') ? value.replace(/\\n/g, '\n') : value
}
