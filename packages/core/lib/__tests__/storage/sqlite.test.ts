import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { PilotStore } from '../../storage/sqlite'
import type { StoredWorkItem } from '../../work-items/model'
import { unlinkSync } from 'node:fs'

const TEST_DB = '/tmp/gh-pilot-test-' + crypto.randomUUID() + '.sqlite'

function makeStoredItem(overrides: Partial<StoredWorkItem> & { id: string }): StoredWorkItem {
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
        installationId: 123,
        createdAt: new Date().toISOString(),
        ...overrides,
    }
}

let store: PilotStore

beforeEach(() => {
    store = new PilotStore(TEST_DB)
})

afterEach(() => {
    store.close()
    try { unlinkSync(TEST_DB) } catch {}
})

describe('PilotStore webhook events', () => {
    test('saves and retrieves webhook event', () => {
        store.saveWebhookEvent({
            deliveryId: 'del-1',
            event: 'issue_comment',
            action: 'created',
            receivedAt: new Date().toISOString(),
            status: 'received',
        })

        const event = store.getWebhookEvent('del-1')
        expect(event).not.toBeNull()
        expect(event!.deliveryId).toBe('del-1')
        expect(event!.event).toBe('issue_comment')
        expect(event!.status).toBe('received')
    })

    test('returns null for unknown delivery id', () => {
        expect(store.getWebhookEvent('unknown')).toBeNull()
    })

    test('upserts webhook event on duplicate delivery id', () => {
        store.saveWebhookEvent({
            deliveryId: 'del-2',
            event: 'issues',
            receivedAt: new Date().toISOString(),
            status: 'received',
        })

        store.saveWebhookEvent({
            deliveryId: 'del-2',
            event: 'issues',
            receivedAt: new Date().toISOString(),
            processedAt: new Date().toISOString(),
            status: 'processed',
        })

        const event = store.getWebhookEvent('del-2')
        expect(event!.status).toBe('processed')
    })
})

describe('PilotStore work items', () => {
    test('saves and lists work items', () => {
        store.saveWorkItem(makeStoredItem({ id: 'a', title: 'First' }))
        store.saveWorkItem(makeStoredItem({ id: 'b', title: 'Second' }))

        const items = store.listWorkItems()
        expect(items).toHaveLength(2)
    })

    test('filters by repo', () => {
        store.saveWorkItem(makeStoredItem({ id: 'a' }))
        store.saveWorkItem(makeStoredItem({ id: 'b', owner: 'other', repo: 'repo2' }))

        const items = store.listWorkItems('other/repo2')
        expect(items).toHaveLength(1)
    })

    test('upserts work item on duplicate id', () => {
        store.saveWorkItem(makeStoredItem({ id: 'a', title: 'Old' }))
        store.saveWorkItem(makeStoredItem({ id: 'a', title: 'New' }))

        const items = store.listWorkItems()
        expect(items).toHaveLength(1)
        expect(items[0].title).toBe('New')
    })

    test('getWorkItem returns item by id', () => {
        store.saveWorkItem(makeStoredItem({ id: 'a', title: 'Test' }))
        const item = store.getWorkItem('a')
        expect(item).not.toBeNull()
        expect(item!.title).toBe('Test')
    })

    test('getWorkItem returns null for unknown id', () => {
        expect(store.getWorkItem('unknown')).toBeNull()
    })
})

describe('PilotStore installations', () => {
    test('saves and lists installations', () => {
        store.saveInstallation(1, 'user1', 'User')
        store.saveInstallation(2, 'org1', 'Organization', 'all')

        const installations = store.listInstallations()
        expect(installations).toHaveLength(2)
        expect(installations[0].accountLogin).toBe('user1')
        expect(installations[1].repositorySelection).toBe('all')
    })

    test('upserts installation', () => {
        store.saveInstallation(1, 'old-name', 'User')
        store.saveInstallation(1, 'new-name', 'User')

        const installations = store.listInstallations()
        expect(installations).toHaveLength(1)
        expect(installations[0].accountLogin).toBe('new-name')
    })
})
