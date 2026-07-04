import { createHmac, timingSafeEqual } from 'crypto'
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

export const sign = async (secret: string, payload: string): Promise<string> => {
  const algorithm = "sha256";

  return `${algorithm}=${createHmac(algorithm, secret)
    .update(payload)
    .digest("hex")}`;
}

/**
 * Verify GitHub webhook signature (X-Hub-Signature-256).
 * Use timing-safe comparison. Returns true if valid.
 */
export async function verifyWebhookSignature(
    secret: string,
    rawBody: string,
    signature: string
): Promise<boolean> {
  const signatureBuffer = Buffer.from(signature);

    const verificationBuffer = Buffer.from(await sign(secret, rawBody));

    if (signatureBuffer.length !== verificationBuffer.length) {
      return false;
    }

    // constant time comparison to prevent timing attacks
    // https://stackoverflow.com/a/31096242/206879
    // https://en.wikipedia.org/wiki/Timing_attack
    return timingSafeEqual(signatureBuffer, verificationBuffer);
}
