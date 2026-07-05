import type { GitHubInstallationClient } from '../github/installation-client'
import type { PilotStore } from '../storage/sqlite'

export async function addToAutoMergeQueue(
    store: PilotStore,
    repo: string,
    pullNumber: number,
    installationId: number,
    requestedBy: string
): Promise<void> {
    store.addToAutoMergeQueue(repo, pullNumber, installationId, requestedBy)
}

export async function removeFromAutoMergeQueue(
    store: PilotStore,
    repo: string,
    pullNumber: number
): Promise<void> {
    store.removeFromAutoMergeQueue(repo, pullNumber)
}

export async function getAutoMergePR(
    store: PilotStore,
    repo: string,
    pullNumber: number
): Promise<{ status: string } | null> {
    return store.getAutoMergePR(repo, pullNumber)
}

export async function checkAndExecuteAutoMerge(
    store: PilotStore,
    gh: GitHubInstallationClient,
    repo: string,
    pullNumber: number
): Promise<boolean> {
    const pr = store.getAutoMergePR(repo, pullNumber)
    if (!pr || pr.status !== 'pending') return false

    // Get PR details
    const [owner, repoName] = repo.split('/')
    const pull = await gh.get<any>(`/repos/${owner}/${repoName}/pulls/${pullNumber}`)

    // Check if PR is approved
    const reviews = await gh.get<any[]>(`/repos/${owner}/${repoName}/pulls/${pullNumber}/reviews`)
    const approved = reviews.some(r => r.state === 'APPROVED')

    // Check if all checks pass
    const checkRuns = await gh.get<any>(`/repos/${owner}/${repoName}/commits/${pull.head.sha}/check-runs`)
    const allChecksPass = checkRuns.check_runs?.every((cr: any) => cr.conclusion === 'success') ?? true

    if (approved && allChecksPass) {
        // Merge the PR
        await gh.mergePull(owner, repoName, pullNumber)

        // Update status
        store.updateAutoMergeStatus(repo, pullNumber, 'merged')

        return true
    }

    return false
}
