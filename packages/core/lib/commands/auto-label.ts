import type { GitHubInstallationClient } from '../github/installation-client'

interface LabelerConfig {
    [label: string]: string[]
}

const CONVENTIONAL_COMMIT_LABELS: Record<string, string> = {
    'feat:': 'feature',
    'fix:': 'bugfix',
    'docs:': 'documentation',
    'chore:': 'maintenance',
    'refactor:': 'refactoring',
    'test:': 'tests',
    'ci:': 'ci',
    'perf:': 'performance',
}

export async function autoLabel(
    gh: GitHubInstallationClient,
    owner: string,
    repo: string,
    prNumber: number,
    prTitle: string,
    files: Array<{ filename: string; additions: number; deletions: number }>
): Promise<string[]> {
    const labels: string[] = []

    // File pattern labels
    try {
        const config = await loadLabelerConfig(gh, owner, repo)
        for (const [label, patterns] of Object.entries(config)) {
            if (files.some(f => matchesPatterns(f.filename, patterns))) {
                labels.push(label)
            }
        }
    } catch {
        // Config file not found, skip file pattern labels
    }

    // Size labels
    const totalChanges = files.reduce((sum, f) => sum + f.additions + f.deletions, 0)
    const sizeS = parseInt(Bun.env.GH_PILOT_SIZE_S ?? '10')
    const sizeM = parseInt(Bun.env.GH_PILOT_SIZE_M ?? '50')
    const sizeL = parseInt(Bun.env.GH_PILOT_SIZE_L ?? '200')

    if (totalChanges <= sizeS) labels.push('size/S')
    else if (totalChanges <= sizeM) labels.push('size/M')
    else if (totalChanges <= sizeL) labels.push('size/L')
    else labels.push('size/XL')

    // Conventional commit labels
    const titleLower = prTitle.toLowerCase()
    for (const [prefix, label] of Object.entries(CONVENTIONAL_COMMIT_LABELS)) {
        if (titleLower.startsWith(prefix)) {
            labels.push(label)
            break
        }
    }

    // Apply labels
    const uniqueLabels = [...new Set(labels)]
    if (uniqueLabels.length > 0) {
        await gh.addLabels(owner, repo, prNumber, uniqueLabels)
    }

    return uniqueLabels
}

async function loadLabelerConfig(
    gh: GitHubInstallationClient,
    owner: string,
    repo: string
): Promise<LabelerConfig> {
    const file = await gh.getFileContent(owner, repo, '.github/labeler.yml')
    if (!file) return {}

    const content = Buffer.from(file.content, 'base64').toString('utf-8')

    // Simple YAML parser for labeler config
    const config: LabelerConfig = {}
    let currentLabel: string | null = null

    for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue

        // Label line (e.g., "typescript:")
        if (!trimmed.startsWith('-') && trimmed.endsWith(':')) {
            currentLabel = trimmed.slice(0, -1)
            config[currentLabel] = []
            continue
        }

        // Pattern line (e.g., "  - '**/*.ts'")
        if (currentLabel && trimmed.startsWith('-')) {
            const pattern = trimmed.slice(1).trim().replace(/^['"]|['"]$/g, '')
            config[currentLabel].push(pattern)
        }
    }

    return config
}

function matchesPatterns(filename: string, patterns: string[]): boolean {
    return patterns.some(pattern => {
        // Convert glob pattern to regex
        const regex = pattern
            .replace(/\*\*/g, '.*')
            .replace(/\*/g, '[^/]*')
            .replace(/\?/g, '[^/]')
            .replace(/\./g, '\\.')

        return new RegExp(`^${regex}$`).test(filename)
    })
}

export async function loadLabelerConfigFromEnv(): Promise<LabelerConfig> {
    const rules = Bun.env.GH_PILOT_LABELER_RULES
    if (!rules) return {}

    const config: LabelerConfig = {}
    const pairs = rules.split(';')

    for (const pair of pairs) {
        const [label, patterns] = pair.split(':')
        if (label && patterns) {
            config[label.trim()] = patterns.split(',').map(p => p.trim())
        }
    }

    return config
}
