export type BotCommandName = 'close' | 'approve' | 'merge' | 'summarize' | 'status' | 'tag' | 'release' | 'automerge' | 'stale' | 'stats'

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

const COMMAND_ALIASES: Record<string, BotCommandName> = {
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

export function parseBotCommand(
    body: string | null | undefined,
    appSlug: string,
    legacyMentions = ['b68web']
): ParsedBotCommand | null {
    if (!body || typeof body !== 'string') return null

    const mentions = [appSlug, ...legacyMentions].filter(Boolean)
    for (const mention of mentions) {
        const pattern = new RegExp(`@${escapeRegex(mention)}\\b\\s+([^\\r\\n]+)`, 'i')
        const match = pattern.exec(body)
        if (!match) continue

        const raw = match[1]?.trim().toLowerCase()
        if (!raw) continue

        const firstToken = raw.split(/\s+/)[0]
        const command = COMMAND_ALIASES[raw] ?? COMMAND_ALIASES[firstToken]
        if (!command) return null

        return { command, raw, mention }
    }

    return null
}

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

