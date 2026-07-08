import {
    createLogger,
    GitHubAppClient,
    GitHubInstallationClient,
    InstallationTokenCache,
    PilotStore,
    type GitHubAppConfig,
    getStaleConfig,
    checkStaleIssues,
} from 'core'

const log = createLogger('stale-check')

export async function runStaleCheck(config: GitHubAppConfig, store: PilotStore): Promise<void> {
    const staleConfig = getStaleConfig()

    if (!Bun.env.GH_PILOT_STALE_ENABLED || Bun.env.GH_PILOT_STALE_ENABLED !== 'true') {
        log.info('Stale check disabled')
        return
    }

    log.info('Starting stale check', { config: staleConfig })

    const appClient = new GitHubAppClient(config)
    const tokenCache = new InstallationTokenCache(appClient)

    const installations = await appClient.listInstallations()
    log.info(`Found ${installations.length} installation(s)`)

    let totalMarked = 0
    let totalClosed = 0

    for (const installation of installations) {
        if (!installation.account) continue

        try {
            const gh = await GitHubInstallationClient.create(installation.id, tokenCache)
            const repos = await gh.listRepositories()

            for (const repo of repos) {
                const [owner, repoName] = repo.full_name.split('/')

                try {
                    const { marked, closed } = await checkStaleIssues(gh, owner, repoName, staleConfig)
                    totalMarked += marked
                    totalClosed += closed

                    if (marked > 0 || closed > 0) {
                        log.info(`Processed ${repo.full_name}`, { marked, closed })
                    }
                } catch (error) {
                    log.error(`Error processing ${repo.full_name}`, { error: String(error) })
                }
            }
        } catch (error) {
            log.error(`Error processing installation ${installation.id}`, { error: String(error) })
        }
    }

    log.info('Stale check complete', { totalMarked, totalClosed })
}
