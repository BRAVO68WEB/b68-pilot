import {
    executeMentionCommand,
    GitHub,
    GitHubNotification,
} from 'core'

export function getToken(): string {
    const token = Bun.env.B68_GH_TOKEN
    if (!token || !String(token).trim()) {
        throw new Error('B68_GH_TOKEN is required. Set it in the environment.')
    }
    return String(token).trim()
}

/** Polling runner: fetch notifications and process @b68web mention commands. */
export const runner = async () => {
    const gh = new GitHub(getToken())
    const notifications: GitHubNotification[] = await gh.notifications()

    console.log('Notifications:', notifications.length)
    if (!notifications.length) {
        console.log('No notifications!')
        return
    }

    for (const notification of notifications) {
        console.log('Notification for:', notification.reason)

        if (notification.reason === 'assign') {
            console.log('I was assigned on', notification.repository.full_name)
        } else if (notification.reason === 'mention') {
            console.log('Mentioned at', notification.repository.full_name)

            const commentUrl = notification.subject.latest_comment_url
            if (!commentUrl) continue

            const path = commentUrl.replace('https://api.github.com', '')
            const comment = await gh.fetch<{ body?: string }>(path)
            const subjectUrl = notification.subject.url
            const command = await executeMentionCommand(gh, comment?.body, subjectUrl)
            if (command) console.log('Executed command:', command)
        }

        await gh.markAsRead(notification.url)
    }

    console.log('Worker run complete.')
}
