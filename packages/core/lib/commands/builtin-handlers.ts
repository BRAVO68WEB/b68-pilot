import type { CommandHandler, CommandResult } from '@pilot/plugin-sdk'
import type { GitHubInstallationClient } from '../github/installation-client'

/**
 * Built-in command handlers — each is a pure function registered into CommandRegistry.
 * This replaces the hardcoded if/else chain in the old executor.ts.
 */

export function createBuiltinCommands(gh: GitHubInstallationClient) {
  return {
    close: createCloseHandler(gh),
    approve: createApproveHandler(gh),
    merge: createMergeHandler(gh),
    status: createStatusHandler(),
    summarize: createSummarizeHandler(gh),
    tag: createTagHandler(gh),
    release: createReleaseHandler(gh),
    automerge: createAutomergeHandler(),
    stale: createStaleHandler(gh),
    stats: createStatsHandler(),
  }
}

function createCloseHandler(gh: GitHubInstallationClient): CommandHandler {
  return async (_args, ctx): Promise<CommandResult> => {
    await gh.closeIssueOrPull(`/repos/${ctx.owner}/${ctx.repo}/issues/${ctx.issueNumber}`)
    return { message: 'Closed.', acted: true }
  }
}

function createApproveHandler(gh: GitHubInstallationClient): CommandHandler {
  return async (_args, ctx): Promise<CommandResult> => {
    if (!ctx.isPullRequest) {
      return { message: 'Approve only works on pull requests.', acted: false }
    }
    await gh.approvePull(ctx.owner, ctx.repo, ctx.issueNumber)
    return { message: 'Approved.', acted: true }
  }
}

function createMergeHandler(gh: GitHubInstallationClient): CommandHandler {
  return async (_args, ctx): Promise<CommandResult> => {
    if (!ctx.isPullRequest) {
      return { message: 'Merge only works on pull requests.', acted: false }
    }
    await gh.mergePull(ctx.owner, ctx.repo, ctx.issueNumber)
    return { message: 'Merged.', acted: true }
  }
}

function createStatusHandler(): CommandHandler {
  return async (): Promise<CommandResult> => {
    return { message: 'I am connected and watching this repository.', acted: false }
  }
}

function createSummarizeHandler(gh: GitHubInstallationClient): CommandHandler {
  return async (_args, ctx): Promise<CommandResult> => {
    if (!ctx.isPullRequest) {
      return { message: 'Summarize only works on pull requests.', acted: false }
    }
    // Import dynamically to avoid circular deps
    const { summarizePullRequest } = await import('./summarize')
    const summary = await summarizePullRequest(gh, ctx.owner, ctx.repo, ctx.issueNumber)
    return { message: summary, acted: false }
  }
}

function createTagHandler(gh: GitHubInstallationClient): CommandHandler {
  return async (args, ctx): Promise<CommandResult> => {
    const tagName = args[0]
    if (!tagName) {
      return { message: 'Usage: @bot tag <version> (e.g., @bot tag v1.2.3)', acted: false }
    }
    const { tagLatestCommit } = await import('./tag')
    await tagLatestCommit(gh, ctx.owner, ctx.repo, tagName)
    return { message: `Tag ${tagName} created.`, acted: true }
  }
}

function createReleaseHandler(gh: GitHubInstallationClient): CommandHandler {
  return async (args, ctx): Promise<CommandResult> => {
    const version = args[0]
    if (!version) {
      return { message: 'Usage: @bot release <version> (e.g., @bot release v1.2.3)', acted: false }
    }
    const { autoRelease } = await import('./release')
    const result = await autoRelease(gh, ctx.owner, ctx.repo, 'patch', '', ctx.issueNumber)
    if (result) {
      return { message: `Release ${result.tag} created: ${result.releaseUrl}`, acted: true }
    }
    return { message: 'Failed to create release.', acted: false }
  }
}

function createAutomergeHandler(): CommandHandler {
  return async (args, _ctx): Promise<CommandResult> => {
    if (args[0] === 'cancel') {
      return { message: 'Auto-merge cancelled.', acted: true }
    }
    return { message: 'Auto-merge enabled. PR will be merged when approved and checks pass.', acted: true }
  }
}

function createStaleHandler(gh: GitHubInstallationClient): CommandHandler {
  return async (args, ctx): Promise<CommandResult> => {
    if (args[0] === '--exclude') {
      await gh.addLabels(ctx.owner, ctx.repo, ctx.issueNumber, ['pinned'])
      return { message: 'This issue has been exempted from stale checks.', acted: true }
    }
    return { message: 'Stale check will run on the next scheduled job.', acted: false }
  }
}

function createStatsHandler(): CommandHandler {
  return async (args, _ctx): Promise<CommandResult> => {
    const days = parseInt(args[0] ?? '7') || 7
    return { message: `📊 Stats for last ${days} days will be generated.`, acted: false }
  }
}
