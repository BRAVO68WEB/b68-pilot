import type { GitHub } from './api'

export interface IssueCommentWebhookPayload {
    action: 'created'
    comment: { body?: string | null }
    issue: { url: string; pull_request?: unknown }
    repository?: { full_name?: string }
}

const MENTION_PREFIX = '@gh-pilot '

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

export async function verifyWebhookSignature(
    secret: string,
    rawBody: string,
    signature: string | null | undefined
): Promise<boolean> {
    if (!signature || !signature.startsWith(SIG_PREFIX)) return false
    const expectedHex = signature.slice(SIG_PREFIX.length)
    if (expectedHex.length !== 64) return false

    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    )

    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody))
    const actualHex = Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')

    if (actualHex.length !== expectedHex.length) return false

    let result = 0
    for (let i = 0; i < actualHex.length; i++) {
        result |= actualHex.charCodeAt(i) ^ expectedHex.charCodeAt(i)
    }
    return result === 0
}
