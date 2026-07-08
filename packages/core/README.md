# core

GitHub App auth, API clients, command parsing, webhook utilities, and work-item
storage for gh-pilot.

## Auth Modes

- App JWT: list installations and mint installation tokens.
- Installation token: perform bot actions in installed repositories.
- User token: CLI login and user-attributed commands.

The `/notifications` API is not used by the GitHub App flow. Work items come
from webhooks, GitHub search queries, and repository issue/PR APIs.

## Install

```bash
bun install
```
