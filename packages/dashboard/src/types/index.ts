export interface RepoConfig {
  repo: string
  enabled: boolean
  plugins: PluginConfig[]
  rules: RuleConfig[]
  commands: CommandConfig[]
  notifications: NotificationConfig
  automation: AutomationConfig
}

export interface PluginConfig {
  name: string
  enabled: boolean
  settings: Record<string, unknown>
}

export interface RuleConfig {
  id: string
  name: string
  event: string
  conditions: Condition[]
  actions: Action[]
  enabled: boolean
}

export interface Condition {
  field: string
  operator: 'equals' | 'not_equals' | 'contains' | 'matches' | 'gt' | 'lt' | 'in' | 'exists'
  value: unknown
}

export interface Action {
  type: 'comment' | 'label' | 'assign' | 'merge' | 'close' | 'request_changes' | 'custom'
  payload: Record<string, unknown>
}

export interface CommandConfig {
  name: string
  enabled: boolean
  allowedRoles?: string[]
}

export interface NotificationConfig {
  discord?: {
    webhookUrl: string
    events: string[]
  }
  slack?: {
    webhookUrl: string
    events: string[]
  }
}

export interface AutomationConfig {
  autoRelease: boolean
  defaultBump: 'major' | 'minor' | 'patch'
  staleDays: number
  staleCloseDays: number
  reviewStrategy: 'round-robin' | 'load-balanced' | 'codeowners'
  reviewers: string[]
}

export interface WorkItem {
  id: string
  source: string
  owner: string
  repo: string
  type: 'issue' | 'pull_request' | 'check_failure'
  number: number
  title: string
  url: string
  reason: string
  actor?: string
  assignees: string[]
  requestedReviewers: string[]
  state: string
  updatedAt: string
}
