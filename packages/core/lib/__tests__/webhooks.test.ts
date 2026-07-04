import { describe, expect, test } from 'bun:test'
import { parseMentionCommand, verifyWebhookSignature } from '../webhooks'

describe('parseMentionCommand', () => {
    test('returns null for null body', () => {
        expect(parseMentionCommand(null)).toBeNull()
    })

    test('returns null for undefined body', () => {
        expect(parseMentionCommand(undefined)).toBeNull()
    })

    test('returns null for empty string', () => {
        expect(parseMentionCommand('')).toBeNull()
    })

    test('returns null when no mention', () => {
        expect(parseMentionCommand('hello world')).toBeNull()
    })

    test('extracts command after @b68web mention', () => {
        expect(parseMentionCommand('@b68web close')).toBe('close')
    })

    test('extracts command from multi-line comment', () => {
        const body = 'Some text\n@b68web merge\nMore text'
        expect(parseMentionCommand(body)).toBe('merge')
    })

    test('returns first line only', () => {
        expect(parseMentionCommand('@b68web close\nother stuff')).toBe('close')
    })

    test('trims whitespace', () => {
        expect(parseMentionCommand('@b68web   close   ')).toBe('close')
    })

    test('returns null for mention without command', () => {
        expect(parseMentionCommand('@b68web ')).toBeNull()
    })
})

describe('verifyWebhookSignature', () => {
    const secret = 'test-secret'

    test('returns false for null signature', async () => {
        expect(await verifyWebhookSignature(secret, 'body', null)).toBe(false)
    })

    test('returns false for undefined signature', async () => {
        expect(await verifyWebhookSignature(secret, 'body', undefined)).toBe(false)
    })

    test('returns false for invalid signature format', async () => {
        expect(await verifyWebhookSignature(secret, 'body', 'invalid')).toBe(false)
    })

    test('returns false for wrong signature', async () => {
        expect(await verifyWebhookSignature(secret, 'body', 'sha256=0000000000000000000000000000000000000000000000000000000000000000')).toBe(false)
    })

    test('returns true for valid signature', async () => {
        const encoder = new TextEncoder()
        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(secret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        )
        const sig = await crypto.subtle.sign('HMAC', key, encoder.encode('test-body'))
        const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')

        expect(await verifyWebhookSignature(secret, 'test-body', `sha256=${hex}`)).toBe(true)
    })
})
