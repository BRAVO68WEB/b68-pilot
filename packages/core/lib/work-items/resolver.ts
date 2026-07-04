import type { WorkItem } from './model'

const REASON_PRIORITY: Record<string, number> = {
    mentioned: 0,
    assigned: 1,
    'review requested': 2,
    'check failure': 3,
}

export function mergeWorkItems(...groups: WorkItem[][]): WorkItem[] {
    const byId = new Map<string, WorkItem>()
    for (const group of groups) {
        for (const item of group) {
            const existing = byId.get(item.id)
            if (!existing || Date.parse(item.updatedAt) > Date.parse(existing.updatedAt)) {
                byId.set(item.id, item)
            }
        }
    }
    return [...byId.values()].sort(compareWorkItems)
}

export function compareWorkItems(a: WorkItem, b: WorkItem): number {
    const priority = (REASON_PRIORITY[a.reason] ?? 10) - (REASON_PRIORITY[b.reason] ?? 10)
    if (priority !== 0) return priority
    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
}

