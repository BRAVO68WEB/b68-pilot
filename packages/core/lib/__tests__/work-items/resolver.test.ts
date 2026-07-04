import { describe, expect, test } from 'bun:test'
import { mergeWorkItems, compareWorkItems } from '../../work-items/resolver'
import type { WorkItem } from '../../work-items/model'

function makeItem(overrides: Partial<WorkItem> & { id: string }): WorkItem {
    return {
        source: 'webhook',
        owner: 'test',
        repo: 'repo',
        type: 'issue',
        number: 1,
        title: 'Test',
        url: 'https://example.com',
        reason: 'mentioned',
        assignees: [],
        requestedReviewers: [],
        state: 'open',
        updatedAt: new Date().toISOString(),
        ...overrides,
    }
}

describe('mergeWorkItems', () => {
    test('merges empty arrays', () => {
        expect(mergeWorkItems([], [])).toEqual([])
    })

    test('merges single group', () => {
        const items = [makeItem({ id: 'a' }), makeItem({ id: 'b' })]
        expect(mergeWorkItems(items)).toHaveLength(2)
    })

    test('deduplicates by id, keeping newer', () => {
        const old = makeItem({ id: 'a', title: 'Old', updatedAt: '2024-01-01T00:00:00Z' })
        const newer = makeItem({ id: 'a', title: 'New', updatedAt: '2024-06-01T00:00:00Z' })
        const result = mergeWorkItems([old], [newer])
        expect(result).toHaveLength(1)
        expect(result[0].title).toBe('New')
    })

    test('keeps both when ids differ', () => {
        const a = makeItem({ id: 'a', updatedAt: '2024-01-01T00:00:00Z' })
        const b = makeItem({ id: 'b', updatedAt: '2024-06-01T00:00:00Z' })
        const result = mergeWorkItems([a], [b])
        expect(result).toHaveLength(2)
    })

    test('sorts by reason priority then by date', () => {
        const mentioned = makeItem({ id: 'a', reason: 'mentioned', updatedAt: '2024-01-01T00:00:00Z' })
        const assigned = makeItem({ id: 'b', reason: 'assigned', updatedAt: '2024-01-01T00:00:00Z' })
        const result = mergeWorkItems([mentioned, assigned])
        expect(result[0].reason).toBe('mentioned')
        expect(result[1].reason).toBe('assigned')
    })
})

describe('compareWorkItems', () => {
    test('mentioned has higher priority than assigned', () => {
        const a = makeItem({ id: 'a', reason: 'mentioned', updatedAt: '2024-01-01T00:00:00Z' })
        const b = makeItem({ id: 'b', reason: 'assigned', updatedAt: '2024-01-01T00:00:00Z' })
        expect(compareWorkItems(a, b)).toBeLessThan(0)
    })

    test('newer items come first within same priority', () => {
        const older = makeItem({ id: 'a', reason: 'mentioned', updatedAt: '2024-01-01T00:00:00Z' })
        const newer = makeItem({ id: 'b', reason: 'mentioned', updatedAt: '2024-06-01T00:00:00Z' })
        expect(compareWorkItems(older, newer)).toBeGreaterThan(0)
    })
})
