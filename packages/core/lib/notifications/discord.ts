import { createLogger } from '../logger'

const log = createLogger('discord')

export interface DiscordEvent {
    type: 'issue' | 'pull_request' | 'release' | 'stale'
    repo: string
    title: string
    url: string
    actor?: string
    action?: string
}

export interface DiscordEmbed {
    title: string
    color: number
    fields: Array<{ name: string; value: string; inline?: boolean }>
    timestamp?: string
    url?: string
}

export class DiscordNotifier {
    private queue: Map<string, DiscordEvent[]> = new Map()
    private flushTimer: ReturnType<typeof setInterval> | null = null

    constructor() {
        const interval = parseInt(Bun.env.GH_PILOT_DISCORD_BATCH_INTERVAL ?? '300') * 1000
        this.flushTimer = setInterval(() => this.flush(), interval)
    }

    async enqueue(repo: string, event: DiscordEvent): Promise<void> {
        const events = Bun.env.GH_PILOT_DISCORD_EVENTS?.split(',') ?? ['issue', 'pull_request', 'release', 'stale']
        if (!events.includes(event.type)) return

        if (!this.queue.has(repo)) {
            this.queue.set(repo, [])
        }
        this.queue.get(repo)!.push(event)
    }

    async flush(): Promise<void> {
        for (const [repo, events] of this.queue) {
            if (events.length === 0) continue

            const webhookUrl = this.getWebhookUrl(repo)
            if (!webhookUrl) {
                this.queue.set(repo, [])
                continue
            }

            try {
                const embed = this.buildEmbed(repo, events)
                await this.sendWebhook(webhookUrl, embed)
                log.info(`Sent ${events.length} event(s) for ${repo}`)
            } catch (error) {
                log.error(`Failed to send webhook for ${repo}`, { error: String(error) })
            }

            this.queue.set(repo, [])
        }
    }

    private getWebhookUrl(repo: string): string | null {
        // Check per-repo webhook URL
        const repoKey = repo.replace('/', '_').toUpperCase()
        const repoUrl = Bun.env[`GH_PILOT_DISCORD_WEBHOOK_${repoKey}`]
        if (repoUrl) return repoUrl

        // Fallback to global webhook URL
        return Bun.env.GH_PILOT_DISCORD_WEBHOOK_URL ?? null
    }

    private buildEmbed(repo: string, events: DiscordEvent[]): DiscordEmbed {
        const fields = events.map(event => {
            const icon = this.getEventIcon(event.type)
            const action = event.action ? ` ${event.action}` : ''
            const actor = event.actor ? ` by @${event.actor}` : ''

            return {
                name: `${icon} ${event.type}${action}`,
                value: `[${event.title}](${event.url})${actor}`,
                inline: false
            }
        })

        return {
            title: `${repo} - Recent Activity`,
            color: 3066993, // Green
            fields,
            timestamp: new Date().toISOString()
        }
    }

    private getEventIcon(type: string): string {
        switch (type) {
            case 'issue': return '📋'
            case 'pull_request': return '🔀'
            case 'release': return '🏷️'
            case 'stale': return '⏰'
            default: return '📌'
        }
    }

    private async sendWebhook(url: string, embed: DiscordEmbed): Promise<void> {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [embed] })
        })

        if (!response.ok) {
            throw new Error(`Discord webhook failed: ${response.status} ${response.statusText}`)
        }
    }

    destroy(): void {
        if (this.flushTimer) {
            clearInterval(this.flushTimer)
            this.flushTimer = null
        }
    }
}

// Singleton instance
let notifier: DiscordNotifier | null = null

export function getDiscordNotifier(): DiscordNotifier {
    if (!notifier) {
        notifier = new DiscordNotifier()
    }
    return notifier
}
