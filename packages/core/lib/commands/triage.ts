import type { GitHubInstallationClient } from '../github/installation-client'

export interface TriageRule {
    label: string
    keywords: string[]
}

export function getTriageRules(): TriageRule[] {
    const rules = Bun.env.GH_PILOT_TRIAGE_RULES ?? 'bug:crash|error|exception,feature:request|enhancement,docs:typo|documentation'

    return rules.split(',').map(rule => {
        const [label, keywordsStr] = rule.split(':')
        return {
            label: label.trim(),
            keywords: keywordsStr?.split('|').map(k => k.trim()) ?? []
        }
    }).filter(r => r.label && r.keywords.length > 0)
}

export async function triageIssue(
    gh: GitHubInstallationClient,
    owner: string,
    repo: string,
    issueNumber: number,
    issueTitle: string,
    issueBody: string
): Promise<string[]> {
    const rules = getTriageRules()
    const labels: string[] = []

    const text = `${issueTitle} ${issueBody}`.toLowerCase()

    for (const rule of rules) {
        if (rule.keywords.some(keyword => text.includes(keyword))) {
            labels.push(rule.label)
        }
    }

    if (labels.length > 0) {
        await gh.addLabels(owner, repo, issueNumber, [...new Set(labels)])
    }

    return labels
}
