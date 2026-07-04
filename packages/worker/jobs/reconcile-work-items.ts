import {
    createLogger,
    GitHubAppClient,
    GitHubInstallationClient,
    InstallationTokenCache,
    PilotStore,
    splitFullName,
    type GitHubAppConfig,
    type StoredWorkItem,
    workItemId,
} from 'core'

const log = createLogger('reconcile')

export async function reconcileWorkItems(config: GitHubAppConfig, store: PilotStore): Promise<void> {
    const appClient = new GitHubAppClient(config)
    const tokenCache = new InstallationTokenCache(appClient)

    const installations = await appClient.listInstallations()
    log.info(`Found ${installations.length} installation(s)`)

    for (const installation of installations) {
        if (!installation.account) continue

        store.saveInstallation(
            installation.id,
            installation.account.login,
            installation.account.type,
            installation.repository_selection
        )

        try {
            await reconcileInstallation(installation.id, tokenCache, store)
        } catch (error) {
            log.error(`Error for installation ${installation.id}`, { error: String(error) })
        }
    }
}

async function reconcileInstallation(
    installationId: number,
    tokenCache: InstallationTokenCache,
    store: PilotStore
): Promise<void> {
    const gh = await GitHubInstallationClient.create(installationId, tokenCache)
    const repos = await gh.listRepositories()
    log.info(`Installation ${installationId}: ${repos.length} repo(s)`)

    for (const repo of repos) {
        const { owner, repo: repoName } = splitFullName(repo.full_name)

        try {
            await reconcileRepo(installationId, gh, owner, repoName, store)
        } catch (error) {
            log.error(`Error for ${repo.full_name}`, { error: String(error) })
        }
    }
}

async function reconcileRepo(
    installationId: number,
    gh: GitHubInstallationClient,
    owner: string,
    repo: string,
    store: PilotStore
): Promise<void> {
    const [issues, pulls] = await Promise.all([
        gh.listOpenIssues(owner, repo),
        gh.listOpenPulls(owner, repo),
    ])

    const now = new Date().toISOString()

    for (const issue of issues) {
        if (issue.pull_request) continue

        store.saveWorkItem({
            id: workItemId(owner, repo, 'issue', issue.number),
            installationId,
            source: 'query',
            owner,
            repo,
            type: 'issue',
            number: issue.number,
            title: issue.title,
            url: issue.html_url,
            reason: issue.assignees?.length ? 'assigned' : 'mentioned',
            actor: issue.user?.login,
            assignees: issue.assignees?.map((u) => u.login) ?? [],
            requestedReviewers: [],
            state: issue.state === 'open' ? 'open' : 'closed',
            updatedAt: issue.updated_at,
            createdAt: now,
        })
    }

    for (const pr of pulls) {
        store.saveWorkItem({
            id: workItemId(owner, repo, 'pull_request', pr.number),
            installationId,
            source: 'query',
            owner,
            repo,
            type: 'pull_request',
            number: pr.number,
            title: pr.title,
            url: pr.html_url,
            reason: pr.requested_reviewers?.length ? 'review requested' : 'authored PR',
            actor: pr.user?.login,
            assignees: pr.assignees?.map((u) => u.login) ?? [],
            requestedReviewers: pr.requested_reviewers?.map((u) => u.login) ?? [],
            state: 'open',
            updatedAt: pr.updated_at,
            createdAt: now,
        })
    }
}
