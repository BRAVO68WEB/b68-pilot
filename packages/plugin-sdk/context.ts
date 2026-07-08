/**
 * Plugin execution context — provided to every lifecycle hook.
 * Plugins use this to interact with GitHub and persist data.
 */
export interface PluginContext {
  /** GitHub API client scoped to the current installation */
  github: PluginGitHubClient

  /** Plugin-scoped key-value store */
  store: PluginDataStore

  /** Per-repo configuration */
  config: RepoConfig

  /** Structured logger (prefixed with plugin name) */
  logger: PluginLogger

  /** Current installation ID */
  installationId: number

  /** Current repo (owner/name) */
  repo: string
}

/** Minimal GitHub client interface exposed to plugins */
export interface PluginGitHubClient {
  // Issues
  comment(owner: string, repo: string, issueNumber: number, body: string): Promise<void>
  closeIssue(owner: string, repo: string, issueNumber: number): Promise<void>
  getIssue(owner: string, repo: string, issueNumber: number): Promise<IssueInfo>

  // Labels
  addLabels(owner: string, repo: string, issueNumber: number, labels: string[]): Promise<void>
  removeLabel(owner: string, repo: string, issueNumber: number, label: string): Promise<void>
  getLabels(owner: string, repo: string, issueNumber: number): Promise<Array<{ name: string }>>

  // Pull Requests
  approvePull(owner: string, repo: string, pullNumber: number, body?: string): Promise<void>
  mergePull(owner: string, repo: string, pullNumber: number): Promise<void>
  requestChanges(owner: string, repo: string, pullNumber: number, body: string): Promise<void>
  getPullFiles(owner: string, repo: string, pullNumber: number): Promise<PullFile[]>

  // Assignees
  assign(owner: string, repo: string, issueNumber: number, users: string[]): Promise<void>
  unassign(owner: string, repo: string, issueNumber: number, users: string[]): Promise<void>

  // Generic request for anything not covered above
  request<T>(method: string, path: string, body?: unknown): Promise<T>
}

/** Plugin-scoped key-value store */
export interface PluginDataStore {
  get<T = unknown>(key: string): Promise<T | null>
  set<T = unknown>(key: string, value: T): Promise<void>
  delete(key: string): Promise<void>
  list(prefix?: string): Promise<Array<{ key: string; value: unknown }>>
}

/** Structured logger */
export interface PluginLogger {
  info(message: string, data?: Record<string, unknown>): void
  warn(message: string, data?: Record<string, unknown>): void
  error(message: string, data?: Record<string, unknown>): void
  debug(message: string, data?: Record<string, unknown>): void
}

/** Per-repo configuration */
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

/** Minimal issue info */
export interface IssueInfo {
  number: number
  title: string
  body: string | null
  state: string
  html_url: string
  user?: { login: string }
  assignees?: Array<{ login: string }>
  labels?: Array<{ name: string }>
  pull_request?: unknown
}

/** PR file diff info */
export interface PullFile {
  filename: string
  additions: number
  deletions: number
  status: string
  patch?: string
}
