import type { RepoConfig, WorkItem } from '../types'

const BASE_URL = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include', // Include cookies for auth
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (res.status === 401) {
    // Redirect to login on unauthorized
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(error.error ?? res.statusText)
  }

  return res.json()
}

// ─── Repos ──────────────────────────────────────────────────────────────

export function listRepos(): Promise<Array<{ repo: string; config: RepoConfig; updatedAt: string }>> {
  return request('/repos')
}

export function getRepoConfig(owner: string, repo: string): Promise<RepoConfig> {
  return request(`/repos/${owner}/${repo}`)
}

export function updateRepoConfig(owner: string, repo: string, config: RepoConfig): Promise<void> {
  return request(`/repos/${owner}/${repo}`, {
    method: 'PUT',
    body: JSON.stringify(config),
  })
}

export function deleteRepoConfig(owner: string, repo: string): Promise<void> {
  return request(`/repos/${owner}/${repo}`, { method: 'DELETE' })
}

// ─── Rules ──────────────────────────────────────────────────────────────

export function listRules(owner: string, repo: string): Promise<RepoConfig['rules']> {
  return request(`/repos/${owner}/${repo}/rules`)
}

export function createRule(owner: string, repo: string, rule: RepoConfig['rules'][0]): Promise<{ id: string }> {
  return request(`/repos/${owner}/${repo}/rules`, {
    method: 'POST',
    body: JSON.stringify(rule),
  })
}

export function updateRule(owner: string, repo: string, ruleId: string, updates: Partial<RepoConfig['rules'][0]>): Promise<void> {
  return request(`/repos/${owner}/${repo}/rules/${ruleId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  })
}

export function deleteRule(owner: string, repo: string, ruleId: string): Promise<void> {
  return request(`/repos/${owner}/${repo}/rules/${ruleId}`, { method: 'DELETE' })
}

// ─── Plugins ────────────────────────────────────────────────────────────

export function listPlugins(): Promise<Array<{ name: string; version: string; description?: string }>> {
  return request('/plugins')
}

export function enablePlugin(pluginName: string, owner: string, repo: string): Promise<void> {
  return request(`/plugins/${pluginName}/enable`, {
    method: 'POST',
    body: JSON.stringify({ owner, repo }),
  })
}

export function disablePlugin(pluginName: string, owner: string, repo: string): Promise<void> {
  return request(`/plugins/${pluginName}/disable`, {
    method: 'POST',
    body: JSON.stringify({ owner, repo }),
  })
}

export function getPluginConfig(pluginName: string, owner: string, repo: string): Promise<{ name: string; enabled: boolean; settings: Record<string, unknown> }> {
  return request(`/plugins/${pluginName}/config?owner=${owner}&repo=${repo}`)
}

export function updatePluginConfig(pluginName: string, owner: string, repo: string, settings: Record<string, unknown>): Promise<void> {
  return request(`/plugins/${pluginName}/config`, {
    method: 'PUT',
    body: JSON.stringify({ owner, repo, settings }),
  })
}

// ─── Commands ───────────────────────────────────────────────────────────

export function listCommands(): Promise<Array<{ name: string; description: string; pluginName: string; enabled: boolean }>> {
  return request('/commands')
}

// ─── Activity ───────────────────────────────────────────────────────────

export function getActivity(limit = 50): Promise<WorkItem[]> {
  return request(`/activity?limit=${limit}`)
}

// ─── Stats ──────────────────────────────────────────────────────────────

export function getStats(): Promise<{
  total: number
  last7Days: number
  last30Days: number
  byType: { issues: number; pullRequests: number; checkFailures: number }
}> {
  return request('/stats')
}
