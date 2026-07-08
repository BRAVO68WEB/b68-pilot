import {
    ConfigStore,
    createLogger,
    defaultDbPath,
    loadGitHubAppConfig,
    PilotStore,
    verifyWebhookSignature,
} from 'core'
import { GitHubWebhookHandler } from './handlers/github-webhook'
import { createApiRoutes } from './routes/api'

const log = createLogger('webhook-server')
const PORT = Number(Bun.env.GH_PILOT_WEBHOOK_PORT) || 3131
const config = loadGitHubAppConfig(Bun.env)
const store = new PilotStore(defaultDbPath(Bun.env))
const configStore = new ConfigStore(store)
const handler = new GitHubWebhookHandler(config, store)
const api = createApiRoutes({ store, configStore })

const server = Bun.serve({
    port: PORT,
    async fetch(req, server) {
        const url = new URL(req.url)

        // ─── WebSocket Upgrade ─────────────────────────────────────────
        if (url.pathname === '/ws') {
            if (server.upgrade(req)) {
                return undefined as any
            }
            return new Response('WebSocket upgrade failed', { status: 500 })
        }

        // ─── Dashboard API Routes ──────────────────────────────────────
        if (url.pathname.startsWith('/api/')) {
            return handleApiRoute(req, url)
        }

        // ─── GitHub Webhook ────────────────────────────────────────────
        if (url.pathname !== '/github/webhook' && url.pathname !== '/webhook') {
            return new Response('Not Found', { status: 404 })
        }
        if (req.method !== 'POST') {
            return new Response('Method Not Allowed', { status: 405 })
        }

        const event = req.headers.get('X-GitHub-Event')
        const deliveryId = req.headers.get('X-GitHub-Delivery') ?? crypto.randomUUID()
        const signature = req.headers.get('X-Hub-Signature-256')
        const rawBody = await req.text()

        if (!event || !signature) {
            return json({ ok: true, message: 'gh-pilot webhook endpoint' })
        }

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
    websocket: {
        message(ws, message) {
            // Handle incoming WebSocket messages if needed
            log.info('WebSocket message received', { data: String(message) })
        },
        open(ws) {
            log.info('WebSocket client connected')
        },
        close(ws) {
            log.info('WebSocket client disconnected')
        },
    },
})

/** Route API requests to the appropriate handler */
async function handleApiRoute(req: Request, url: URL): Promise<Response> {
    const path = url.pathname
    const method = req.method

    try {
        // Parse route segments
        const segments = path.split('/').filter(Boolean) // ['api', ...]

        // GET /api/repos
        if (segments[1] === 'repos' && segments.length === 2 && method === 'GET') {
            return api.listRepos()
        }

        // GET /api/repos/:owner/:repo
        if (segments[1] === 'repos' && segments.length === 4 && method === 'GET') {
            return api.getRepoConfig(segments[2], segments[3])
        }

        // PUT /api/repos/:owner/:repo
        if (segments[1] === 'repos' && segments.length === 4 && method === 'PUT') {
            const body = await req.json()
            return await api.updateRepoConfig(segments[2], segments[3], body)
        }

        // DELETE /api/repos/:owner/:repo
        if (segments[1] === 'repos' && segments.length === 4 && method === 'DELETE') {
            return api.deleteRepoConfig(segments[2], segments[3])
        }

        // GET /api/repos/:owner/:repo/rules
        if (segments[1] === 'repos' && segments[4] === 'rules' && segments.length === 5 && method === 'GET') {
            return api.listRules(segments[2], segments[3])
        }

        // POST /api/repos/:owner/:repo/rules
        if (segments[1] === 'repos' && segments[4] === 'rules' && segments.length === 5 && method === 'POST') {
            const body = await req.json()
            return await api.createRule(segments[2], segments[3], body)
        }

        // PUT /api/repos/:owner/:repo/rules/:id
        if (segments[1] === 'repos' && segments[4] === 'rules' && segments.length === 6 && method === 'PUT') {
            const body = await req.json()
            return await api.updateRule(segments[2], segments[3], segments[5], body)
        }

        // DELETE /api/repos/:owner/:repo/rules/:id
        if (segments[1] === 'repos' && segments[4] === 'rules' && segments.length === 6 && method === 'DELETE') {
            return api.deleteRule(segments[2], segments[3], segments[5])
        }

        // GET /api/plugins
        if (segments[1] === 'plugins' && segments.length === 2 && method === 'GET') {
            return api.listPlugins()
        }

        // POST /api/plugins/:name/enable
        if (segments[1] === 'plugins' && segments[3] === 'enable' && method === 'POST') {
            const body = await req.json() as any
            return api.enablePlugin(segments[2], body.owner, body.repo)
        }

        // POST /api/plugins/:name/disable
        if (segments[1] === 'plugins' && segments[3] === 'disable' && method === 'POST') {
            const body = await req.json() as any
            return api.disablePlugin(segments[2], body.owner, body.repo)
        }

        // GET /api/plugins/:name/config
        if (segments[1] === 'plugins' && segments[3] === 'config' && segments.length === 4 && method === 'GET') {
            const owner = url.searchParams.get('owner') ?? ''
            const repo = url.searchParams.get('repo') ?? ''
            return api.getPluginConfig(segments[2], owner, repo)
        }

        // PUT /api/plugins/:name/config
        if (segments[1] === 'plugins' && segments[3] === 'config' && segments.length === 4 && method === 'PUT') {
            const body = await req.json() as any
            return await api.updatePluginConfig(segments[2], body.owner, body.repo, body)
        }

        // GET /api/commands
        if (segments[1] === 'commands' && segments.length === 2 && method === 'GET') {
            return api.listCommands()
        }

        // GET /api/activity
        if (segments[1] === 'activity' && method === 'GET') {
            const limit = parseInt(url.searchParams.get('limit') ?? '50')
            return api.getActivity(limit)
        }

        // GET /api/stats
        if (segments[1] === 'stats' && method === 'GET') {
            return api.getStats()
        }

        return json({ error: 'Not found' }, 404)
    } catch (error) {
        log.error('API error', { path, error: String(error) })
        return json({ error: String(error) }, 500)
    }
}

log.info(`Listening on http://localhost:${server.port}`)
log.info(`  Webhook: http://localhost:${server.port}/github/webhook`)
log.info(`  API:     http://localhost:${server.port}/api`)
log.info(`  WS:      ws://localhost:${server.port}/ws`)

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
