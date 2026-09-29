import { describe, expect, it } from 'vitest'
import { deterministicNaturalCompare, stableNaturalSort } from './naturalSort'

describe('Deterministic Natural Sort', () => {
  it('sorts numeric chunks numerically (2 before 10)', () => {
    const list = ['SKU-10.jpg', 'SKU-2.jpg', 'SKU-1.jpg', 'SKU-20.jpg']
    const sorted = [...list].sort(deterministicNaturalCompare)
    expect(sorted).toEqual(['SKU-1.jpg', 'SKU-2.jpg', 'SKU-10.jpg', 'SKU-20.jpg'])
  })

  it('orders nested paths correctly and stably', () => {
    const paths = [
      'shoes/img-10.jpg',
      'shoes/img-1.jpg',
      'shoes/img-2.jpg',
      'boots/img-1.jpg',
    ]
    const sorted = [...paths].sort(deterministicNaturalCompare)
    expect(sorted).toEqual([
      'boots/img-1.jpg',
      'shoes/img-1.jpg',
      'shoes/img-2.jpg',
      'shoes/img-10.jpg',
    ])
  })

  it('tie-breaks leading zeroes deterministically', () => {
    const list = ['file-02.png', 'file-2.png']
    const sorted = [...list].sort(deterministicNaturalCompare)
    expect(sorted).toEqual(['file-2.png', 'file-02.png'])
  })

  it('produces identical order across repeated runs', () => {
    const input = [
      'Supplier/Photos/ABC-10-front.jpg',
      'Supplier/Photos/ABC-2-back.jpg',
      'Supplier/Photos/ABC-1-front.jpg',
      'Supplier/Photos/ABC-2-front.jpg',
    ]

    const run1 = stableNaturalSort(input, (x) => x)
    const run2 = stableNaturalSort(input, (x) => x)
    expect(run1).toEqual(run2)
    expect(run1).toEqual([
      'Supplier/Photos/ABC-1-front.jpg',
      'Supplier/Photos/ABC-2-back.jpg',
      'Supplier/Photos/ABC-2-front.jpg',
      'Supplier/Photos/ABC-10-front.jpg',
    ])
  })
})
