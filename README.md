# gh-pilot

<p align="center">
    <img src="./assets/b68-pilot.png" alt="gh-pilot" width="600" height="200" />
</p>

**gh-pilot** is an extensible GitHub automation platform — a bot, CLI, and dashboard for managing repositories, pull requests, issues, and workflows.

Powered by the [@b68-pilot](https://github.com/apps/b68-pilot) GitHub App.

## ✨ Features

### 🚀 Release Management
- **Auto-release on PR merge** — Add `release:patch`, `release:minor`, or `release:major` label to a PR. When merged, the bot automatically creates a tag, generates release notes, and creates a GitHub Release.
- **Manual tag/release** — `@gh-pilot tag v1.2.3` or `@gh-pilot release v1.2.3`
- **Changelog generation** — Auto-updates `CHANGELOG.md` on release (configurable)

### 🔀 PR Automation
- **Auto-labeling** — Labels PRs by file patterns (`.github/labeler.yml`), size (S/M/L/XL), and conventional commit prefix (`feat:`, `fix:`, etc.)
- **Auto-merge** — `@gh-pilot automerge` to queue PR for merge when approved + checks pass
- **Review assignment** — Auto-assigns reviewers on PR open (round-robin, CODEOWNERS, or load-balancing)

### 📋 Issue Management
- **Stale issues** — Auto-labels and closes inactive issues after configurable period (default: 15 days)
- **Issue triage** — Auto-labels issues based on keywords in title/body

### 🔔 Notifications
- **Discord integration** — Sends batched notifications per-repo to Discord channels
- **Daily digest** — Activity summary sent daily at 9 AM

### 📊 Analytics
- **Activity reports** — `@gh-pilot stats` shows PR/issue stats, top contributors

### 🔌 Plugin System
- **Lifecycle hooks** — `onInit`, `onTrigger`, `onEntry`, `onExit`, `onError`
- **Custom commands** — Plugins can register new bot commands
- **Per-repo config** — Managed via dashboard or config files

### 🖥️ Dashboard
- **Web UI** — React-based dashboard for managing repos, rules, plugins, and viewing activity
- **Real-time updates** — WebSocket support for live activity feed

### 🛠️ Existing Features
- **Webhook commands** — `close`, `approve`, `merge`, `summarize`, `status`
- **CLI** — `gh-pilot login`, `work`, `close`, `approve`, `merge`, `review`, `assign`, `comment`, `summarize`, `stats`
- **Reconciliation** — Syncs work items from GitHub every 5 minutes

## 🤖 Bot Commands

| Command | Description |
|---------|-------------|
| `@gh-pilot close` | Close issue/PR |
| `@gh-pilot approve` | Approve PR |
| `@gh-pilot merge` | Merge PR |
| `@gh-pilot summarize` | Generate PR diff summary |
| `@gh-pilot status` | Bot health check |
| `@gh-pilot tag v1.2.3` | Create tag on current commit |
| `@gh-pilot release v1.2.3` | Create release with auto-generated notes |
| `@gh-pilot automerge` | Queue PR for auto-merge |
| `@gh-pilot automerge cancel` | Remove PR from auto-merge queue |
| `@gh-pilot stale` | Check stale issues |
| `@gh-pilot stale --exclude` | Exempt issue from stale check |
| `@gh-pilot stats` | Show activity stats (7 days) |
| `@gh-pilot stats 30d` | Show stats for period |

## 💻 CLI Commands

```bash
gh-pilot login                              # Device flow login
gh-pilot logout                             # Clear stored credentials
gh-pilot whoami                             # Show logged in user
gh-pilot installations                      # List app installations
gh-pilot work [--repo owner/name]           # Show work items
gh-pilot close owner/repo#123               # Close issue/PR
gh-pilot approve owner/repo#123             # Approve PR
gh-pilot merge owner/repo#123               # Merge PR
gh-pilot review owner/repo#123 "message"    # Request changes
gh-pilot assign owner/repo#123 [username]   # Assign user
gh-pilot comment owner/repo#123 "message"   # Post comment
gh-pilot summarize owner/repo#123           # PR diff summary
gh-pilot tag owner/repo v1.2.3              # Create tag
gh-pilot release owner/repo v1.2.3          # Create release
gh-pilot stats owner/repo [days]            # Activity stats
gh-pilot plugin list                        # List installed plugins
gh-pilot plugin install <path>              # Install a plugin
gh-pilot plugin uninstall <name>            # Uninstall a plugin
gh-pilot plugin info <name>                 # Show plugin details
```

## 📦 Workspaces

- [core](./packages/core/README.md) — `@pilot/core` — Shared library (auth, API clients, commands, storage)
- [cli](./packages/cli/README.md) — `@pilot/cli` — User-facing CLI tool
- [worker](./packages/worker/README.md) — `@pilot/worker` — Webhook server + background jobs
- [plugin-sdk](./packages/plugin-sdk/README.md) — `@pilot/plugin-sdk` — Plugin interface definitions
- [dashboard](./packages/dashboard/README.md) — `@pilot/dashboard` — React web dashboard

## 🔧 GitHub App Setup

1. Create a GitHub App from `github-app.manifest.example.json` or configure one manually with the same permissions and events.
2. Enable **device flow** in the app settings for CLI login (no callback URL needed).
3. Copy `.env.example` to `.env` and fill in the app ID, private key, webhook secret, client ID, optional client secret, and app slug.
4. Install the app on the repositories the bot should manage.

## ⚙️ Configuration

```env
# Release Management
GH_PILOT_AUTO_RELEASE=true
GH_PILOT_DEFAULT_BUMP=patch
GH_PILOT_RELEASE_LABELS=release:patch,release:minor,release:major,release:skip
GH_PILOT_UPDATE_CHANGELOG=true
GH_PILOT_CHANGELOG_PATH=CHANGELOG.md

# PR Automation
GH_PILOT_SIZE_S=10
GH_PILOT_SIZE_M=50
GH_PILOT_SIZE_L=200
GH_PILOT_SIZE_XL=500
GH_PILOT_REVIEW_STRATEGY=round-robin
GH_PILOT_REVIEWERS=user1,user2,user3

# Stale Management
GH_PILOT_STALE_ENABLED=true
GH_PILOT_STALE_DAYS=15
GH_PILOT_STALE_CLOSE_DAYS=7
GH_PILOT_STALE_EXEMPT_LABELS=pinned,security,bug
GH_PILOT_STALE_BEHAVIOR=label-then-close
GH_PILOT_STALE_LABEL=stale

# Issue Triage
GH_PILOT_TRIAGE_RULES=bug:crash|error|exception,feature:request|enhancement

# Discord Notifications
GH_PILOT_DISCORD_WEBHOOK_URL=
GH_PILOT_DISCORD_EVENTS=issue,pull_request,release,stale
GH_PILOT_DISCORD_BATCH_INTERVAL=300
```

## 🐳 Running with Docker Compose

```bash
# Start both webhook server and reconciliation worker
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

The webhook server listens on port 3131 by default. Configure the GitHub App webhook URL to point to `https://your-host/github/webhook`.

SQLite data is persisted in a Docker volume (`pilot-data`).

## 🏃 Running Locally

```bash
bun install
bun run build

# Webhook server
cd packages/worker
bun run webhook

# Reconciliation worker (cron)
cd packages/worker
bun run dev

# Dashboard (development)
bun run dev:dashboard
```

Use a tunnel such as ngrok for local webhook testing and point the app webhook URL to `/github/webhook`.

## 📄 License

This project is Open Sourced and powered by [MIT](./LICENSE) License.

## 🙏 Acknowledgements

- [The Main Character Art](https://www.pixiv.net/en/artworks/146856884) - by [最速のゆっくり](https://www.pixiv.net/en/users/12244076)
- [UwU Face Art](https://www.magnific.com/premium-psd/kawaii-face-expression_94532993.htm) - by [freepik](https://www.magnific.com/author/freepik)
