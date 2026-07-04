import {
    executeBotCommand,
    GitHubAppClient,
    GitHubInstallationClient,
    InstallationTokenCache,
    PilotStore,
    splitFullName,
    type GitHubAppConfig,
    type StoredWorkItem,
    type WorkItemState,
    type WorkItemType,
    workItemId,
} from 'core'

export interface GitHubWebhookEnvelope {
    deliveryId: string
    event: string
    rawBody: string
}

interface BaseWebhookPayload {
    action?: string
    installation?: { id: number }
    repository?: {
        full_name: string
        html_url?: string
    }
    sender?: { login: string }
}

interface IssueCommentPayload extends BaseWebhookPayload {
    action: string
    comment: { body?: string | null; html_url?: string }
    issue: IssueLike
}

interface IssuesPayload extends BaseWebhookPayload {
    action: string
    issue: IssueLike
}

interface PullRequestPayload extends BaseWebhookPayload {
    action: string
    pull_request: {
        number: number
        title: string
        html_url: string
        url: string
        state: string
        merged?: boolean
        user?: { login: string }
        assignees?: Array<{ login: string }>
        requested_reviewers?: Array<{ login: string }>
        updated_at: string
        base?: { ref: string }
    }
}

interface PullRequestReviewPayload extends BaseWebhookPayload {
    action: string
    review: {
        state: string
        user?: { login: string }
        html_url?: string
    }
    pull_request: {
        number: number
        title: string
        html_url: string
        url: string
        state: string
        user?: { login: string }
        assignees?: Array<{ login: string }>
        requested_reviewers?: Array<{ login: string }>
        updated_at: string
    }
}

interface CheckRunPayload extends BaseWebhookPayload {
    action: string
    check_run: {
        name: string
        conclusion: string | null
        status: string
        html_url: string
        pull_requests?: Array<{ url: string; number: number }>
    }
}

interface CheckSuitePayload extends BaseWebhookPayload {
    action: string
    check_suite: {
        conclusion: string | null
        status: string
        html_url?: string
        pull_requests?: Array<{ url: string; number: number; base?: { ref: string } }>
        head?: { sha: string }
    }
}

interface IssueLike {
    number: number
    title: string
    url: string
    html_url: string
    state: string
    pull_request?: unknown
    assignees?: Array<{ login: string }>
    requested_reviewers?: Array<{ login: string }>
    updated_at: string
}

export class GitHubWebhookHandler {
    private readonly tokenCache: InstallationTokenCache

    constructor(
        private readonly config: GitHubAppConfig,
        private readonly store: PilotStore
    ) {
        this.tokenCache = new InstallationTokenCache(new GitHubAppClient(config))
    }

    async handle(envelope: GitHubWebhookEnvelope): Promise<{ ok: boolean; ignored?: string; command?: string | null }> {
        const existing = this.store.getWebhookEvent(envelope.deliveryId)
        if (existing && existing.status === 'processed') {
            return { ok: true, ignored: 'duplicate' }
        }

        const receivedAt = new Date().toISOString()
        let payload: BaseWebhookPayload

        try {
            payload = JSON.parse(envelope.rawBody) as BaseWebhookPayload
        } catch (error) {
            this.store.saveWebhookEvent({
                deliveryId: envelope.deliveryId,
                event: envelope.event,
                receivedAt,
                processedAt: new Date().toISOString(),
                status: 'failed',
                error: `Invalid JSON: ${String(error)}`,
            })
            throw error
        }

        this.store.saveWebhookEvent({
            deliveryId: envelope.deliveryId,
            event: envelope.event,
            action: payload.action,
            installationId: payload.installation?.id,
            repositoryFullName: payload.repository?.full_name,
            receivedAt,
            status: 'received',
        })

        if (!payload.installation?.id) {
            this.mark(envelope, payload, receivedAt, 'ignored', 'Missing installation.id')
            return { ok: true, ignored: 'missing installation' }
        }

        try {
            const result = await this.dispatch(envelope.event, payload)
            this.mark(envelope, payload, receivedAt, 'processed')
            return { ok: true, ...result }
        } catch (error) {
            this.mark(envelope, payload, receivedAt, 'failed', String(error))
            throw error
        }
    }

    private async dispatch(
        event: string,
        payload: BaseWebhookPayload
    ): Promise<{ ignored?: string; command?: string | null }> {
        switch (event) {
            case 'issue_comment':
                return { command: await this.handleIssueComment(payload as IssueCommentPayload) }
            case 'issues':
                return { command: await this.handleIssues(payload as IssuesPayload) }
            case 'pull_request':
                return { command: await this.handlePullRequest(payload as PullRequestPayload) }
            case 'pull_request_review':
                return { command: await this.handlePullRequestReview(payload as PullRequestReviewPayload) }
            case 'check_run':
                return { command: await this.handleCheckRun(payload as CheckRunPayload) }
            case 'check_suite':
                return { command: await this.handleCheckSuite(payload as CheckSuitePayload) }
            default:
                return { ignored: event }
        }
    }

    private async handleIssueComment(payload: IssueCommentPayload): Promise<string | null> {
        if (payload.action !== 'created') return null
        if (!payload.repository?.full_name) throw new Error('Missing repository.full_name')
        if (!payload.installation?.id) throw new Error('Missing installation.id')

        const { owner, repo } = splitFullName(payload.repository.full_name)
        const gh = await GitHubInstallationClient.create(payload.installation.id, this.tokenCache)
        const isPullRequest = Boolean(payload.issue.pull_request)

        this.store.saveWorkItem(issueToWorkItem(payload.issue, payload, owner, repo, 'mentioned'))

        const result = await executeBotCommand(gh, {
            appSlug: this.config.appSlug,
            owner,
            repo,
            issueNumber: payload.issue.number,
            issueApiUrl: payload.issue.url,
            isPullRequest,
            commentBody: payload.comment.body,
        })

        if (result) {
            await gh.comment(owner, repo, payload.issue.number, result.message)
        }

        return result?.command ?? null
    }

    private async handleIssues(payload: IssuesPayload): Promise<string | null> {
        if (!payload.repository?.full_name) throw new Error('Missing repository.full_name')
        if (!payload.installation?.id) throw new Error('Missing installation.id')

        const { owner, repo } = splitFullName(payload.repository.full_name)
        const state = deriveIssueState(payload.action, payload.issue.state)

        this.store.saveWorkItem(issueToWorkItem(payload.issue, payload, owner, repo, 'assigned', state))
        return null
    }

    private async handlePullRequest(payload: PullRequestPayload): Promise<string | null> {
        if (!payload.repository?.full_name) throw new Error('Missing repository.full_name')
        if (!payload.installation?.id) throw new Error('Missing installation.id')

        const { owner, repo } = splitFullName(payload.repository.full_name)
        const pr = payload.pull_request

        const state: WorkItemState =
            payload.action === 'closed' && pr.merged ? 'merged' :
            payload.action === 'closed' ? 'closed' :
            'open'

        const reason =
            payload.action === 'review_requested' ? 'review requested' :
            payload.action === 'assigned' ? 'assigned' :
            'authored PR'

        this.store.saveWorkItem({
            id: workItemId(owner, repo, 'pull_request', pr.number),
            installationId: payload.installation.id,
            source: 'webhook',
            owner,
            repo,
            type: 'pull_request',
            number: pr.number,
            title: pr.title,
            url: pr.html_url,
            reason,
            actor: payload.sender?.login,
            assignees: pr.assignees?.map((u) => u.login) ?? [],
            requestedReviewers: pr.requested_reviewers?.map((u) => u.login) ?? [],
            state,
            updatedAt: pr.updated_at,
            createdAt: new Date().toISOString(),
        })

        return null
    }

    private async handlePullRequestReview(payload: PullRequestReviewPayload): Promise<string | null> {
        if (payload.action !== 'submitted') return null
        if (!payload.repository?.full_name) throw new Error('Missing repository.full_name')
        if (!payload.installation?.id) throw new Error('Missing installation.id')

        const { owner, repo } = splitFullName(payload.repository.full_name)
        const pr = payload.pull_request

        this.store.saveWorkItem({
            id: workItemId(owner, repo, 'pull_request', pr.number),
            installationId: payload.installation.id,
            source: 'webhook',
            owner,
            repo,
            type: 'pull_request',
            number: pr.number,
            title: pr.title,
            url: pr.html_url,
            reason: `review ${payload.review.state}`,
            actor: payload.review.user?.login,
            assignees: pr.assignees?.map((u) => u.login) ?? [],
            requestedReviewers: pr.requested_reviewers?.map((u) => u.login) ?? [],
            state: 'open',
            updatedAt: pr.updated_at,
            createdAt: new Date().toISOString(),
        })

        return null
    }

    private async handleCheckRun(payload: CheckRunPayload): Promise<string | null> {
        if (payload.action !== 'completed') return null
        if (payload.check_run.conclusion !== 'failure') return null
        if (!payload.repository?.full_name) throw new Error('Missing repository.full_name')
        if (!payload.installation?.id) throw new Error('Missing installation.id')

        const { owner, repo } = splitFullName(payload.repository.full_name)
        const pr = payload.check_run.pull_requests?.[0]
        if (!pr) return null

        this.store.saveWorkItem({
            id: workItemId(owner, repo, 'check_failure', pr.number),
            installationId: payload.installation.id,
            source: 'webhook',
            owner,
            repo,
            type: 'check_failure',
            number: pr.number,
            title: `Check failed: ${payload.check_run.name}`,
            url: payload.check_run.html_url,
            reason: 'check failure',
            actor: undefined,
            assignees: [],
            requestedReviewers: [],
            state: 'open',
            updatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
        })

        return null
    }

    private async handleCheckSuite(payload: CheckSuitePayload): Promise<string | null> {
        if (payload.action !== 'completed') return null
        if (payload.check_suite.conclusion !== 'failure') return null
        if (!payload.repository?.full_name) throw new Error('Missing repository.full_name')
        if (!payload.installation?.id) throw new Error('Missing installation.id')

        const { owner, repo } = splitFullName(payload.repository.full_name)
        const pr = payload.check_suite.pull_requests?.[0]
        if (!pr) return null

        this.store.saveWorkItem({
            id: workItemId(owner, repo, 'check_failure', pr.number),
            installationId: payload.installation.id,
            source: 'webhook',
            owner,
            repo,
            type: 'check_failure',
            number: pr.number,
            title: 'Check suite failed',
            url: payload.check_suite.html_url ?? `https://github.com/${owner}/${repo}/pull/${pr.number}`,
            reason: 'check failure',
            actor: undefined,
            assignees: [],
            requestedReviewers: [],
            state: 'open',
            updatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
        })

        return null
    }

    private mark(
        envelope: GitHubWebhookEnvelope,
        payload: BaseWebhookPayload,
        receivedAt: string,
        status: 'processed' | 'ignored' | 'failed',
        error?: string
    ): void {
        this.store.saveWebhookEvent({
            deliveryId: envelope.deliveryId,
            event: envelope.event,
            action: payload.action,
            installationId: payload.installation?.id,
            repositoryFullName: payload.repository?.full_name,
            receivedAt,
            processedAt: new Date().toISOString(),
            status,
            error,
        })
    }
}

function deriveIssueState(action: string, currentState: string): WorkItemState {
    if (action === 'closed') return 'closed'
    if (action === 'reopened') return 'open'
    return currentState === 'open' ? 'open' : 'closed'
}

function issueToWorkItem(
    issue: IssueLike,
    payload: BaseWebhookPayload,
    owner: string,
    repo: string,
    reason: string,
    state?: WorkItemState
): StoredWorkItem {
    const type: WorkItemType = issue.pull_request ? 'pull_request' : 'issue'
    return {
        id: workItemId(owner, repo, type, issue.number),
        installationId: payload.installation?.id ?? 0,
        source: 'webhook',
        owner,
        repo,
        type,
        number: issue.number,
        title: issue.title,
        url: issue.html_url,
        reason,
        actor: payload.sender?.login,
        assignees: issue.assignees?.map((u) => u.login) ?? [],
        requestedReviewers: issue.requested_reviewers?.map((u) => u.login) ?? [],
        state: state ?? (issue.state === 'open' ? 'open' : 'closed'),
        updatedAt: issue.updated_at,
        createdAt: new Date().toISOString(),
    }
}
