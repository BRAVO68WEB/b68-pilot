import type { GitHubInstallationClient } from '../github/installation-client'
import type { CommandResult } from '@pilot/plugin-sdk'
import { parseBotCommand, type ParsedBotCommand } from './parser'
import { CommandRegistry } from './registry'
import { createBuiltinCommands } from './builtin-handlers'

export interface BotCommandContext {
    appSlug: string
    owner: string
    repo: string
    issueNumber: number
    issueApiUrl: string
    isPullRequest: boolean
    commentBody: string | null | undefined
    installationId: number
    triggeredBy?: string
}

export interface BotCommandResult {
    command: string
    message: string
    acted: boolean
}

/** Create a CommandRegistry with all built-in commands registered */
export function createCommandRegistry(gh: GitHubInstallationClient): CommandRegistry {
    const registry = new CommandRegistry()
    const builtins = createBuiltinCommands(gh)

    registry.registerBuiltin('close', builtins.close, {
        aliases: ['close issue', 'close pr'],
        description: 'Close an issue or pull request',
    })
    registry.registerBuiltin('approve', builtins.approve, {
        aliases: ['approve pr'],
        description: 'Approve a pull request',
    })
    registry.registerBuiltin('merge', builtins.merge, {
        aliases: ['merge pr'],
        description: 'Merge a pull request',
    })
    registry.registerBuiltin('status', builtins.status, {
        description: 'Check bot status',
    })
    registry.registerBuiltin('summarize', builtins.summarize, {
        aliases: ['summary'],
        description: 'Summarize a pull request diff',
    })
    registry.registerBuiltin('tag', builtins.tag, {
        description: 'Create a git tag',
    })
    registry.registerBuiltin('release', builtins.release, {
        description: 'Create a release',
    })
    registry.registerBuiltin('automerge', builtins.automerge, {
        aliases: ['auto-merge'],
        description: 'Enable auto-merge for a PR',
    })
    registry.registerBuiltin('stale', builtins.stale, {
        description: 'Check or manage stale issues',
    })
    registry.registerBuiltin('stats', builtins.stats, {
        aliases: ['statistics'],
        description: 'Show activity stats',
    })

    return registry
}

/**
 * Execute a bot command using the CommandRegistry.
 * This is the new entry point — replaces the old hardcoded if/else executor.
 */
export async function executeBotCommand(
    gh: GitHubInstallationClient,
    context: BotCommandContext,
    registry?: CommandRegistry
): Promise<BotCommandResult | null> {
    const parsed = parseBotCommand(context.commentBody, context.appSlug)
    if (!parsed) return null

    // Use provided registry or create a default one with builtins
    const cmdRegistry = registry ?? createCommandRegistry(gh)

    // Extract args: everything after the command name
    const args = parsed.raw.split(/\s+/).slice(1)

    const result = await cmdRegistry.dispatch(parsed.command, args, {
        github: createPluginGitHubAdapter(gh),
        store: createNoopStore(),
        config: createDefaultConfig(context.repo),
        logger: createConsoleLogger(),
        owner: context.owner,
        repo: context.repo,
        issueNumber: context.issueNumber,
        isPullRequest: context.isPullRequest,
        commentBody: context.commentBody ?? '',
        installationId: context.installationId,
        triggeredBy: context.triggeredBy ?? 'unknown',
    })

    if (!result) return null

    return {
        command: parsed.command,
        message: result.message,
        acted: result.acted,
    }
}

/**
 * Adapter: bridge GitHubInstallationClient to PluginGitHubClient interface.
 */
function createPluginGitHubAdapter(gh: GitHubInstallationClient) {
    return {
        comment: async (owner: string, repo: string, issueNumber: number, body: string): Promise<void> => {
            await gh.comment(owner, repo, issueNumber, body)
        },
        closeIssue: async (owner: string, repo: string, issueNumber: number): Promise<void> => {
            await gh.closeIssueOrPull(`/repos/${owner}/${repo}/issues/${issueNumber}`)
        },
        getIssue: async (owner: string, repo: string, issueNumber: number) => {
            const issue = await gh.get<{ number: number; title: string; body: string | null; state: string; html_url: string; user?: { login: string }; assignees?: Array<{ login: string }>; labels?: Array<{ name: string }> }>(
                `/repos/${owner}/${repo}/issues/${issueNumber}`
            )
            return issue
        },
        addLabels: async (owner: string, repo: string, issueNumber: number, labels: string[]): Promise<void> => {
            await gh.addLabels(owner, repo, issueNumber, labels)
        },
        removeLabel: async (owner: string, repo: string, issueNumber: number, label: string): Promise<void> => {
            await gh.removeLabel(owner, repo, issueNumber, label)
        },
        getLabels: (owner: string, repo: string, issueNumber: number) =>
            gh.getLabels(owner, repo, issueNumber),
        approvePull: async (owner: string, repo: string, pullNumber: number, body?: string): Promise<void> => {
            await gh.approvePull(owner, repo, pullNumber, body)
        },
        mergePull: async (owner: string, repo: string, pullNumber: number): Promise<void> => {
            await gh.mergePull(owner, repo, pullNumber)
        },
        requestChanges: async (owner: string, repo: string, pullNumber: number, body: string): Promise<void> => {
            await gh.request('POST', `/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`, { event: 'REQUEST_CHANGES', body })
        },
        getPullFiles: (owner: string, repo: string, pullNumber: number) =>
            gh.getPullFiles(owner, repo, pullNumber),
        assign: async (owner: string, repo: string, issueNumber: number, users: string[]): Promise<void> => {
            await gh.request('POST', `/repos/${owner}/${repo}/issues/${issueNumber}/assignees`, { assignees: users })
        },
        unassign: async (owner: string, repo: string, issueNumber: number, users: string[]): Promise<void> => {
            await gh.request('DELETE', `/repos/${owner}/${repo}/issues/${issueNumber}/assignees`, { assignees: users })
        },
        request: <T>(method: string, path: string, body?: unknown) =>
            gh.request<T>(method, path, body),
    }
}

/** No-op store for backward compatibility when no plugin store is available */
function createNoopStore() {
    return {
        get: async () => null,
        set: async () => {},
        delete: async () => {},
        list: async () => [],
    }
}

function createDefaultConfig(repo: string) {
    return {
        repo,
        enabled: true,
        plugins: [],
        rules: [],
        commands: [],
        notifications: {},
        automation: {
            autoRelease: true,
            defaultBump: 'patch' as const,
            staleDays: 15,
            staleCloseDays: 7,
            reviewStrategy: 'round-robin' as const,
            reviewers: [],
        },
    }
}

function createConsoleLogger() {
    return {
        info: (msg: string, data?: Record<string, unknown>) => console.log('[plugin]', msg, data ?? ''),
        warn: (msg: string, data?: Record<string, unknown>) => console.warn('[plugin]', msg, data ?? ''),
        error: (msg: string, data?: Record<string, unknown>) => console.error('[plugin]', msg, data ?? ''),
        debug: (msg: string, data?: Record<string, unknown>) => console.debug('[plugin]', msg, data ?? ''),
    }
}

// Re-export for backward compatibility
export { parseBotCommand } from './parser'
export type { ParsedBotCommand } from './parser'
