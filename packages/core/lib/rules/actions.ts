// packages/core/lib/rules/actions.ts
// Rule action executor

import type { Action, ActionType } from './schema'
import type { GitHubInstallationClient } from '../github/installation-client'

export interface ActionContext {
  gh: GitHubInstallationClient
  owner: string
  repo: string
  issueNumber: number
  isPullRequest: boolean
}

/**
 * Execute a single action
 */
export async function executeAction(action: Action, ctx: ActionContext): Promise<void> {
  switch (action.type) {
    case 'comment':
      await executeComment(action.payload, ctx)
      break
    case 'label':
      await executeLabel(action.payload, ctx)
      break
    case 'assign':
      await executeAssign(action.payload, ctx)
      break
    case 'close':
      await executeClose(ctx)
      break
    case 'merge':
      await executeMerge(ctx)
      break
    case 'request_changes':
      await executeRequestChanges(action.payload, ctx)
      break
    case 'lock':
      await executeLock(ctx)
      break
    case 'unlock':
      await executeUnlock(ctx)
      break
    case 'milestone':
      await executeMilestone(action.payload, ctx)
      break
    case 'webhook':
      await executeWebhook(action.payload, ctx)
      break
    case 'custom':
      // Custom actions handled by plugins
      break
  }
}

/**
 * Execute multiple actions in order
 */
export async function executeActions(actions: Action[], ctx: ActionContext): Promise<void> {
  for (const action of actions) {
    try {
      await executeAction(action, ctx)
    } catch (error) {
      console.error(`[rules] Action ${action.type} failed:`, error)
    }
  }
}

async function executeComment(payload: Record<string, unknown>, ctx: ActionContext): Promise<void> {
  const body = String(payload.body ?? '')
  if (body) {
    await ctx.gh.comment(ctx.owner, ctx.repo, ctx.issueNumber, body)
  }
}

async function executeLabel(payload: Record<string, unknown>, ctx: ActionContext): Promise<void> {
  const add = (payload.add as string[]) ?? []
  const remove = (payload.remove as string[]) ?? []

  if (add.length > 0) {
    await ctx.gh.addLabels(ctx.owner, ctx.repo, ctx.issueNumber, add)
  }

  for (const label of remove) {
    await ctx.gh.removeLabel(ctx.owner, ctx.repo, ctx.issueNumber, label)
  }
}

async function executeAssign(payload: Record<string, unknown>, ctx: ActionContext): Promise<void> {
  const users = (payload.users as string[]) ?? []
  if (users.length > 0) {
    await ctx.gh.request('POST', `/repos/${ctx.owner}/${ctx.repo}/issues/${ctx.issueNumber}/assignees`, {
      assignees: users,
    })
  }
}

async function executeClose(ctx: ActionContext): Promise<void> {
  await ctx.gh.closeIssueOrPull(`/repos/${ctx.owner}/${ctx.repo}/issues/${ctx.issueNumber}`)
}

async function executeMerge(ctx: ActionContext): Promise<void> {
  if (ctx.isPullRequest) {
    await ctx.gh.mergePull(ctx.owner, ctx.repo, ctx.issueNumber)
  }
}

async function executeRequestChanges(payload: Record<string, unknown>, ctx: ActionContext): Promise<void> {
  if (ctx.isPullRequest) {
    const body = String(payload.body ?? 'Changes requested by gh-pilot rules.')
    await ctx.gh.request('POST', `/repos/${ctx.owner}/${ctx.repo}/pulls/${ctx.issueNumber}/reviews`, {
      event: 'REQUEST_CHANGES',
      body,
    })
  }
}

async function executeLock(ctx: ActionContext): Promise<void> {
  await ctx.gh.request('PUT', `/repos/${ctx.owner}/${ctx.repo}/issues/${ctx.issueNumber}/lock`, {
    lock_reason: 'resolved',
  })
}

async function executeUnlock(ctx: ActionContext): Promise<void> {
  await ctx.gh.request('DELETE', `/repos/${ctx.owner}/${ctx.repo}/issues/${ctx.issueNumber}/lock`)
}

async function executeMilestone(payload: Record<string, unknown>, ctx: ActionContext): Promise<void> {
  const milestone = payload.milestone as number
  if (milestone) {
    await ctx.gh.request('PATCH', `/repos/${ctx.owner}/${ctx.repo}/issues/${ctx.issueNumber}`, {
      milestone,
    })
  }
}

async function executeWebhook(payload: Record<string, unknown>, ctx: ActionContext): Promise<void> {
  const url = payload.url as string
  if (!url) return

  const body = {
    action: 'rule.triggered',
    repository: `${ctx.owner}/${ctx.repo}`,
    issue_number: ctx.issueNumber,
    is_pull_request: ctx.isPullRequest,
    timestamp: new Date().toISOString(),
  }

  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
