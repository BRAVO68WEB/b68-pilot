import {
    createLogger,
    defaultDbPath,
    loadGitHubAppConfig,
    PilotStore,
    verifyWebhookSignature,
} from 'core'
import { GitHubWebhookHandler } from './handlers/github-webhook'

const log = createLogger('webhook-server')
const PORT = Number(Bun.env.B68_WEBHOOK_PORT) || 3131
const config = loadGitHubAppConfig(Bun.env)
const store = new PilotStore(defaultDbPath(Bun.env))
const handler = new GitHubWebhookHandler(config, store)

const server = Bun.serve({
    port: PORT,
    async fetch(req) {
        const url = new URL(req.url)
        if (url.pathname !== '/github/webhook' && url.pathname !== '/webhook') {
            return new Response('Not Found', { status: 404 })
        }
        if (req.method !== 'POST') {
            return new Response('Method Not Allowed', { status: 405 })
        }

        const event = req.headers.get('X-GitHub-Event') ?? 'unknown'
        const deliveryId = req.headers.get('X-GitHub-Delivery') ?? crypto.randomUUID()
        const signature = req.headers.get('X-Hub-Signature-256')
        const rawBody = await req.text()

        if (event === 'ping') {
            log.info('Received ping event')
            return json({ ok: true, message: 'pong' })
        }

        if (!(await verifyWebhookSignature(config.webhookSecret, rawBody, signature))) {
            log.warn('Invalid webhook signature', { deliveryId, event })
            return new Response('Forbidden', { status: 403 })
        }

        try {
            const result = await handler.handle({ deliveryId, event, rawBody })
            log.info('Webhook processed', { deliveryId, event, ...result })
            return json(result)
        } catch (error) {
            log.error('Webhook error', { deliveryId, event, error: String(error) })
            return json({ ok: false, error: String(error) }, 500)
        }
    },
})

log.info(`Listening on http://localhost:${server.port}/github/webhook`)

function shutdown(signal: string) {
    log.info(`Received ${signal}, shutting down...`)
    server.stop()
    store.close()
    process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })
}
