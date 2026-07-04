import type { GitHubInstallationClient } from '../github/installation-client'
import { parseBotCommand, type ParsedBotCommand } from './parser'
import { summarizePullRequest } from './summarize'

export interface BotCommandContext {
    appSlug: string
    owner: string
    repo: string
    issueNumber: number
    issueApiUrl: string
    isPullRequest: boolean
    commentBody: string | null | undefined
}

export interface BotCommandResult {
    command: ParsedBotCommand['command']
    message: string
    acted: boolean
}

export async function executeBotCommand(
    gh: GitHubInstallationClient,
    context: BotCommandContext
): Promise<BotCommandResult | null> {
    const parsed = parseBotCommand(context.commentBody, context.appSlug)
    if (!parsed) return null

    if (parsed.command === 'close') {
        await gh.closeIssueOrPull(context.issueApiUrl)
        return { command: parsed.command, acted: true, message: 'Closed.' }
    }

    if (parsed.command === 'approve') {
        if (!context.isPullRequest) {
            return { command: parsed.command, acted: false, message: 'Approve only works on pull requests.' }
        }
        await gh.approvePull(context.owner, context.repo, context.issueNumber)
        return { command: parsed.command, acted: true, message: 'Approved.' }
    }

    if (parsed.command === 'merge') {
        if (!context.isPullRequest) {
            return { command: parsed.command, acted: false, message: 'Merge only works on pull requests.' }
        }
        await gh.mergePull(context.owner, context.repo, context.issueNumber)
        return { command: parsed.command, acted: true, message: 'Merged.' }
    }

    if (parsed.command === 'status') {
        return { command: parsed.command, acted: false, message: 'I am connected and watching this repository.' }
    }

    if (parsed.command === 'summarize') {
        if (!context.isPullRequest) {
            return { command: parsed.command, acted: false, message: 'Summarize only works on pull requests.' }
        }
        const summary = await summarizePullRequest(gh, context.owner, context.repo, context.issueNumber)
        return { command: parsed.command, acted: false, message: summary }
    }

    return null
}

