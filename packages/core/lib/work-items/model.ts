export type WorkItemSource = 'webhook' | 'query'
export type WorkItemType =
    | 'issue'
    | 'pull_request'
    | 'review_request'
    | 'mention'
    | 'check_failure'
export type WorkItemState = 'open' | 'closed' | 'merged' | 'done'

export interface WorkItem {
    id: string
    source: WorkItemSource
    owner: string
    repo: string
    type: WorkItemType
    number: number
    title: string
    url: string
    reason: string
    actor?: string
    assignees: string[]
    requestedReviewers: string[]
    state: WorkItemState
    updatedAt: string
}

export interface StoredWorkItem extends WorkItem {
    installationId: number
    createdAt: string
}

export function workItemId(owner: string, repo: string, type: WorkItemType, number: number): string {
    return `${owner}/${repo}:${type}:${number}`
}

export function splitFullName(fullName: string): { owner: string; repo: string } {
    const [owner, repo] = fullName.split('/')
    if (!owner || !repo) throw new Error(`Invalid repository full_name: ${fullName}`)
    return { owner, repo }
}

