import { reconcileWorkItems } from './jobs/reconcile-work-items'
import { runStaleCheck } from './jobs/stale-check'
import { sendDigest } from './jobs/digest'
import { createLogger, defaultDbPath, loadGitHubAppConfig, PilotStore } from 'core'
import { Cron } from 'croner'

const log = createLogger('worker')
const config = loadGitHubAppConfig(Bun.env)
const store = new PilotStore(defaultDbPath(Bun.env))

log.info('Scheduling worker...')

// Reconciliation job - every 5 minutes
const reconcileCron = new Cron('*/5 * * * *', {
    name: 'reconcile',
    timezone: 'Asia/Kolkata',
})

reconcileCron.schedule(async () => {
    log.info('Running reconciliation worker...')
    try {
        await reconcileWorkItems(config, store)
        log.info('Reconciliation worker completed')
    } catch (error) {
        log.error('Reconciliation error', { error: String(error) })
    }
})

// Stale check job - daily at midnight
const staleCron = new Cron('0 0 * * *', {
    name: 'stale-check',
    timezone: 'Asia/Kolkata',
})

staleCron.schedule(async () => {
    log.info('Running stale check...')
    try {
        await runStaleCheck(config, store)
        log.info('Stale check completed')
    } catch (error) {
        log.error('Stale check error', { error: String(error) })
    }
})

// Digest summary job - daily at 9 AM
const digestCron = new Cron('0 9 * * *', {
    name: 'digest',
    timezone: 'Asia/Kolkata',
})

digestCron.schedule(async () => {
    log.info('Running digest summary...')
    try {
        await sendDigest(store)
        log.info('Digest summary completed')
    } catch (error) {
        log.error('Digest summary error', { error: String(error) })
    }
})

log.info('Worker scheduled successfully')

function shutdown(signal: string) {
    log.info(`Received ${signal}, shutting down...`)
    reconcileCron.stop()
    staleCron.stop()
    digestCron.stop()
    store.close()
    process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
