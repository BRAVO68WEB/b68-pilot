import { Database } from 'bun:sqlite'
import { dirname } from 'node:path'
import { mkdirSync } from 'node:fs'
import type { StoredWorkItem, WorkItem } from '../work-items/model'

export interface WebhookEventRecord {
    deliveryId: string
    event: string
    action?: string | null
    installationId?: number | null
    repositoryFullName?: string | null
    receivedAt: string
    processedAt?: string | null
    status: 'received' | 'processed' | 'ignored' | 'failed'
    error?: string | null
}

export class PilotStore {
    private readonly db: Database

    constructor(path: string) {
        mkdirSync(dirname(path), { recursive: true })
        this.db = new Database(path)
        this.migrate()
    }

    close(): void {
        this.db.close()
    }

    saveInstallation(installationId: number, accountLogin: string, accountType: string, repositorySelection?: string): void {
        this.db
            .query(`
                insert into installations (installation_id, account_login, account_type, repository_selection, created_at, updated_at)
                values (?, ?, ?, ?, ?, ?)
                on conflict(installation_id) do update set
                    account_login = excluded.account_login,
                    account_type = excluded.account_type,
                    repository_selection = excluded.repository_selection,
                    updated_at = excluded.updated_at
            `)
            .run(installationId, accountLogin, accountType, repositorySelection ?? null, new Date().toISOString(), new Date().toISOString())
    }

    listInstallations(): Array<{ installationId: number; accountLogin: string; accountType: string; repositorySelection: string | null }> {
        return this.db.query<{ installation_id: number; account_login: string; account_type: string; repository_selection: string | null }, []>(
            `select installation_id, account_login, account_type, repository_selection from installations`
        ).all().map((row) => ({
            installationId: row.installation_id,
            accountLogin: row.account_login,
            accountType: row.account_type,
            repositorySelection: row.repository_selection,
        }))
    }

    saveWebhookEvent(record: WebhookEventRecord): void {
        this.db
            .query(`
                insert into webhook_events (
                    delivery_id, event, action, installation_id, repository_full_name,
                    received_at, processed_at, status, error
                )
                values (?, ?, ?, ?, ?, ?, ?, ?, ?)
                on conflict(delivery_id) do update set
                    processed_at = excluded.processed_at,
                    status = excluded.status,
                    error = excluded.error
            `)
            .run(
                record.deliveryId,
                record.event,
                record.action ?? null,
                record.installationId ?? null,
                record.repositoryFullName ?? null,
                record.receivedAt,
                record.processedAt ?? null,
                record.status,
                record.error ?? null
            )
    }

    saveWorkItem(item: StoredWorkItem): void {
        this.db
            .query(`
                insert into work_items (
                    id, installation_id, repository_full_name, type, number, title, url,
                    reason, state, actor, assignees_json, requested_reviewers_json,
                    updated_at, created_at
                )
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                on conflict(id) do update set
                    title = excluded.title,
                    url = excluded.url,
                    reason = excluded.reason,
                    state = excluded.state,
                    actor = excluded.actor,
                    assignees_json = excluded.assignees_json,
                    requested_reviewers_json = excluded.requested_reviewers_json,
                    updated_at = excluded.updated_at
            `)
            .run(
                item.id,
                item.installationId,
                `${item.owner}/${item.repo}`,
                item.type,
                item.number,
                item.title,
                item.url,
                item.reason,
                item.state,
                item.actor ?? null,
                JSON.stringify(item.assignees),
                JSON.stringify(item.requestedReviewers),
                item.updatedAt,
                item.createdAt
            )
    }

    getWebhookEvent(deliveryId: string): WebhookEventRecord | null {
        const row = this.db.query<WebhookEventRow, [string]>(
            `select * from webhook_events where delivery_id = ?`
        ).get(deliveryId)
        return row ? rowToWebhookEvent(row) : null
    }

    getWorkItem(id: string): StoredWorkItem | null {
        const row = this.db.query<StoredWorkItemRow, [string]>(
            `select * from work_items where id = ?`
        ).get(id)
        if (!row) return null
        const item = rowToWorkItem(row)
        return { ...item, installationId: 0, createdAt: row.created_at } as StoredWorkItem
    }

    deleteStaleWorkItems(repo: string, beforeDate: string): number {
        const stmt = this.db.prepare(
            `delete from work_items where repository_full_name = ? and updated_at < ?`
        )
        stmt.run(repo, beforeDate)
        return 0
    }

    // Auto-merge queue operations
    addToAutoMergeQueue(repo: string, pullNumber: number, installationId: number, requestedBy: string): void {
        this.db.run(`
            INSERT OR REPLACE INTO auto_merge_queue (repository_full_name, pull_number, installation_id, requested_by, requested_at, status)
            VALUES (?, ?, ?, ?, ?, 'pending')
        `, [repo, pullNumber, installationId, requestedBy, new Date().toISOString()])
    }

    removeFromAutoMergeQueue(repo: string, pullNumber: number): void {
        this.db.run(`
            DELETE FROM auto_merge_queue WHERE repository_full_name = ? AND pull_number = ?
        `, [repo, pullNumber])
    }

    getAutoMergePR(repo: string, pullNumber: number): { status: string } | null {
        const row = this.db.query<{ status: string }, [string, number]>(
            `SELECT status FROM auto_merge_queue WHERE repository_full_name = ? AND pull_number = ?`
        ).get(repo, pullNumber)
        return row ?? null
    }

    updateAutoMergeStatus(repo: string, pullNumber: number, status: string): void {
        this.db.run(`
            UPDATE auto_merge_queue SET status = ? WHERE repository_full_name = ? AND pull_number = ?
        `, [status, repo, pullNumber])
    }

    listWorkItems(repo?: string): WorkItem[] {
        const rows = repo
            ? this.db.query<StoredWorkItemRow, [string]>(`select * from work_items where repository_full_name = ? order by updated_at desc`).all(repo)
            : this.db.query<StoredWorkItemRow, []>(`select * from work_items order by updated_at desc`).all()

        return rows.map(rowToWorkItem)
    }

    private migrate(): void {
        this.db.run(`
            create table if not exists installations(
                installation_id integer primary key,
                account_login text not null,
                account_type text not null,
                repository_selection text,
                created_at text,
                updated_at text
            )
        `)
        this.db.run(`
            create table if not exists repositories(
                id integer primary key,
                installation_id integer not null,
                owner text not null,
                name text not null,
                full_name text not null unique
            )
        `)
        this.db.run(`
            create table if not exists webhook_events(
                delivery_id text primary key,
                event text not null,
                action text,
                installation_id integer,
                repository_full_name text,
                received_at text not null,
                processed_at text,
                status text not null,
                error text
            )
        `)
        this.db.run(`
            create table if not exists work_items(
                id text primary key,
                installation_id integer not null,
                repository_full_name text not null,
                type text not null,
                number integer not null,
                title text not null,
                url text not null,
                reason text not null,
                state text not null,
                actor text,
                assignees_json text not null,
                requested_reviewers_json text not null,
                updated_at text not null,
                created_at text not null
            )
        `)
        this.db.run(`
            create table if not exists auto_merge_queue(
                id integer primary key autoincrement,
                repository_full_name text not null,
                pull_number integer not null,
                installation_id integer not null,
                requested_by text,
                requested_at text not null,
                status text not null default 'pending',
                unique(repository_full_name, pull_number)
            )
        `)
    }
}

interface StoredWorkItemRow {
    id: string
    installation_id: number
    repository_full_name: string
    type: WorkItem['type']
    number: number
    title: string
    url: string
    reason: string
    state: WorkItem['state']
    actor: string | null
    assignees_json: string
    requested_reviewers_json: string
    updated_at: string
    created_at: string
}

function rowToWorkItem(row: StoredWorkItemRow): WorkItem {
    const [owner, repo] = row.repository_full_name.split('/')
    return {
        id: row.id,
        source: 'webhook',
        owner,
        repo,
        type: row.type,
        number: row.number,
        title: row.title,
        url: row.url,
        reason: row.reason,
        actor: row.actor ?? undefined,
        assignees: JSON.parse(row.assignees_json) as string[],
        requestedReviewers: JSON.parse(row.requested_reviewers_json) as string[],
        state: row.state,
        updatedAt: row.updated_at,
    }
}

interface WebhookEventRow {
    delivery_id: string
    event: string
    action: string | null
    installation_id: number | null
    repository_full_name: string | null
    received_at: string
    processed_at: string | null
    status: string
    error: string | null
}

function rowToWebhookEvent(row: WebhookEventRow): WebhookEventRecord {
    return {
        deliveryId: row.delivery_id,
        event: row.event,
        action: row.action,
        installationId: row.installation_id,
        repositoryFullName: row.repository_full_name,
        receivedAt: row.received_at,
        processedAt: row.processed_at,
        status: row.status as WebhookEventRecord['status'],
        error: row.error,
    }
}

