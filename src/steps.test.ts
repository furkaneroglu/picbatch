import { describe, expect, it } from 'vitest'
import { WORKFLOW_STEPS, getStepByIndex, getTotalStepCount } from './steps'

describe('Workflow Steps Configuration', () => {
  it('configures exactly 6 sequential workflow steps', () => {
    expect(getTotalStepCount()).toBe(6)
  })

  it('contains the expected 6 workflow step identifiers in order', () => {
    const stepIds = WORKFLOW_STEPS.map((s) => s.id)
    expect(stepIds).toEqual([
      'product-file',
      'column-mapping',
      'images',
      'match-review',
      'processing',
      'export',
    ])
  })

  it('retrieves steps by valid index and returns undefined for out-of-range index', () => {
    expect(getStepByIndex(0)?.id).toBe('product-file')
    expect(getStepByIndex(5)?.id).toBe('export')
    expect(getStepByIndex(6)).toBeUndefined()
    expect(getStepByIndex(-1)).toBeUndefined()
  })
})
