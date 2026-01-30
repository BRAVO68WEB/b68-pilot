# core

GitHub API client and webhook utilities for b68-pilot.

## Notifications: polling vs webhooks

- **Polling** (worker cron): calls `GET /notifications` every 5 minutes. Simple, no public URL, but delayed and uses more API calls.
- **Webhooks** (recommended): GitHub sends `issue_comment` events to your server when someone comments. Instant, fewer API calls. Requires a public URL and a webhook secret. Use the worker’s webhook server: `bun run webhook` in the worker package.

## Install

```bash
bun install
```
