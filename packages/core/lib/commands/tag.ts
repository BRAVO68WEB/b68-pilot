import type { GitHubInstallationClient } from '../github/installation-client'

const SEMVER_REGEX = /^v?(\d+)\.(\d+)\.(\d+)$/

export function incrementVersion(current: string, bump: 'major' | 'minor' | 'patch'): string {
    const match = SEMVER_REGEX.exec(current)
    if (!match) return 'v0.1.0'

    let [, major, minor, patch] = match.map(Number)

    switch (bump) {
        case 'major': major++; minor = 0; patch = 0; break
        case 'minor': minor++; patch = 0; break
        case 'patch': patch++; break
    }

    return `v${major}.${minor}.${patch}`
}

export async function createTag(
    gh: GitHubInstallationClient,
    owner: string,
    repo: string,
    tagName: string,
    sha: string
): Promise<void> {
    const tag = tagName.startsWith('v') ? tagName : `v${tagName}`

    await gh.createRef(owner, repo, `refs/tags/${tag}`, sha)
}

export async function getNextVersion(
    gh: GitHubInstallationClient,
    owner: string,
    repo: string,
    bump: 'major' | 'minor' | 'patch'
): Promise<string> {
    const latestTag = await gh.getLatestTag(owner, repo)

    if (!latestTag) {
        return 'v0.1.0'
    }

    return incrementVersion(latestTag.name, bump)
}

export async function tagLatestCommit(
    gh: GitHubInstallationClient,
    owner: string,
    repo: string,
    tagName: string
): Promise<string> {
    const tag = tagName.startsWith('v') ? tagName : `v${tagName}`

    // Get the latest commit on the default branch
    const branch = await gh.get<{ commit: { sha: string } }>(`/repos/${owner}/${repo}/branches/main`)
    const sha = branch.commit.sha

    // Create the tag reference
    await gh.createRef(owner, repo, `refs/tags/${tag}`, sha)

    return tag
}
