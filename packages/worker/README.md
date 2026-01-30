# worker

Runs @b68web mention commands (close issue/pr, merge pr, approve pr) via **polling** (cron) or **webhooks**.

## Modes

### 1. Polling (cron, default)

Runs every 5 minutes and checks GitHub notifications.

```bash
bun run index.ts
# or: bun run dev
```

Env: `B68_GH_TOKEN` (required).

### 2. Webhooks (recommended)

HTTP server that receives GitHub `issue_comment` events. Instant, no polling.

```bash
bun run webhook
```

Env: `B68_GH_TOKEN`, `B68_WEBHOOK_SECRET` (required for verification), `B68_WEBHOOK_PORT` (default 3131).

In the repo: **Settings → Webhooks → Add webhook**  
- Payload URL: `https://your-host/webhook` (use ngrok for local dev)  
- Content type: `application/json`  
- Secret: same as `B68_WEBHOOK_SECRET`  
- Events: **Issue comments**
