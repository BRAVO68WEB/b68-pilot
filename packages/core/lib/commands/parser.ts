export type BotCommandName = string

export interface ParsedBotCommand {
    command: BotCommandName
    raw: string
    mention: string
}

const LEGACY_COMMANDS: Record<string, BotCommandName> = {
    'close issue': 'close',
    'close pr': 'close',
    'approve pr': 'approve',
    'merge pr': 'merge',
}

const BUILTIN_ALIASES: Record<string, BotCommandName> = {
    close: 'close',
    approve: 'approve',
    merge: 'merge',
    summarize: 'summarize',
    summary: 'summarize',
    status: 'status',
    tag: 'tag',
    release: 'release',
    automerge: 'automerge',
    'auto-merge': 'automerge',
    stale: 'stale',
    stats: 'stats',
    statistics: 'stats',
    ...LEGACY_COMMANDS,
}

/**
 * Parse a bot command from a comment body.
 * Accepts optional extra aliases from CommandRegistry (plugin-registered commands).
 */
export function parseBotCommand(
    body: string | null | undefined,
    appSlug: string,
    legacyMentions = ['gh-pilot'],
    extraAliases?: Record<string, string>
): ParsedBotCommand | null {
    if (!body || typeof body !== 'string') return null

    const aliases = { ...BUILTIN_ALIASES, ...extraAliases }

    const mentions = [appSlug, ...legacyMentions].filter(Boolean)
    for (const mention of mentions) {
        const pattern = new RegExp(`@${escapeRegex(mention)}\\b\\s+([^\\r\\n]+)`, 'i')
        const match = pattern.exec(body)
        if (!match) continue

        const raw = match[1]?.trim().toLowerCase()
        if (!raw) continue

        // Try full match first (e.g., "close issue"), then first token (e.g., "close v1.2.3")
        const firstToken = raw.split(/\s+/)[0]
        const command = aliases[raw] ?? aliases[firstToken]
        if (!command) return null

        return { command, raw, mention }
    }

    return null
}

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
