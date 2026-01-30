import crypto from 'crypto'
import type { GitHub } from './api'

/** GitHub issue_comment webhook payload (action: created). */
export interface IssueCommentWebhookPayload {
    action: 'created'
    comment: { body?: string | null }
    issue: { url: string; pull_request?: unknown }
    repository?: { full_name?: string }
}

const MENTION_PREFIX = '@b68web '

/** Parse first @b68web command from comment body. Returns trimmed command or null. */
export function parseMentionCommand(body: string | null | undefined): string | null {
    if (body == null || typeof body !== 'string') return null
    const idx = body.indexOf(MENTION_PREFIX)
    if (idx === -1) return null
    const after = body.slice(idx + MENTION_PREFIX.length)
    const firstLine = after.split(/\r?\n/)[0]?.trim() ?? ''
    return firstLine || null
}

const COMMANDS = {
    'close issue': 'close',
    'close pr': 'close',
    'merge pr': 'mergePR',
    'approve pr': 'approvePR',
} as const

type CommandKey = keyof typeof COMMANDS

/**
 * Execute a mention command (close / merge PR / approve PR).
 * Use this from either the polling runner or a webhook handler.
 * Returns the action performed, or null if no valid command.
 */
export async function executeMentionCommand(
    gh: GitHub,
    commentBody: string | null | undefined,
    subjectUrl: string
): Promise<keyof typeof COMMANDS | null> {
    const command = parseMentionCommand(commentBody)
    if (!command || !(command in COMMANDS)) return null

    const action = COMMANDS[command as CommandKey]
    if (action === 'close') {
        await gh.close(subjectUrl)
    } else if (action === 'mergePR') {
        await gh.mergePR(subjectUrl)
    } else if (action === 'approvePR') {
        await gh.approvePR(subjectUrl)
    }
    return command as CommandKey
}

const SIG_PREFIX = 'sha256='

/**
 * Verify GitHub webhook signature (X-Hub-Signature-256).
 * Use timing-safe comparison. Returns true if valid.
 */
export function verifyWebhookSignature(
    secret: string,
    rawBody: string | Uint8Array,
    signature: string | null | undefined
): Promise<boolean> {
    if (!signature || !signature.startsWith(SIG_PREFIX)) return Promise.resolve(false)
    const expectedHex = signature.slice(SIG_PREFIX.length)
    if (expectedHex.length !== 64) return Promise.resolve(false)

    const key = new TextEncoder().encode(secret)
    const data = typeof rawBody === 'string' ? new TextEncoder().encode(rawBody) : rawBody
    const algo = { name: 'HMAC', hash: 'SHA-256' }

    return crypto.subtle
        .importKey('raw', key, algo, false, ['sign'])
        .then((k) => {
            return crypto.subtle.sign('HMAC', k, data as unknown as NodeJS.BufferSource)
        })
        .then((sig) => hexFromBytes(new Uint8Array(sig)))
        .then((actualHex) => timingSafeEqual(actualHex, expectedHex))
}

function hexFromBytes(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
}

function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false
    let out = 0
    for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i)
    return out === 0
}
