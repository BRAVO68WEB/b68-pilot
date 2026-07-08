# worker

Runs the GitHub App webhook server and background reconciliation jobs.

## Webhook Server

HTTP server that receives GitHub App webhook events. It verifies signatures,
mints installation access tokens, stores work items, and handles bot mention
commands.

```bash
bun run webhook
```

Env:

- `GH_PILOT_GITHUB_APP_ID`
- `GH_PILOT_GITHUB_APP_PRIVATE_KEY`
- `GH_PILOT_GITHUB_WEBHOOK_SECRET`
- `GH_PILOT_GITHUB_CLIENT_ID`
- `GH_PILOT_GITHUB_APP_SLUG`
- `GH_PILOT_DB_PATH` optional, defaults to `.data/gh-pilot.sqlite`
- `GH_PILOT_WEBHOOK_PORT` optional, defaults to `3131`

Configure the GitHub App webhook URL as:

```text
https://your-host/github/webhook
```

Supported commands:

```text
@<app-slug> close
@<app-slug> approve
@<app-slug> merge
@<app-slug> summarize
@<app-slug> status
```

`summarize` is currently acknowledged but not implemented.
