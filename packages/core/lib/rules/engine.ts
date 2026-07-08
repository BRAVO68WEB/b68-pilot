// packages/core/lib/rules/engine.ts
// Rule evaluation engine (Mergify-style)

import type { Rule, Condition, Operator, Action } from './schema'

export interface WebhookPayload {
  event: string
  action: string
  payload: Record<string, unknown>
  repository?: { full_name: string }
  sender?: { login: string }
  issue?: { number: number; title: string; body: string; labels: Array<{ name: string }> }
  pull_request?: { number: number; title: string; body: string; labels: Array<{ name: string }> }
}

export interface RuleMatchResult {
  rule: Rule
  matched: boolean
  conditions: Array<{ condition: Condition; result: boolean }>
}

/**
 * Evaluate a single condition against a payload
 */
export function evaluateCondition(condition: Condition, payload: WebhookPayload): boolean {
  const fieldValue = extractAttribute(payload, condition.attribute)
  let result = false

  switch (condition.operator) {
    case '=':
    case ':':
      result = String(fieldValue) === String(condition.value)
      break
    case '!=':
    case '≠':
      result = String(fieldValue) !== String(condition.value)
      break
    case '~=':
      try {
        result = new RegExp(String(condition.value)).test(String(fieldValue))
      } catch {
        result = false
      }
      break
    case '*=':
      // Simple glob match (convert to regex)
      try {
        const globRegex = String(condition.value)
          .replace(/\*/g, '.*')
          .replace(/\?/g, '.')
        result = new RegExp(`^${globRegex}$`).test(String(fieldValue))
      } catch {
        result = false
      }
      break
    case '>=':
    case '≥':
      result = Number(fieldValue) >= Number(condition.value)
      break
    case '<=':
    case '≤':
      result = Number(fieldValue) <= Number(condition.value)
      break
    case '>':
      result = Number(fieldValue) > Number(condition.value)
      break
    case 'in':
      result = Array.isArray(condition.value) && condition.value.includes(fieldValue)
      break
    case 'not_in':
      result = Array.isArray(condition.value) && !condition.value.includes(fieldValue)
      break
    case 'contains':
      result = String(fieldValue).includes(String(condition.value))
      break
    case 'starts_with':
      result = String(fieldValue).startsWith(String(condition.value))
      break
    case 'ends_with':
      result = String(fieldValue).endsWith(String(condition.value))
      break
    case 'empty':
      result = !fieldValue || String(fieldValue).trim() === ''
      break
    case 'not_empty':
      result = !!fieldValue && String(fieldValue).trim() !== ''
      break
    case '<':
      result = Number(fieldValue) < Number(condition.value)
      break
  }

  return condition.negated ? !result : result
}

/**
 * Evaluate all conditions in a rule (AND logic)
 */
export function evaluateRule(rule: Rule, payload: WebhookPayload): RuleMatchResult {
  const conditionResults = rule.conditions.map(condition => ({
    condition,
    result: evaluateCondition(condition, payload),
  }))

  const matched = conditionResults.every(r => r.result)

  return {
    rule,
    matched,
    conditions: conditionResults,
  }
}

/**
 * Evaluate all rules against a payload, return matching rules
 */
export function evaluateRules(rules: Rule[], payload: WebhookPayload): RuleMatchResult[] {
  return rules
    .filter(rule => rule.enabled)
    .filter(rule => {
      // Match event type (e.g., 'issues.opened' matches event='issues', action='opened')
      const [eventPart, actionPart] = rule.event.split('.')
      if (eventPart && eventPart !== payload.event) return false
      if (actionPart && actionPart !== payload.action) return false
      return true
    })
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    .map(rule => evaluateRule(rule, payload))
    .filter(result => result.matched)
}

/**
 * Extract attribute value from payload
 */
function extractAttribute(payload: WebhookPayload, attribute: string): unknown {
  const issue = payload.issue ?? payload.pull_request
  
  switch (attribute) {
    case 'title':
      return issue?.title ?? ''
    case 'body':
      return issue?.body ?? ''
    case 'author':
      return payload.sender?.login ?? ''
    case 'labels':
      return issue?.labels?.map(l => l.name) ?? []
    case 'number':
      return issue?.number ?? 0
    case 'event':
      return payload.event
    case 'action':
      return payload.action
    case 'repo':
      return payload.repository?.full_name ?? ''
    default:
      // Support nested attributes like 'pull_request.title'
      const parts = attribute.split('.')
      let value: any = payload
      for (const part of parts) {
        value = value?.[part]
      }
      return value
  }
}
