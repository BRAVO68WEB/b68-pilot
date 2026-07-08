import { describe, expect, test } from 'bun:test'
import { parseBotCommand } from '../../commands/parser'

describe('parseBotCommand', () => {
    const appSlug = 'gh-pilot'

    test('returns null for null/undefined body', () => {
        expect(parseBotCommand(null, appSlug)).toBeNull()
        expect(parseBotCommand(undefined, appSlug)).toBeNull()
    })

    test('returns null for empty string', () => {
        expect(parseBotCommand('', appSlug)).toBeNull()
    })

    test('returns null when no mention found', () => {
        expect(parseBotCommand('please close this', appSlug)).toBeNull()
    })

    test('parses close command', () => {
        const result = parseBotCommand('@gh-pilot close', appSlug)
        expect(result).not.toBeNull()
        expect(result!.command).toBe('close')
    })

    test('parses approve command', () => {
        const result = parseBotCommand('@gh-pilot approve', appSlug)
        expect(result).not.toBeNull()
        expect(result!.command).toBe('approve')
    })

    test('parses merge command', () => {
        const result = parseBotCommand('@gh-pilot merge', appSlug)
        expect(result).not.toBeNull()
        expect(result!.command).toBe('merge')
    })

    test('parses summarize command', () => {
        const result = parseBotCommand('@gh-pilot summarize', appSlug)
        expect(result).not.toBeNull()
        expect(result!.command).toBe('summarize')
    })

    test('parses summary alias', () => {
        const result = parseBotCommand('@gh-pilot summary', appSlug)
        expect(result).not.toBeNull()
        expect(result!.command).toBe('summarize')
    })

    test('parses status command', () => {
        const result = parseBotCommand('@gh-pilot status', appSlug)
        expect(result).not.toBeNull()
        expect(result!.command).toBe('status')
    })

    test('parses legacy close issue command', () => {
        const result = parseBotCommand('@gh-pilot close issue', appSlug)
        expect(result).not.toBeNull()
        expect(result!.command).toBe('close')
    })

    test('parses legacy close pr command', () => {
        const result = parseBotCommand('@gh-pilot close pr', appSlug)
        expect(result).not.toBeNull()
        expect(result!.command).toBe('close')
    })

    test('parses legacy merge pr command', () => {
        const result = parseBotCommand('@gh-pilot merge pr', appSlug)
        expect(result).not.toBeNull()
        expect(result!.command).toBe('merge')
    })

    test('parses legacy approve pr command', () => {
        const result = parseBotCommand('@gh-pilot approve pr', appSlug)
        expect(result).not.toBeNull()
        expect(result!.command).toBe('approve')
    })

    test('ignores unknown commands', () => {
        expect(parseBotCommand('@gh-pilot deploy', appSlug)).toBeNull()
    })

    test('handles mention in middle of comment', () => {
        const body = 'Hey there,\n\n@gh-pilot close\n\nThanks!'
        const result = parseBotCommand(body, appSlug)
        expect(result).not.toBeNull()
        expect(result!.command).toBe('close')
    })

    test('handles case insensitive mention', () => {
        const result = parseBotCommand('@GH-PILOT close', appSlug)
        expect(result).not.toBeNull()
        expect(result!.command).toBe('close')
    })

    test('supports legacy mention b68web', () => {
        const result = parseBotCommand('@b68web close', appSlug, ['b68web'])
        expect(result).not.toBeNull()
        expect(result!.command).toBe('close')
    })
})
