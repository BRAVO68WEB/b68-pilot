/**
 * Custom command types for plugin-registered bot commands.
 */

/** A command definition provided by a plugin */
export interface CommandDefinition {
  /** Command name (used as @bot <name>) */
  name: string

  /** Human-readable description */
  description: string

  /** Usage string (e.g., 'review-checklist [template]') */
  usage: string

  /** Aliases (e.g., ['rc', 'checklist']) */
  aliases?: string[]

  /** Whether this command only works on PRs */
  prOnly?: boolean

  /** Required permissions */
  permissions?: string[]

  /** The command handler */
  handler: CommandHandler
}

/** Command handler function signature */
export type CommandHandler = (
  args: string[],
  ctx: CommandContext
) => Promise<CommandResult> | CommandResult

/** Context provided to command handlers */
export interface CommandContext {
  /** GitHub client */
  github: import('./context').PluginGitHubClient

  /** Plugin data store */
  store: import('./context').PluginDataStore

  /** Per-repo config */
  config: import('./context').RepoConfig

  /** Logger */
  logger: import('./context').PluginLogger

  /** Repository owner */
  owner: string

  /** Repository name */
  repo: string

  /** Issue or PR number */
  issueNumber: number

  /** Whether the target is a pull request */
  isPullRequest: boolean

  /** Full comment body that triggered the command */
  commentBody: string

  /** Installation ID */
  installationId: number

  /** User who triggered the command */
  triggeredBy: string
}

/** Result returned by command handlers */
export interface CommandResult {
  /** Message to post as a comment */
  message: string

  /** Whether the bot performed an action (vs. just responded) */
  acted: boolean

  /** Optional structured data for logging */
  data?: Record<string, unknown>
}

/** Command registration entry (internal) */
export interface RegisteredCommand {
  definition: CommandDefinition
  pluginName: string
  enabled: boolean
}
