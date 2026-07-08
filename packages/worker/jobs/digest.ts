import {
    createLogger,
    PilotStore,
    type WorkItem,
} from 'core'
import { getDiscordNotifier } from 'core'

const log = createLogger('digest')

export async function sendDigest(store: PilotStore): Promise<void> {
    const webhookUrl = Bun.env.GH_PILOT_DISCORD_WEBHOOK_URL
    if (!webhookUrl) {
        log.info('Discord webhook URL not configured, skipping digest')
        return
    }

    log.info('Generating digest summary...')

    // Get work items from last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const allItems = store.listWorkItems()
    const recentItems = allItems.filter(item => item.updatedAt > oneDayAgo)

    if (recentItems.length === 0) {
        log.info('No recent activity, skipping digest')
        return
    }

    // Group by repository
    const byRepo = new Map<string, WorkItem[]>()
    for (const item of recentItems) {
        const repo = `${item.owner}/${item.repo}`
        if (!byRepo.has(repo)) byRepo.set(repo, [])
        byRepo.get(repo)!.push(item)
    }

    // Send digest for each repo
    const notifier = getDiscordNotifier()

    for (const [repo, items] of byRepo) {
        const embed = buildDigestEmbed(repo, items)

        try {
            await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ embeds: [embed] })
            })
            log.info(`Sent digest for ${repo} (${items.length} items)`)
        } catch (error) {
            log.error(`Failed to send digest for ${repo}`, { error: String(error) })
        }
    }

    log.info('Digest summary complete')
}

function buildDigestEmbed(repo: string, items: WorkItem[]) {
    const issues = items.filter(i => i.type === 'issue')
    const prs = items.filter(i => i.type === 'pull_request')
    const failures = items.filter(i => i.type === 'check_failure')

    const fields = []

    if (issues.length > 0) {
        const opened = issues.filter(i => i.state === 'open').length
        const closed = issues.filter(i => i.state === 'closed').length
        fields.push({
            name: '📋 Issues',
            value: `${opened} opened, ${closed} closed`,
            inline: true
        })
    }

    if (prs.length > 0) {
        const opened = prs.filter(i => i.state === 'open').length
        const merged = prs.filter(i => i.state === 'merged').length
        fields.push({
            name: '🔀 Pull Requests',
            value: `${opened} opened, ${merged} merged`,
            inline: true
        })
    }

    if (failures.length > 0) {
        fields.push({
            name: '❌ Check Failures',
            value: `${failures.length} failed checks`,
            inline: true
        })
    }

    // Top contributors
    const contributors = new Map<string, number>()
    for (const item of items) {
        if (item.actor) {
            contributors.set(item.actor, (contributors.get(item.actor) ?? 0) + 1)
        }
    }

    const topContributors = [...contributors.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => `@${name}: ${count} contributions`)
        .join('\n')

    if (topContributors) {
        fields.push({
            name: '👥 Top Contributors',
            value: topContributors,
            inline: false
        })
    }

    return {
        title: `${repo} - Daily Digest`,
        color: 3447003, // Blue
        fields,
        timestamp: new Date().toISOString(),
        footer: {
            text: `${items.length} total activities in the last 24 hours`
        }
    }
}
