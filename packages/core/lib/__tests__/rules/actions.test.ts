// packages/core/lib/__tests__/rules/actions.test.ts
// Rule actions tests

import { describe, expect, test, mock } from 'bun:test'
import { executeAction, executeActions } from '../../rules/actions'
import type { Action } from '../../rules/schema'

describe('executeAction', () => {
  const mockGh = {
    comment: mock(() => Promise.resolve()),
    addLabels: mock(() => Promise.resolve()),
    removeLabel: mock(() => Promise.resolve()),
    closeIssueOrPull: mock(() => Promise.resolve()),
    mergePull: mock(() => Promise.resolve()),
    request: mock(() => Promise.resolve()),
  }

  const ctx = {
    gh: mockGh as any,
    owner: 'testowner',
    repo: 'testrepo',
    issueNumber: 1,
    isPullRequest: false,
  }

  test('comment action calls gh.comment', async () => {
    const action: Action = { type: 'comment', payload: { body: 'Test comment' } }
    await executeAction(action, ctx)
    expect(mockGh.comment).toHaveBeenCalledWith('testowner', 'testrepo', 1, 'Test comment')
  })

  test('label action adds labels', async () => {
    const action: Action = { type: 'label', payload: { add: ['bug', 'critical'] } }
    await executeAction(action, ctx)
    expect(mockGh.addLabels).toHaveBeenCalledWith('testowner', 'testrepo', 1, ['bug', 'critical'])
  })

  test('label action removes labels', async () => {
    const action: Action = { type: 'label', payload: { remove: ['stale'] } }
    await executeAction(action, ctx)
    expect(mockGh.removeLabel).toHaveBeenCalledWith('testowner', 'testrepo', 1, 'stale')
  })

  test('close action calls gh.closeIssueOrPull', async () => {
    const action: Action = { type: 'close', payload: {} }
    await executeAction(action, ctx)
    expect(mockGh.closeIssueOrPull).toHaveBeenCalled()
  })

  test('merge action calls gh.mergePull for PRs', async () => {
    const prCtx = { ...ctx, isPullRequest: true }
    const action: Action = { type: 'merge', payload: {} }
    await executeAction(action, prCtx)
    expect(mockGh.mergePull).toHaveBeenCalledWith('testowner', 'testrepo', 1)
  })

  test('merge action does nothing for issues', async () => {
    mockGh.mergePull.mockClear()
    const action: Action = { type: 'merge', payload: {} }
    await executeAction(action, ctx)
    expect(mockGh.mergePull).not.toHaveBeenCalled()
  })
})

describe('executeActions', () => {
  const mockGh = {
    comment: mock(() => Promise.resolve()),
    addLabels: mock(() => Promise.resolve()),
  }

  const ctx = {
    gh: mockGh as any,
    owner: 'testowner',
    repo: 'testrepo',
    issueNumber: 1,
    isPullRequest: false,
  }

  test('executes multiple actions in order', async () => {
    const actions: Action[] = [
      { type: 'label', payload: { add: ['bug'] } },
      { type: 'comment', payload: { body: 'Thanks!' } },
    ]

    await executeActions(actions, ctx)
    expect(mockGh.addLabels).toHaveBeenCalled()
    expect(mockGh.comment).toHaveBeenCalled()
  })

  test('continues on action failure', async () => {
    mockGh.comment.mockRejectedValueOnce(new Error('API error'))
    
    const actions: Action[] = [
      { type: 'comment', payload: { body: 'Will fail' } },
      { type: 'label', payload: { add: ['bug'] } },
    ]

    // Should not throw
    await executeActions(actions, ctx)
    expect(mockGh.addLabels).toHaveBeenCalled()
  })
})
