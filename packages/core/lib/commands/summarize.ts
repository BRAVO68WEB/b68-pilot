import type { GitHubInstallationClient } from '../github/installation-client'

interface PullRequestFile {
    filename: string
    additions: number
    deletions: number
    status: string
}

interface PullRequestDetail {
    number: number
    title: string
    html_url: string
    state: string
    changed_files: number
    additions: number
    deletions: number
}

export async function summarizePullRequest(
    gh: GitHubInstallationClient,
    owner: string,
    repo: string,
    pullNumber: number
): Promise<string> {
    const [pr, files] = await Promise.all([
        gh.get<PullRequestDetail>(`/repos/${owner}/${repo}/pulls/${pullNumber}`),
        gh.get<PullRequestFile[]>(`/repos/${owner}/${repo}/pulls/${pullNumber}/files`),
    ])

    const lines = [`PR #${pr.number}: ${pr.title}`, '']

    lines.push(`${pr.changed_files} file(s) changed, +${pr.additions} / -${pr.deletions}`)
    lines.push('')

    const byType = new Map<string, { files: number; additions: number; deletions: number }>()
    for (const file of files) {
        const ext = getExtension(file.filename)
        const bucket = byType.get(ext) ?? { files: 0, additions: 0, deletions: 0 }
        bucket.files++
        bucket.additions += file.additions
        bucket.deletions += file.deletions
        byType.set(ext, bucket)
    }

    lines.push('By file type:')
    for (const [ext, stats] of [...byType.entries()].sort((a, b) => b[1].additions - a[1].additions)) {
        lines.push(`  .${ext}: ${stats.files} file(s), +${stats.additions} / -${stats.deletions}`)
    }

    if (files.length > 0) {
        lines.push('')
        lines.push('Changed files:')
        for (const file of files.slice(0, 15)) {
            const prefix = file.status === 'added' ? '+' : file.status === 'removed' ? '-' : '~'
            lines.push(`  ${prefix} ${file.filename} (+${file.additions}/-${file.deletions})`)
        }
        if (files.length > 15) {
            lines.push(`  ... and ${files.length - 15} more`)
        }
    }

    const newFiles = files.filter((f) => f.status === 'added')
    const deletedFiles = files.filter((f) => f.status === 'removed')
    if (newFiles.length > 0 || deletedFiles.length > 0) {
        lines.push('')
        if (newFiles.length > 0) lines.push(`New files: ${newFiles.length}`)
        if (deletedFiles.length > 0) lines.push(`Deleted files: ${deletedFiles.length}`)
    }

    return lines.join('\n')
}

function getExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.')
    if (lastDot === -1) return 'other'
    return filename.slice(lastDot + 1)
}
