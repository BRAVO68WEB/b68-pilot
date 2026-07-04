# cli

CLI for GitHub App user login, installation inspection, work-item discovery,
and manual issue/PR actions.

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

Commands:

```bash
bun run index.ts login
bun run index.ts whoami
bun run index.ts installations
bun run index.ts work
bun run index.ts work --repo owner/name
bun run index.ts close owner/repo#123
bun run index.ts approve owner/repo#123
bun run index.ts merge owner/repo#123
```

CLI tokens are stored at `~/.config/b68-pilot/config.json` with `0600`
permissions.
