// packages/core/lib/rules/schema.ts
// Rule schema definitions (Mergify-style)

export interface Rule {
  name: string
  description?: string
  event: string              // 'pull_request.opened', 'issues.opened', etc.
  conditions: Condition[]
  actions: Action[]
  enabled: boolean
  priority?: number          // Higher = evaluated first
}

export interface Condition {
  attribute: string          // 'title', 'body', 'author', 'labels', 'files', 'base'
  operator: Operator
  value: string | number | boolean
  negated?: boolean          // '-' prefix
}

export type Operator = 
  | '=' | ':'           // Equal
  | '!=' | '≠'         // Not equal
  | '~='                // Regex match
  | '*='                // Glob match
  | '>=' | '≥'         // Greater than or equal
  | '<=' | '≤'         // Less than or equal
  | '>'                 // Greater than
  | '<'                 // Less than
  | 'in'                // Value in list
  | 'not_in'            // Value not in list
  | 'contains'          // String contains
  | 'starts_with'       // String starts with
  | 'ends_with'         // String ends with
  | 'empty'             // Value is empty/null
  | 'not_empty'         // Value is not empty/null

export interface Action {
  type: ActionType
  payload: Record<string, unknown>
}

export type ActionType =
  | 'comment'           // Post a comment
  | 'label'             // Add/remove labels
  | 'assign'            // Assign users
  | 'close'             // Close issue/PR
  | 'merge'             // Merge PR
  | 'request_changes'   // Request changes on PR
  | 'lock'              // Lock conversation
  | 'unlock'            // Unlock conversation
  | 'pin'               // Pin issue
  | 'unpin'             // Unpin issue
  | 'milestone'         // Set milestone
  | 'project'           // Add to project
  | 'dispatch'          // Trigger repository dispatch
  | 'webhook'           // Call external webhook
  | 'custom'            // Custom plugin action

export interface RuleConfig {
  rules: Rule[]
  defaults?: {
    actions?: Partial<Record<ActionType, Record<string, unknown>>>
  }
}

// Default rule configuration
export const DEFAULT_RULE_CONFIG: RuleConfig = {
  rules: [],
  defaults: {
    actions: {
      comment: {
        bot_account: 'gh-pilot',
      },
    },
  },
}
