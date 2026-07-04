# b68-pilot

[@b68web](https://github.com/b68web)'s code to manage his Github Activities.

This repo is migrating from a personal-token notification poller to a GitHub App
bot. The new default model is:

- GitHub App webhooks for installed repositories.
- Installation access tokens for bot actions.
- GitHub App device-flow user tokens for the CLI.
- SQLite for webhook/work-item state.

## Workspaces

Project is organized in workspaces.

### packages

- [core](./packages/core/README.md) - `@pilot/core`
- [cli](./packages/cli/README.md) - `@pilot/cli`
- [worker](./packages/worker/README.md) - `@pilot/worker`

## GitHub App Setup

1. Create a GitHub App from `github-app.manifest.example.json` or configure one
   manually with the same permissions and events.
2. Enable **device flow** in the app settings for CLI login (no callback URL needed).
3. Copy `.env.example` to `.env` and fill in the app ID, private key, webhook
   secret, client ID, optional client secret, and app slug.
4. Install the app on the repositories the bot should manage.

## Running with Docker Compose

```bash
# Start both webhook server and reconciliation worker
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

The webhook server listens on port 3131 by default. Configure the GitHub App
webhook URL to point to `https://your-host/github/webhook`.

SQLite data is persisted in a Docker volume (`pilot-data`).

## Running Locally

```bash
bun install
bun run build

# Webhook server
cd packages/worker
bun run webhook

# Reconciliation worker (cron)
cd packages/worker
bun run dev
```

Use a tunnel such as ngrok for local webhook testing and point the app webhook
URL to `/github/webhook`.

## License

[MIT](./LICENSE)
