// packages/core/lib/__tests__/rules/engine.test.ts
// Rule engine tests

import { describe, expect, test } from 'bun:test'
import { evaluateCondition, evaluateRule, evaluateRules } from '../../rules/engine'
import type { Rule, Condition } from '../../rules/schema'

describe('evaluateCondition', () => {
  const payload = {
    event: 'issues',
    action: 'opened',
    payload: {},
    sender: { login: 'testuser' },
    issue: {
      number: 1,
      title: 'Bug: app crashes on startup',
      body: 'Steps to reproduce: ...',
      labels: [{ name: 'bug' }, { name: 'critical' }],
    },
  }

  test('equals operator', () => {
    const condition: Condition = { attribute: 'author', operator: '=', value: 'testuser' }
    expect(evaluateCondition(condition, payload)).toBe(true)
  })

  test('not equals operator', () => {
    const condition: Condition = { attribute: 'author', operator: '!=', value: 'otheruser' }
    expect(evaluateCondition(condition, payload)).toBe(true)
  })

  test('regex match operator', () => {
    const condition: Condition = { attribute: 'title', operator: '~=', value: 'bug|crash' }
    expect(evaluateCondition(condition, payload)).toBe(true)
  })

  test('regex no match', () => {
    const condition: Condition = { attribute: 'title', operator: '~=', value: '^feat' }
    expect(evaluateCondition(condition, payload)).toBe(false)
  })

  test('glob match operator', () => {
    const condition: Condition = { attribute: 'title', operator: '*=', value: 'Bug*' }
    expect(evaluateCondition(condition, payload)).toBe(true)
  })

  test('greater than or equal operator', () => {
    const condition: Condition = { attribute: 'number', operator: '>=', value: 1 }
    expect(evaluateCondition(condition, payload)).toBe(true)
  })

  test('less than operator', () => {
    const condition: Condition = { attribute: 'number', operator: '<', value: 10 }
    expect(evaluateCondition(condition, payload)).toBe(true)
  })

  test('negated condition', () => {
    const condition: Condition = { attribute: 'author', operator: '=', value: 'otheruser', negated: true }
    expect(evaluateCondition(condition, payload)).toBe(true)
  })

  test('labels attribute returns array', () => {
    const condition: Condition = { attribute: 'labels', operator: 'contains', value: 'bug' }
    expect(evaluateCondition(condition, payload)).toBe(true)
  })
})

describe('evaluateRule', () => {
  const payload = {
    event: 'issues',
    action: 'opened',
    payload: {},
    sender: { login: 'testuser' },
    issue: {
      number: 1,
      title: 'Bug: app crashes',
      body: 'Error occurred',
      labels: [{ name: 'bug' }],
    },
  }

  test('rule matches when all conditions pass', () => {
    const rule: Rule = {
      name: 'test-rule',
      event: 'issues.opened',
      conditions: [
        { attribute: 'title', operator: '~=', value: 'bug|crash' },
        { attribute: 'author', operator: '=', value: 'testuser' },
      ],
      actions: [{ type: 'label', payload: { add: ['bug'] } }],
      enabled: true,
    }

    const result = evaluateRule(rule, payload)
    expect(result.matched).toBe(true)
  })

  test('rule fails when any condition fails', () => {
    const rule: Rule = {
      name: 'test-rule',
      event: 'issues.opened',
      conditions: [
        { attribute: 'title', operator: '~=', value: 'bug' },
        { attribute: 'author', operator: '=', value: 'otheruser' },
      ],
      actions: [{ type: 'label', payload: { add: ['bug'] } }],
      enabled: true,
    }

    const result = evaluateRule(rule, payload)
    expect(result.matched).toBe(false)
  })

  test('disabled rules are skipped', () => {
    const rule: Rule = {
      name: 'test-rule',
      event: 'issues.opened',
      conditions: [
        { attribute: 'title', operator: '~=', value: 'bug' },
      ],
      actions: [{ type: 'label', payload: { add: ['bug'] } }],
      enabled: false,
    }

    const results = evaluateRules([rule], payload)
    expect(results).toHaveLength(0)
  })
})

describe('evaluateRules', () => {
  const payload = {
    event: 'issues',
    action: 'opened',
    payload: {},
    sender: { login: 'testuser' },
    issue: {
      number: 1,
      title: 'bug: critical crash',
      body: 'App crashes on startup',
      labels: [{ name: 'bug' }],
    },
  }

  test('returns all matching rules', () => {
    const rules: Rule[] = [
      {
        name: 'bug-label',
        event: 'issues',
        conditions: [{ attribute: 'title', operator: '~=', value: 'bug' }],
        actions: [{ type: 'label', payload: { add: ['bug'] } }],
        enabled: true,
      },
      {
        name: 'critical-label',
        event: 'issues',
        conditions: [{ attribute: 'title', operator: '~=', value: 'critical' }],
        actions: [{ type: 'label', payload: { add: ['critical'] } }],
        enabled: true,
      },
      {
        name: 'feature-label',
        event: 'issues',
        conditions: [{ attribute: 'title', operator: '~=', value: 'feature' }],
        actions: [{ type: 'label', payload: { add: ['feature'] } }],
        enabled: true,
      },
    ]

    const results = evaluateRules(rules, payload)
    expect(results).toHaveLength(2)
    expect(results[0].rule.name).toBe('bug-label')
    expect(results[1].rule.name).toBe('critical-label')
  })

  test('respects priority order', () => {
    const rules: Rule[] = [
      {
        name: 'low-priority',
        event: 'issues',
        conditions: [{ attribute: 'title', operator: '~=', value: 'bug' }],
        actions: [{ type: 'label', payload: { add: ['low'] } }],
        enabled: true,
        priority: 1,
      },
      {
        name: 'high-priority',
        event: 'issues',
        conditions: [{ attribute: 'title', operator: '~=', value: 'bug' }],
        actions: [{ type: 'label', payload: { add: ['high'] } }],
        enabled: true,
        priority: 10,
      },
    ]

    const results = evaluateRules(rules, payload)
    expect(results[0].rule.name).toBe('high-priority')
  })
})
