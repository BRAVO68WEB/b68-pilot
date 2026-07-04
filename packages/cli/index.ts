import {
    apiPathFromUrl,
    defaultDbPath,
    DeviceFlowPendingError,
    GitHubInstallationClient,
    GitHubUserClient,
    githubRequest,
    InstallationTokenCache,
    loadGitHubAppConfig,
    mergeWorkItems,
    PilotStore,
    requestDeviceCode,
    requestDeviceToken,
    summarizePullRequest,
    type WorkItem,
} from 'core'
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'

interface CliConfig {
    accessToken?: string
    login?: string
}

const CONFIG_PATH = join(homedir(), '.config', 'b68-pilot', 'config.json')

async function main(argv: string[]): Promise<void> {
    const [command, ...args] = argv

    if (!command || command === 'help' || command === '--help') {
        printHelp()
        return
    }

    if (command === 'login') return login()
    if (command === 'logout') return logout()
    if (command === 'whoami') return whoami()
    if (command === 'installations') return installations()
    if (command === 'work') return work(args)
    if (command === 'close') return close(args)
    if (command === 'approve') return approve(args)
    if (command === 'merge') return merge(args)
    if (command === 'review') return review(args)
    if (command === 'assign') return assign(args)
    if (command === 'comment') return comment(args)
    if (command === 'summarize') return summarize(args)

    throw new Error(`Unknown command: ${command}`)
}

async function login(): Promise<void> {
    const config = loadGitHubAppConfig(Bun.env)
    const device = await requestDeviceCode(config.clientId)

    console.log(`Open ${device.verification_uri}`)
    console.log(`Enter code: ${device.user_code}`)

    const expiresAt = Date.now() + device.expires_in * 1000
    let interval = device.interval * 1000

    while (Date.now() < expiresAt) {
        await sleep(interval)
        try {
            const token = await requestDeviceToken(config.clientId, device.device_code)
            const gh = new GitHubUserClient(token.access_token)
            const me = await gh.me()
            saveConfig({ accessToken: token.access_token, login: me.login })
            console.log(`Logged in as ${me.login}`)
            return
        } catch (error) {
            if (!(error instanceof DeviceFlowPendingError)) throw error
            if (error.code === 'authorization_pending') continue
            if (error.code === 'slow_down') {
                interval += 5000
                continue
            }
            throw new Error(`GitHub login failed: ${error.code}`)
        }
    }

    throw new Error('GitHub login expired.')
}

function logout(): void {
    if (existsSync(CONFIG_PATH)) rmSync(CONFIG_PATH)
    console.log('Logged out.')
}

async function whoami(): Promise<void> {
    const gh = requireUserClient()
    const me = await gh.me()
    console.log(`${me.login}${me.name ? ` (${me.name})` : ''}`)
}

async function installations(): Promise<void> {
    const gh = requireUserClient()
    const rows = await gh.listInstallations()
    console.log(JSON.stringify(rows, null, 2))
}

async function work(args: string[]): Promise<void> {
    const repo = readRepoFlag(args)
    const gh = requireUserClient()
    const me = await gh.me()
    const queried = await gh.nextWorkItems(me.login, repo)

    let stored: WorkItem[] = []
    try {
        const store = new PilotStore(defaultDbPath(Bun.env))
        stored = store.listWorkItems(repo)
        store.close()
    } catch {
        stored = []
    }

    printWorkItems(mergeWorkItems(stored, queried))
}

async function close(args: string[]): Promise<void> {
    const target = parseTarget(args[0])
    await userRequest('PATCH', `/repos/${target.owner}/${target.repo}/issues/${target.number}`, { state: 'closed' })
    console.log(`Closed ${target.owner}/${target.repo}#${target.number}`)
}

async function approve(args: string[]): Promise<void> {
    const target = parseTarget(args[0])
    await userRequest('POST', `/repos/${target.owner}/${target.repo}/pulls/${target.number}/reviews`, {
        event: 'APPROVE',
        body: 'Approved from b68-pilot CLI.',
    })
    console.log(`Approved ${target.owner}/${target.repo}#${target.number}`)
}

async function merge(args: string[]): Promise<void> {
    const target = parseTarget(args[0])
    await userRequest('PUT', `/repos/${target.owner}/${target.repo}/pulls/${target.number}/merge`, {
        commit_title: `Merge pull request #${target.number}`,
        commit_message: 'Merged from b68-pilot CLI.',
    })
    console.log(`Merged ${target.owner}/${target.repo}#${target.number}`)
}

async function review(args: string[]): Promise<void> {
    const target = parseTarget(args[0])
    const body = args.slice(1).join(' ') || 'Changes requested from b68-pilot CLI.'
    await userRequest('POST', `/repos/${target.owner}/${target.repo}/pulls/${target.number}/reviews`, {
        event: 'REQUEST_CHANGES',
        body,
    })
    console.log(`Requested changes on ${target.owner}/${target.repo}#${target.number}`)
}

async function assign(args: string[]): Promise<void> {
    const target = parseTarget(args[0])
    const gh = requireUserClient()
    const me = await gh.me()
    const assignee = args[1] || me.login
    await userRequest('POST', `/repos/${target.owner}/${target.repo}/issues/${target.number}/assignees`, {
        assignees: [assignee],
    })
    console.log(`Assigned ${assignee} to ${target.owner}/${target.repo}#${target.number}`)
}

async function comment(args: string[]): Promise<void> {
    const target = parseTarget(args[0])
    const body = args.slice(1).join(' ')
    if (!body) throw new Error('Comment body is required')
    await userRequest('POST', `/repos/${target.owner}/${target.repo}/issues/${target.number}/comments`, {
        body,
    })
    console.log(`Commented on ${target.owner}/${target.repo}#${target.number}`)
}

async function summarize(args: string[]): Promise<void> {
    const target = parseTarget(args[0])
    const summary = await userRequest('GET', `/repos/${target.owner}/${target.repo}/pulls/${target.number}`)
    const pr = summary as { changed_files: number; additions: number; deletions: number; title: string }

    const files = await userRequest('GET', `/repos/${target.owner}/${target.repo}/pulls/${target.number}/files`) as Array<{
        filename: string
        additions: number
        deletions: number
        status: string
    }>

    console.log(`PR #${target.number}: ${pr.title}`)
    console.log(`${pr.changed_files} file(s) changed, +${pr.additions} / -${pr.deletions}`)
    console.log('')
    for (const file of files.slice(0, 20)) {
        const prefix = file.status === 'added' ? '+' : file.status === 'removed' ? '-' : '~'
        console.log(`  ${prefix} ${file.filename} (+${file.additions}/-${file.deletions})`)
    }
    if (files.length > 20) {
        console.log(`  ... and ${files.length - 20} more`)
    }
}

async function userRequest(method: string, path: string, body?: unknown): Promise<unknown> {
    const token = requireToken()
    return githubRequest({
        token,
        method,
        path: apiPathFromUrl(path),
        body,
    })
}

function printWorkItems(items: WorkItem[]): void {
    if (!items.length) {
        console.log('No work items found.')
        return
    }

    for (const item of items) {
        console.log(
            [
                `${item.owner}/${item.repo}#${item.number}`,
                item.type,
                item.reason,
                item.title,
                item.url,
            ].join(' | ')
        )
    }
}

function requireUserClient(): GitHubUserClient {
    return new GitHubUserClient(requireToken())
}

function requireToken(): string {
    const config = readConfig()
    if (!config.accessToken) {
        throw new Error('Not logged in. Run `b68 login` first.')
    }
    return config.accessToken
}

function readConfig(): CliConfig {
    if (!existsSync(CONFIG_PATH)) return {}
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as CliConfig
}

function saveConfig(config: CliConfig): void {
    mkdirSync(dirname(CONFIG_PATH), { recursive: true })
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
    chmodSync(CONFIG_PATH, 0o600)
}

function parseTarget(input: string | undefined): { owner: string; repo: string; number: number } {
    if (!input) throw new Error('Expected target like owner/repo#123')
    const match = /^([^/]+)\/([^#]+)#(\d+)$/.exec(input)
    if (!match) throw new Error('Expected target like owner/repo#123')
    return { owner: match[1], repo: match[2], number: Number(match[3]) }
}

function readRepoFlag(args: string[]): string | undefined {
    const index = args.indexOf('--repo')
    if (index === -1) return undefined
    const repo = args[index + 1]
    if (!repo || !repo.includes('/')) throw new Error('Expected --repo owner/name')
    return repo
}

function printHelp(): void {
    console.log(`b68 commands:
  login
  logout
  whoami
  installations
  work [--repo owner/name]
  close owner/repo#123
  approve owner/repo#123
  merge owner/repo#123
  review owner/repo#123 [message]
  assign owner/repo#123 [username]
  comment owner/repo#123 message
  summarize owner/repo#123`)
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

main(Bun.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
})
