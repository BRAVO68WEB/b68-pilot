import { reconcileWorkItems } from './jobs/reconcile-work-items'
import { createLogger, defaultDbPath, loadGitHubAppConfig, PilotStore } from 'core'
import { Cron } from 'croner'

const log = createLogger('worker')
const config = loadGitHubAppConfig(Bun.env)
const store = new PilotStore(defaultDbPath(Bun.env))

log.info('Scheduling worker...')

const cron = new Cron('*/5 * * * *', {
    name: 'gh-worker',
    timezone: 'Asia/Kolkata',
})

cron.schedule(async () => {
    log.info('Running reconciliation worker...')
    try {
        await reconcileWorkItems(config, store)
        log.info('Reconciliation worker completed')
    } catch (error) {
        log.error('Reconciliation error', { error: String(error) })
    }
})

log.info('Worker scheduled successfully')

function shutdown(signal: string) {
    log.info(`Received ${signal}, shutting down...`)
    cron.stop()
    store.close()
    process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
