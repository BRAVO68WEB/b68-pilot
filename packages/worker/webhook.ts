/**
 * Webhook server: receive GitHub issue_comment events and run @b68web commands.
 * Run with: bun run webhook.ts
 *
 * Env:
 *   B68_GH_TOKEN     - GitHub token (required)
 *   B68_WEBHOOK_SECRET - Webhook secret from repo Settings → Webhooks (required for verification)
 *   B68_WEBHOOK_PORT  - Port (default 3131)
 *
 * In GitHub: add a repository webhook with:
 *   Payload URL: https://your-host/webhook (or use ngrok for local dev)
 *   Content type: application/json
 *   Secret: set B68_WEBHOOK_SECRET to the same value
 *   Events: Issue comments
 */

import {
    executeMentionCommand,
    GitHub,
    IssueCommentWebhookPayload,
    verifyWebhookSignature,
} from 'core'
import { getToken } from './runner'

const PORT = Number(Bun.env.B68_WEBHOOK_PORT) || 3131

const server = Bun.serve({
    port: PORT,
    async fetch(req) {
        const url = new URL(req.url)
        if (url.pathname !== '/webhook' && url.pathname !== '/') {
            return new Response('Not Found', { status: 404 })
        }
        if (req.method !== 'POST') {
            return new Response('Method Not Allowed', { status: 405 })
        }

        const event = req.headers.get('X-GitHub-Event')
        const signature = req.headers.get('X-Hub-Signature-256')
        const rawBody = await req.text()

        if (event === 'ping') {
            return new Response(JSON.stringify({ ok: true, message: 'pong' }), {
                headers: { 'Content-Type': 'application/json' },
            })
        }

        if (event !== 'issue_comment') {
            return new Response(JSON.stringify({ ok: true, ignored: event }), {
                headers: { 'Content-Type': 'application/json' },
                status: 200,
            })
        }

        const secret = Bun.env.B68_WEBHOOK_SECRET
        if (!secret?.length) {
            console.error('B68_WEBHOOK_SECRET is required for webhook verification')
            return new Response('Server configuration error', { status: 500 })
        }
        if (!(await verifyWebhookSignature(secret, rawBody, signature))) {
            console.warn('Webhook signature verification failed')
            return new Response('Forbidden', { status: 403 })
        }

        let payload: IssueCommentWebhookPayload
        try {
            payload = JSON.parse(rawBody) as IssueCommentWebhookPayload
        } catch {
            return new Response('Bad Request', { status: 400 })
        }

        if (payload.action !== 'created') {
            return new Response(JSON.stringify({ ok: true }), {
                headers: { 'Content-Type': 'application/json' },
            })
        }

        const gh = new GitHub(getToken())
        const subjectUrl = payload.issue?.url
        const commentBody = payload.comment?.body
        if (!subjectUrl) {
            return new Response(JSON.stringify({ ok: false, error: 'Missing issue.url' }), {
                headers: { 'Content-Type': 'application/json' },
                status: 400,
            })
        }

        try {
            const command = await executeMentionCommand(gh, commentBody, subjectUrl)
            const repo = payload.repository?.full_name ?? 'unknown'
            if (command) {
                console.log(`[webhook] ${repo}: executed "${command}"`)
            }
            return new Response(
                JSON.stringify({ ok: true, command: command ?? null }),
                { headers: { 'Content-Type': 'application/json' } }
            )
        } catch (err) {
            console.error('[webhook] Error:', err)
            return new Response(
                JSON.stringify({ ok: false, error: String(err) }),
                { headers: { 'Content-Type': 'application/json' }, status: 500 }
            )
        }
    },
})

console.log(`Webhook server listening on http://localhost:${server.port}`)
console.log('Configure GitHub repo webhook: Payload URL → http(s)://your-host/webhook, Events: Issue comments')
