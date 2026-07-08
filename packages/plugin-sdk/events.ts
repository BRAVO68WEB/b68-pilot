/**
 * Event types used in plugin lifecycle hooks.
 */

/** Incoming webhook event (raw payload) */
export interface WebhookEvent {
  /** GitHub event type (e.g., 'pull_request', 'issues', 'issue_comment') */
  event: string

  /** Action within the event (e.g., 'opened', 'closed', 'created') */
  action: string

  /** Raw webhook payload */
  payload: Record<string, unknown>

  /** Installation ID */
  installationId: number

  /** Repository full name (owner/name) */
  repo: string

  /** Delivery ID for deduplication */
  deliveryId: string

  /** ISO timestamp */
  receivedAt: string
}

/** Trigger event — enriched with parsed context for plugin convenience */
export interface TriggerEvent extends WebhookEvent {
  /** Parsed issue/PR number (if applicable) */
  issueNumber?: number

  /** Whether this is a pull request */
  isPullRequest?: boolean

  /** Sender login */
  sender?: string

  /** Parsed labels */
  labels?: string[]

  /** PR title (if applicable) */
  title?: string

  /** PR body / issue body */
  body?: string
}

/** Result returned by onTrigger hooks */
export interface TriggerResult {
  /** If true, this plugin handled the event — later plugins are skipped */
  handled: boolean

  /** Message to post as a comment (optional) */
  message?: string

  /** Actions to execute (comment, label, assign, etc.) */
  actions?: ActionExecution[]

  /** Structured data for logging/audit */
  data?: Record<string, unknown>
}

/** An action to execute on behalf of the plugin */
export interface ActionExecution {
  type: 'comment' | 'label' | 'assign' | 'unassign' | 'merge' | 'close' | 'request_changes'
  payload: Record<string, unknown>
}
