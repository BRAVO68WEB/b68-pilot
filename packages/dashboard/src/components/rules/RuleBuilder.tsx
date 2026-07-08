// packages/dashboard/src/components/rules/RuleBuilder.tsx
// Visual rule builder UI

import { useState } from 'react'

interface Rule {
  name: string
  description?: string
  event: string
  conditions: Array<{
    attribute: string
    operator: string
    value: string
    negated?: boolean
  }>
  actions: Array<{
    type: string
    payload: Record<string, unknown>
  }>
  enabled: boolean
}

const EVENTS = [
  'issues.opened',
  'issues.closed',
  'pull_request.opened',
  'pull_request.closed',
  'pull_request.synchronize',
  'issue_comment.created',
  'pull_request_review.submitted',
]

const ATTRIBUTES = [
  { value: 'title', label: 'Title' },
  { value: 'body', label: 'Body' },
  { value: 'author', label: 'Author' },
  { value: 'labels', label: 'Labels' },
  { value: 'number', label: 'Number' },
]

const OPERATORS = [
  { value: '=', label: 'equals' },
  { value: '!=', label: 'not equals' },
  { value: '~=', label: 'matches (regex)' },
  { value: '*=', label: 'matches (glob)' },
  { value: '>=', label: 'greater than or equal' },
  { value: '<=', label: 'less than or equal' },
]

const ACTION_TYPES = [
  { value: 'comment', label: 'Comment' },
  { value: 'label', label: 'Label' },
  { value: 'assign', label: 'Assign' },
  { value: 'close', label: 'Close' },
  { value: 'merge', label: 'Merge' },
  { value: 'request_changes', label: 'Request Changes' },
]

export default function RuleBuilder({ onSave }: { onSave: (rule: Rule) => void }) {
  const [rule, setRule] = useState<Rule>({
    name: '',
    description: '',
    event: 'issues.opened',
    conditions: [{ attribute: 'title', operator: '~=', value: '', negated: false }],
    actions: [{ type: 'comment', payload: { body: '' } }],
    enabled: true,
  })

  function addCondition() {
    setRule(r => ({
      ...r,
      conditions: [...r.conditions, { attribute: 'title', operator: '=', value: '', negated: false }],
    }))
  }

  function removeCondition(index: number) {
    setRule(r => ({
      ...r,
      conditions: r.conditions.filter((_, i) => i !== index),
    }))
  }

  function addAction() {
    setRule(r => ({
      ...r,
      actions: [...r.actions, { type: 'comment', payload: { body: '' } }],
    }))
  }

  function removeAction(index: number) {
    setRule(r => ({
      ...r,
      actions: r.actions.filter((_, i) => i !== index),
    }))
  }

  function handleSave() {
    if (!rule.name) {
      alert('Rule name is required')
      return
    }
    onSave(rule)
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-6">Create Rule</h2>

      {/* Rule Name */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input
          type="text"
          value={rule.name}
          onChange={e => setRule(r => ({ ...r, name: e.target.value }))}
          placeholder="Auto-label bug reports"
          className="border rounded px-3 py-2 w-full"
        />
      </div>

      {/* Event */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Event</label>
        <select
          value={rule.event}
          onChange={e => setRule(r => ({ ...r, event: e.target.value }))}
          className="border rounded px-3 py-2 w-full"
        >
          {EVENTS.map(event => (
            <option key={event} value={event}>{event}</option>
          ))}
        </select>
      </div>

      {/* Conditions */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium text-gray-700">Conditions</label>
          <button onClick={addCondition} className="text-sm text-blue-600 hover:underline">
            + Add Condition
          </button>
        </div>
        
        {rule.conditions.map((condition, index) => (
          <div key={index} className="flex gap-2 mb-2 items-center">
            {condition.negated && <span className="text-red-500 font-mono">-</span>}
            <select
              value={condition.attribute}
              onChange={e => {
                const newConditions = [...rule.conditions]
                newConditions[index].attribute = e.target.value
                setRule(r => ({ ...r, conditions: newConditions }))
              }}
              className="border rounded px-2 py-1 text-sm"
            >
              {ATTRIBUTES.map(attr => (
                <option key={attr.value} value={attr.value}>{attr.label}</option>
              ))}
            </select>
            <select
              value={condition.operator}
              onChange={e => {
                const newConditions = [...rule.conditions]
                newConditions[index].operator = e.target.value
                setRule(r => ({ ...r, conditions: newConditions }))
              }}
              className="border rounded px-2 py-1 text-sm"
            >
              {OPERATORS.map(op => (
                <option key={op.value} value={op.value}>{op.label}</option>
              ))}
            </select>
            <input
              type="text"
              value={String(condition.value)}
              onChange={e => {
                const newConditions = [...rule.conditions]
                newConditions[index].value = e.target.value
                setRule(r => ({ ...r, conditions: newConditions }))
              }}
              placeholder="value"
              className="border rounded px-2 py-1 text-sm flex-1"
            />
            <button
              onClick={() => removeCondition(index)}
              className="text-red-500 hover:text-red-700 text-sm"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium text-gray-700">Actions</label>
          <button onClick={addAction} className="text-sm text-blue-600 hover:underline">
            + Add Action
          </button>
        </div>
        
        {rule.actions.map((action, index) => (
          <div key={index} className="flex gap-2 mb-2 items-center">
            <select
              value={action.type}
              onChange={e => {
                const newActions = [...rule.actions]
                newActions[index].type = e.target.value
                setRule(r => ({ ...r, actions: newActions }))
              }}
              className="border rounded px-2 py-1 text-sm"
            >
              {ACTION_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
            <input
              type="text"
              value={JSON.stringify(action.payload)}
              onChange={e => {
                const newActions = [...rule.actions]
                try {
                  newActions[index].payload = JSON.parse(e.target.value)
                } catch {
                  // Invalid JSON, keep old value
                }
                setRule(r => ({ ...r, actions: newActions }))
              }}
              placeholder='{"body": "Thanks!"}'
              className="border rounded px-2 py-1 text-sm flex-1 font-mono"
            />
            <button
              onClick={() => removeAction(index)}
              className="text-red-500 hover:text-red-700 text-sm"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Save Rule
        </button>
      </div>
    </div>
  )
}
