import { IMethod, gh_client, GitHub } from 'core'

const gh = new GitHub(Bun.env.B68_GH_TOKEN as string)

const notifications = await gh.notifications()

for (const notification of notifications) {
    console.log(notification.subject.title)
}