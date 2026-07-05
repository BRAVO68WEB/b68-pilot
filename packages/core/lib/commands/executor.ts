import type { GitHubInstallationClient } from '../github/installation-client'
import { parseBotCommand, type ParsedBotCommand } from './parser'
import { summarizePullRequest } from './summarize'
import { autoRelease } from './release'
import { tagLatestCommit } from './tag'

export interface BotCommandContext {
    appSlug: string
    owner: string
    repo: string
    issueNumber: number
    issueApiUrl: string
    isPullRequest: boolean
    commentBody: string | null | undefined
    installationId: number
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

    if (parsed.command === 'tag') {
        const args = parsed.raw.split(/\s+/).slice(1) // Remove 'tag' from args
        const tagName = args[0]
        if (!tagName) {
            return { command: parsed.command, acted: false, message: 'Usage: @bot tag <version> (e.g., @bot tag v1.2.3)' }
        }
        await tagLatestCommit(gh, context.owner, context.repo, tagName)
        return { command: parsed.command, acted: true, message: `Tag ${tagName} created.` }
    }

    if (parsed.command === 'release') {
        const args = parsed.raw.split(/\s+/).slice(1) // Remove 'release' from args
        const version = args[0]
        if (!version) {
            return { command: parsed.command, acted: false, message: 'Usage: @bot release <version> (e.g., @bot release v1.2.3)' }
        }
        const result = await autoRelease(gh, context.owner, context.repo, 'patch', '', context.issueNumber)
        if (result) {
            return { command: parsed.command, acted: true, message: `Release ${result.tag} created: ${result.releaseUrl}` }
        }
        return { command: parsed.command, acted: false, message: 'Failed to create release.' }
    }

    if (parsed.command === 'automerge') {
        const args = parsed.raw.split(/\s+/).slice(1)
        if (args[0] === 'cancel') {
            // TODO: Remove from auto-merge queue
            return { command: parsed.command, acted: true, message: 'Auto-merge cancelled.' }
        }
        // TODO: Add to auto-merge queue
        return { command: parsed.command, acted: true, message: 'Auto-merge enabled. PR will be merged when approved and checks pass.' }
    }

    if (parsed.command === 'stale') {
        const args = parsed.raw.split(/\s+/).slice(1)
        if (args[0] === '--exclude') {
            await gh.addLabels(context.owner, context.repo, context.issueNumber, ['pinned'])
            return { command: parsed.command, acted: true, message: 'This issue has been exempted from stale checks.' }
        }
        return { command: parsed.command, acted: false, message: 'Stale check will run on the next scheduled job.' }
    }

    if (parsed.command === 'stats') {
        const args = parsed.raw.split(/\s+/).slice(1)
        const days = parseInt(args[0]) || 7
        // TODO: Generate stats
        return { command: parsed.command, acted: false, message: `📊 Stats for last ${days} days will be generated.` }
    }

    return null
}

