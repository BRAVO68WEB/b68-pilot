import {
    apiPathFromUrl,
    defaultDbPath,
    DeviceFlowPendingError,
    discoverPlugins,
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

const CONFIG_PATH = join(homedir(), '.config', 'gh-pilot', 'config.json')
const PLUGINS_DIR = join(homedir(), '.config', 'gh-pilot', 'plugins')

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

    // Plugin commands
    if (command === 'plugin') return pluginCommand(args)

    throw new Error(`Unknown command: ${command}`)
}

// ─── Plugin Commands ────────────────────────────────────────────────────

async function pluginCommand(args: string[]): Promise<void> {
    const [subcommand, ...rest] = args

    if (!subcommand || subcommand === 'help') {
        printPluginHelp()
        return
    }

    if (subcommand === 'list') return pluginList()
    if (subcommand === 'install') return pluginInstall(rest[0])
    if (subcommand === 'uninstall') return pluginUninstall(rest[0])
    if (subcommand === 'info') return pluginInfo(rest[0])

    throw new Error(`Unknown plugin command: ${subcommand}`)
}

async function pluginList(): Promise<void> {
    if (!existsSync(PLUGINS_DIR)) {
        console.log('No plugins directory found. Create it with: mkdir -p ~/.config/gh-pilot/plugins')
        return
    }

    const manifests = await discoverPlugins(PLUGINS_DIR)
    if (manifests.length === 0) {
        console.log('No plugins installed.')
        return
    }

    console.log('Installed plugins:')
    for (const m of manifests) {
        console.log(`  ${m.name}@${m.version} - ${m.description ?? 'No description'}`)
    }
}

async function pluginInstall(path: string | undefined): Promise<void> {
    if (!path) {
        throw new Error('Usage: gh-pilot plugin install <path-to-plugin-directory>')
    }

    const resolvedPath = path.startsWith('~') ? path.replace('~', homedir()) : path
    if (!existsSync(resolvedPath)) {
        throw new Error(`Plugin path not found: ${resolvedPath}`)
    }

    // Validate plugin has manifest
    const manifestPath = join(resolvedPath, 'plugin.json')
    if (!existsSync(manifestPath)) {
        throw new Error(`No plugin.json found in ${resolvedPath}`)
    }

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
    if (!manifest.name) {
        throw new Error('plugin.json missing "name" field')
    }

    // Create plugins directory if needed
    mkdirSync(PLUGINS_DIR, { recursive: true })

    // Copy plugin to plugins directory (or symlink)
    const targetDir = join(PLUGINS_DIR, manifest.name)
    if (existsSync(targetDir)) {
        rmSync(targetDir, { recursive: true })
    }

    // Create symlink to the plugin
    const { symlinkSync } = await import('node:fs')
    symlinkSync(resolvedPath, targetDir)

    console.log(`Installed plugin: ${manifest.name}@${manifest.version}`)
    console.log(`Location: ${targetDir}`)
}

async function pluginUninstall(name: string | undefined): Promise<void> {
    if (!name) {
        throw new Error('Usage: gh-pilot plugin uninstall <plugin-name>')
    }

    const targetDir = join(PLUGINS_DIR, name)
    if (!existsSync(targetDir)) {
        throw new Error(`Plugin not found: ${name}`)
    }

    rmSync(targetDir, { recursive: true })
    console.log(`Uninstalled plugin: ${name}`)
}

async function pluginInfo(name: string | undefined): Promise<void> {
    if (!name) {
        throw new Error('Usage: gh-pilot plugin info <plugin-name>')
    }

    const targetDir = join(PLUGINS_DIR, name)
    if (!existsSync(targetDir)) {
        throw new Error(`Plugin not found: ${name}`)
    }

    const manifestPath = join(targetDir, 'plugin.json')
    if (!existsSync(manifestPath)) {
        throw new Error(`No plugin.json found for ${name}`)
    }

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
    console.log(`Plugin: ${manifest.name}`)
    console.log(`Version: ${manifest.version}`)
    console.log(`Description: ${manifest.description ?? 'N/A'}`)
    console.log(`Author: ${manifest.author ?? 'N/A'}`)
    console.log(`Entry: ${manifest.entry}`)
    if (manifest.commands?.length) {
        console.log(`Commands: ${manifest.commands.join(', ')}`)
    }
    if (manifest.hooks?.length) {
        console.log(`Hooks: ${manifest.hooks.join(', ')}`)
    }
    if (manifest.events?.length) {
        console.log(`Events: ${manifest.events.join(', ')}`)
    }
}

// ─── Existing Commands ──────────────────────────────────────────────────

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
        body: 'Approved from gh-pilot CLI.',
    })
    console.log(`Approved ${target.owner}/${target.repo}#${target.number}`)
}

async function merge(args: string[]): Promise<void> {
    const target = parseTarget(args[0])
    await userRequest('PUT', `/repos/${target.owner}/${target.repo}/pulls/${target.number}/merge`, {
        commit_title: `Merge pull request #${target.number}`,
        commit_message: 'Merged from gh-pilot CLI.',
    })
    console.log(`Merged ${target.owner}/${target.repo}#${target.number}`)
}

async function review(args: string[]): Promise<void> {
    const target = parseTarget(args[0])
    const body = args.slice(1).join(' ') || 'Changes requested from gh-pilot CLI.'
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
        throw new Error('Not logged in. Run `gh-pilot login` first.')
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
    console.log(`gh-pilot commands:
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
  summarize owner/repo#123
  plugin list
  plugin install <path>
  plugin uninstall <name>
  plugin info <name>`)
}

function printPluginHelp(): void {
    console.log(`Plugin commands:
  plugin list                 List installed plugins
  plugin install <path>       Install a plugin from a local directory
  plugin uninstall <name>     Uninstall a plugin
  plugin info <name>          Show plugin details`)
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

main(Bun.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
})
