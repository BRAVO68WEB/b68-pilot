import { GitHub } from 'core'

const gh = new GitHub(Bun.env.B68_GH_TOKEN as string)

export const runner = async () => {
    console.log("Loading worker...")

    const notifications: any[] = await gh.notifications()

    console.log("Notifications: ", notifications.length)

    for (const notification of notifications) {
        console.log("Notification for: ", notification.reason)

        if (notification.reason === 'assign') {
            console.log("I was assigned on " + notification.repository.full_name)
        }

        else if (notification.reason === 'mention') {
            console.log("Mentioned at " + notification.repository.full_name)

            const getComment = await gh.fetch(notification.subject.latest_comment_url.replace('https://api.github.com', ''))

            const rawComment = getComment.body.split('@b68web ')
            const command = rawComment[1]

            switch (command) {
                case 'close issue': {
                    console.log("Closing issue " + notification.subject.url)

                    await gh.close(notification.subject.url)

                    break
                }

                case 'close pr': {
                    console.log("Closing PR " + notification.subject.url)

                    await gh.close(notification.subject.url)
                    
                    break
                }

                case 'merge pr': {
                    console.log("Merging PR " + notification.subject.url)

                    await gh.mergePR(notification.subject.url)

                    break
                }

                case 'approve pr': {
                    console.log("Approving PR " + notification.subject.url)

                    await gh.approvePR(notification.subject.url)

                    break
                }
            }
        }

        await gh.markAsRead(notification.url)
    }

    console.log("Worker loaded!")
}