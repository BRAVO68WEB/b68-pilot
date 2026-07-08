# PR Checklist Plugin

Auto-posts a review checklist when a PR is opened.

## Installation

```bash
# From local path
gh-pilot plugin install ./examples/plugins/pr-checklist

# Or copy to plugins directory
cp -r examples/plugins/pr-checklist ~/.config/gh-pilot/plugins/
```

## Usage

### Automatic

When a PR is opened, the plugin automatically posts a checklist comment:

```markdown
## Review Checklist

- [ ] Tests pass
- [ ] Docs updated
- [ ] No breaking changes
```

### Manual Command

Use the `checklist` command to post manually:

```
@gh-pilot checklist
```

## Configuration

Customize checklist items in repo config:

```json
{
  "plugins": [
    {
      "name": "pr-checklist",
      "enabled": true,
      "settings": {
        "checklistItems": [
          "Tests pass",
          "Docs updated",
          "No breaking changes",
          "Code reviewed",
          "Performance impact considered"
        ]
      }
    }
  ]
}
```

## Development

### Files

- `plugin.json` - Plugin manifest
- `index.ts` - Plugin implementation

### Hooks

- `onTrigger` - Called on webhook events
- `commands` - Custom bot commands

### Permissions

- `github:comment` - Post comments on PRs
