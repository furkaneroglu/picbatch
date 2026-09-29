import { describe, expect, it } from 'vitest'
import type { ImageInventoryItem } from '../types/image'
import type { MatchingEngineResult, MatchStatus, ProductRecord } from '../types/matching'
import {
  buildReviewRows,
  filterReviewRows,
  formatMatchMethod,
  formatMatchStatus,
  getProblemCounts,
  getReviewStatusCounts,
} from './review'

function createMockImage(relativePath: string, isSupported = true): ImageInventoryItem {
  const normPath = relativePath.replace(/\\/g, '/')
  const lastSlash = normPath.lastIndexOf('/')
  const basename = lastSlash === -1 ? normPath : normPath.slice(lastSlash + 1)
  const lastDot = basename.lastIndexOf('.')
  const stem = lastDot > 0 ? basename.slice(0, lastDot) : basename
  const extension = lastDot > 0 ? basename.slice(lastDot + 1).toLowerCase() : ''

  return {
    id: `img-${normPath}`,
    originalFilename: basename,
    basename,
    stem,
    extension,
    relativePath: normPath,
    fileSize: 2048,
    mimeType: isSupported ? 'image/jpeg' : undefined,
    sourceMethod: 'folder',
    isSupported,
    fileRef: new Blob([]),
  }
}

function createMockProduct(
  rowIndex: number,
  primaryRaw: string,
  status: 'valid' | 'invalid_product_key' | 'duplicate_product_key' = 'valid',
  reason?: string,
): ProductRecord {
  return {
    rowIndex,
    rowNumber: rowIndex + 2,
    sourceRow: { SKU: primaryRaw },
    primaryIdentifierRaw: primaryRaw,
    primaryIdentifierNormalized: primaryRaw.toLowerCase().trim(),
    skuRaw: primaryRaw,
    skuNormalized: primaryRaw.toLowerCase().trim(),
    barcodeRaw: null,
    barcodeNormalized: null,
    currentFilenameRaw: null,
    currentFilenameNormalized: null,
    status,
    reason,
  }
}

function createComprehensiveMockResult(): MatchingEngineResult {
  const matchedProd = createMockProduct(0, 'SKU-001', 'valid')
  const unmatchedProd = createMockProduct(1, 'SKU-ORPHAN', 'valid')
  const invalidProd = createMockProduct(2, '', 'invalid_product_key', 'Blank primary product identifier')
  const dupProd1 = createMockProduct(3, 'SKU-DUP', 'duplicate_product_key', 'Duplicate primary product key: "SKU-DUP"')
  const dupProd2 = createMockProduct(4, 'SKU-DUP', 'duplicate_product_key', 'Duplicate primary product key: "SKU-DUP"')

  const matchedImg = createMockImage('photos/SKU-001-1.jpg', true)
  const unmatchedImg = createMockImage('photos/UNKNOWN-999.jpg', true)
  const ambiguousImg = createMockImage('photos/AMBIGUOUS-5.jpg', true)
  const unsupportedImg = createMockImage('docs/notes.pdf', false)

  const imageResults = [
    {
      item: matchedImg,
      status: 'matched' as const,
      matchMethod: 'sku' as const,
      matchedProductRowIndex: 0,
      matchedProduct: matchedProd,
      primaryIdentifier: 'SKU-001',
      sequenceNumber: 1,
    },
    {
      item: unmatchedImg,
      status: 'unmatched_image' as const,
      matchMethod: 'none' as const,
      matchedProductRowIndex: null,
      primaryIdentifier: null,
      reason: 'No matching product identifier found for image filename',
    },
    {
      item: ambiguousImg,
      status: 'ambiguous_match' as const,
      matchMethod: 'primary_identifier' as const,
      matchedProductRowIndex: null,
      primaryIdentifier: null,
      reason: 'Conflicting matches across SKU and barcode columns',
    },
    {
      item: unsupportedImg,
      status: 'unsupported_file' as const,
      matchMethod: 'none' as const,
      matchedProductRowIndex: null,
      primaryIdentifier: null,
      reason: 'Unsupported file format (.pdf)',
    },
  ]

  const unmatchedProducts = [
    {
      product: unmatchedProd,
      status: 'unmatched_product' as const,
      reason: 'No images matched this product',
    },
  ]

  const invalidProducts = [invalidProd]
  const duplicateProducts = [dupProd1, dupProd2]

  return {
    products: [matchedProd, unmatchedProd, invalidProd, dupProd1, dupProd2],
    imageResults,
    matchedImages: [imageResults[0]!],
    unmatchedImages: [imageResults[1]!],
    ambiguousImages: [imageResults[2]!],
    unmatchedProducts,
    invalidProducts,
    duplicateProducts,
    unsupportedFiles: [imageResults[3]!],
    summary: {
      totalProducts: 5,
      validProducts: 2,
      invalidProducts: 1,
      duplicateProducts: 2,
      totalImages: 4,
      supportedImages: 3,
      unsupportedFiles: 1,
      matchedImages: 1,
      unmatchedImages: 1,
      ambiguousMatches: 1,
      unmatchedProducts: 1,
    },
  }
}

describe('Match Review Logic (src/core/review.ts)', () => {
  describe('buildReviewRows', () => {
    const result = createComprehensiveMockResult()
    const rows = buildReviewRows(result)

    it('1. builds matched image review row with correct metadata', () => {
      const row = rows.find((r) => r.status === 'matched')
      expect(row).toBeDefined()
      expect(row?.rowType).toBe('image')
      expect(row?.sourcePath).toBe('photos/SKU-001-1.jpg')
      expect(row?.filename).toBe('SKU-001-1.jpg')
      expect(row?.productIdentifier).toBe('SKU-001')
      expect(row?.sequenceNumber).toBe(1)
      expect(row?.proposedFilename).toBe('Pending naming step')
      expect(row?.matchMethod).toBe('sku')
      expect(row?.isProblem).toBe(false)
      expect(row?.reason).toBe('—')
    })

    it('2. builds unmatched image row', () => {
      const row = rows.find((r) => r.status === 'unmatched_image')
      expect(row).toBeDefined()
      expect(row?.rowType).toBe('image')
      expect(row?.sourcePath).toBe('photos/UNKNOWN-999.jpg')
      expect(row?.filename).toBe('UNKNOWN-999.jpg')
      expect(row?.productIdentifier).toBe('—')
      expect(row?.sequenceNumber).toBeNull()
      expect(row?.proposedFilename).toBe('—')
      expect(row?.matchMethod).toBe('none')
      expect(row?.isProblem).toBe(true)
      expect(row?.reason).toBe('No matching product identifier found for image filename')
    })

    it('3. builds unmatched product row', () => {
      const row = rows.find((r) => r.status === 'unmatched_product')
      expect(row).toBeDefined()
      expect(row?.rowType).toBe('product')
      expect(row?.sourcePath).toBe('—')
      expect(row?.filename).toBe('—')
      expect(row?.productIdentifier).toBe('SKU-ORPHAN')
      expect(row?.sequenceNumber).toBeNull()
      expect(row?.proposedFilename).toBe('—')
      expect(row?.matchMethod).toBe('none')
      expect(row?.isProblem).toBe(true)
      expect(row?.reason).toBe('No images matched this product')
    })

    it('4. builds invalid product row', () => {
      const row = rows.find((r) => r.status === 'invalid_product_key')
      expect(row).toBeDefined()
      expect(row?.rowType).toBe('product')
      expect(row?.sourcePath).toBe('—')
      expect(row?.filename).toBe('—')
      expect(row?.productIdentifier).toBe('(Blank)')
      expect(row?.sequenceNumber).toBeNull()
      expect(row?.isProblem).toBe(true)
      expect(row?.reason).toBe('Blank primary product identifier')
    })

    it('5. builds duplicate product row', () => {
      const duplicateRows = rows.filter((r) => r.status === 'duplicate_product_key')
      expect(duplicateRows).toHaveLength(2)
      expect(duplicateRows[0]?.rowType).toBe('product')
      expect(duplicateRows[0]?.sourcePath).toBe('—')
      expect(duplicateRows[0]?.productIdentifier).toBe('SKU-DUP')
      expect(duplicateRows[0]?.isProblem).toBe(true)
      expect(duplicateRows[0]?.reason).toContain('Duplicate primary product key: "SKU-DUP"')
    })

    it('6. builds ambiguous image row', () => {
      const row = rows.find((r) => r.status === 'ambiguous_match')
      expect(row).toBeDefined()
      expect(row?.rowType).toBe('image')
      expect(row?.sourcePath).toBe('photos/AMBIGUOUS-5.jpg')
      expect(row?.matchMethod).toBe('primary_identifier')
      expect(row?.isProblem).toBe(true)
      expect(row?.reason).toBe('Conflicting matches across SKU and barcode columns')
    })

    it('7. builds unsupported file row', () => {
      const row = rows.find((r) => r.status === 'unsupported_file')
      expect(row).toBeDefined()
      expect(row?.rowType).toBe('image')
      expect(row?.sourcePath).toBe('docs/notes.pdf')
      expect(row?.filename).toBe('notes.pdf')
      expect(row?.isProblem).toBe(true)
      expect(row?.reason).toBe('Unsupported file format (.pdf)')
    })

    it('10. produces deterministic row ordering and unique IDs across runs', () => {
      const run1 = buildReviewRows(result)
      const run2 = buildReviewRows(result)

      expect(run1.map((r) => r.id)).toEqual(run2.map((r) => r.id))
      expect(run1.map((r) => r.status)).toEqual(run2.map((r) => r.status))
      expect(run1).toEqual(run2)

      // Ensure every ID in the review list is unique
      const ids = run1.map((r) => r.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })
  })

  describe('filterReviewRows', () => {
    const result = createComprehensiveMockResult()
    const rows = buildReviewRows(result)

    it('8. Problems filter excludes matched rows and includes all problem categories', () => {
      const problems = filterReviewRows(rows, 'problems')

      expect(problems.every((r) => r.status !== 'matched')).toBe(true)
      expect(problems.every((r) => r.isProblem)).toBe(true)

      const problemStatuses = new Set(problems.map((r) => r.status))
      expect(problemStatuses).toContain('unmatched_image')
      expect(problemStatuses).toContain('unmatched_product')
      expect(problemStatuses).toContain('invalid_product_key')
      expect(problemStatuses).toContain('duplicate_product_key')
      expect(problemStatuses).toContain('ambiguous_match')
      expect(problemStatuses).toContain('unsupported_file')
      expect(problemStatuses).not.toContain('matched')
    })

    it('9. filters by individual status correctly', () => {
      const unmatchedImgs = filterReviewRows(rows, 'unmatched_image')
      expect(unmatchedImgs).toHaveLength(1)
      expect(unmatchedImgs[0]?.status).toBe('unmatched_image')

      const unmatchedProds = filterReviewRows(rows, 'unmatched_product')
      expect(unmatchedProds).toHaveLength(1)
      expect(unmatchedProds[0]?.status).toBe('unmatched_product')

      const invalidKeys = filterReviewRows(rows, 'invalid_product_key')
      expect(invalidKeys).toHaveLength(1)
      expect(invalidKeys[0]?.status).toBe('invalid_product_key')

      const dups = filterReviewRows(rows, 'duplicate_product_key')
      expect(dups).toHaveLength(2)
      expect(dups.every((r) => r.status === 'duplicate_product_key')).toBe(true)

      const ambiguous = filterReviewRows(rows, 'ambiguous_match')
      expect(ambiguous).toHaveLength(1)
      expect(ambiguous[0]?.status).toBe('ambiguous_match')

      const unsupported = filterReviewRows(rows, 'unsupported_file')
      expect(unsupported).toHaveLength(1)
      expect(unsupported[0]?.status).toBe('unsupported_file')

      const matched = filterReviewRows(rows, 'matched')
      expect(matched).toHaveLength(1)
      expect(matched[0]?.status).toBe('matched')
    })

    it('returns all rows when filter is "all"', () => {
      const allRows = filterReviewRows(rows, 'all')
      expect(allRows).toHaveLength(rows.length)
    })

    it('filters rows with optional search query across path, filename, identifier, and reason', () => {
      // Search by filename
      const searchFile = filterReviewRows(rows, 'all', 'notes.pdf')
      expect(searchFile).toHaveLength(1)
      expect(searchFile[0]?.filename).toBe('notes.pdf')

      // Search by product identifier
      const searchId = filterReviewRows(rows, 'all', 'SKU-001')
      expect(searchId).toHaveLength(1)
      expect(searchId[0]?.productIdentifier).toBe('SKU-001')

      // Search by reason text
      const searchReason = filterReviewRows(rows, 'all', 'conflicting matches')
      expect(searchReason).toHaveLength(1)
      expect(searchReason[0]?.status).toBe('ambiguous_match')

      // Search with no results
      const searchNone = filterReviewRows(rows, 'all', 'non-existent-xyz-query')
      expect(searchNone).toHaveLength(0)
    })
  })

  describe('formatMatchStatus and formatMatchMethod', () => {
    it('formats all statuses into clear readable labels', () => {
      expect(formatMatchStatus('matched')).toBe('Matched')
      expect(formatMatchStatus('unmatched_image')).toBe('Unmatched image')
      expect(formatMatchStatus('unmatched_product')).toBe('Unmatched product')
      expect(formatMatchStatus('invalid_product_key')).toBe('Invalid product key')
      expect(formatMatchStatus('duplicate_product_key')).toBe('Duplicate product key')
      expect(formatMatchStatus('ambiguous_match')).toBe('Ambiguous match')
      expect(formatMatchStatus('output_collision')).toBe('Output collision')
      expect(formatMatchStatus('unsupported_file')).toBe('Unsupported file')
    })

    it('formats all match methods into clear readable labels', () => {
      expect(formatMatchMethod('explicit_filename')).toBe('Explicit filename')
      expect(formatMatchMethod('primary_identifier')).toBe('Primary identifier')
      expect(formatMatchMethod('sku')).toBe('SKU')
      expect(formatMatchMethod('barcode')).toBe('Barcode')
      expect(formatMatchMethod('none')).toBe('—')
    })
  })

  describe('getProblemCounts', () => {
    it('accurately sums total problems and categorizes breakdown', () => {
      const result = createComprehensiveMockResult()
      const counts = getProblemCounts(result.summary)

      expect(counts.totalProblems).toBe(7) // 1 unmatchedImg + 1 unmatchedProd + 1 invalid + 2 dups + 1 ambiguous + 1 unsupported
      expect(counts.unmatchedImages).toBe(1)
      expect(counts.unmatchedProducts).toBe(1)
      expect(counts.invalidProducts).toBe(1)
      expect(counts.duplicateProducts).toBe(2)
      expect(counts.ambiguousMatches).toBe(1)
      expect(counts.unsupportedFiles).toBe(1)
      expect(counts.outputCollisions).toBe(0)
    })

    it('returns 0 problems when summary has only matched items', () => {
      const perfectSummary = {
        totalProducts: 10,
        validProducts: 10,
        invalidProducts: 0,
        duplicateProducts: 0,
        totalImages: 10,
        supportedImages: 10,
        unsupportedFiles: 0,
        matchedImages: 10,
        unmatchedImages: 0,
        ambiguousMatches: 0,
        unmatchedProducts: 0,
      }
      const counts = getProblemCounts(perfectSummary)
      expect(counts.totalProblems).toBe(0)
    })
  })

  describe('Edge and Empty States', () => {
    it('handles result with no matched images and all unmatched', () => {
      const emptyResult: MatchingEngineResult = {
        products: [],
        imageResults: [
          {
            item: createMockImage('orphan1.jpg'),
            status: 'unmatched_image',
            matchMethod: 'none',
            matchedProductRowIndex: null,
            primaryIdentifier: null,
            reason: 'No match',
          },
        ],
        matchedImages: [],
        unmatchedImages: [
          {
            item: createMockImage('orphan1.jpg'),
            status: 'unmatched_image',
            matchMethod: 'none',
            matchedProductRowIndex: null,
            primaryIdentifier: null,
            reason: 'No match',
          },
        ],
        ambiguousImages: [],
        unmatchedProducts: [],
        invalidProducts: [],
        duplicateProducts: [],
        unsupportedFiles: [],
        summary: {
          totalProducts: 0,
          validProducts: 0,
          invalidProducts: 0,
          duplicateProducts: 0,
          totalImages: 1,
          supportedImages: 1,
          unsupportedFiles: 0,
          matchedImages: 0,
          unmatchedImages: 1,
          ambiguousMatches: 0,
          unmatchedProducts: 0,
        },
      }

      const rows = buildReviewRows(emptyResult)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.status).toBe('unmatched_image')
      expect(getProblemCounts(emptyResult.summary).totalProblems).toBe(1)
    })

    it('handles inventory containing only unsupported files', () => {
      const unsupportedItem = createMockImage('archive/doc.pdf', false)
      const unsupportedResult: MatchingEngineResult = {
        products: [],
        imageResults: [
          {
            item: unsupportedItem,
            status: 'unsupported_file',
            matchMethod: 'none',
            matchedProductRowIndex: null,
            primaryIdentifier: null,
            reason: 'Unsupported format',
          },
        ],
        matchedImages: [],
        unmatchedImages: [],
        ambiguousImages: [],
        unmatchedProducts: [],
        invalidProducts: [],
        duplicateProducts: [],
        unsupportedFiles: [
          {
            item: unsupportedItem,
            status: 'unsupported_file',
            matchMethod: 'none',
            matchedProductRowIndex: null,
            primaryIdentifier: null,
            reason: 'Unsupported format',
          },
        ],
        summary: {
          totalProducts: 0,
          validProducts: 0,
          invalidProducts: 0,
          duplicateProducts: 0,
          totalImages: 1,
          supportedImages: 0,
          unsupportedFiles: 1,
          matchedImages: 0,
          unmatchedImages: 0,
          ambiguousMatches: 0,
          unmatchedProducts: 0,
        },
      }

      const rows = buildReviewRows(unsupportedResult)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.status).toBe('unsupported_file')
      expect(getProblemCounts(unsupportedResult.summary).unsupportedFiles).toBe(1)
    })

    it('handles all product rows invalid', () => {
      const invalidProduct = createMockProduct(0, '', 'invalid_product_key', 'Blank primary key')
      const invalidResult: MatchingEngineResult = {
        products: [invalidProduct],
        imageResults: [],
        matchedImages: [],
        unmatchedImages: [],
        ambiguousImages: [],
        unmatchedProducts: [],
        invalidProducts: [invalidProduct],
        duplicateProducts: [],
        unsupportedFiles: [],
        summary: {
          totalProducts: 1,
          validProducts: 0,
          invalidProducts: 1,
          duplicateProducts: 0,
          totalImages: 0,
          supportedImages: 0,
          unsupportedFiles: 0,
          matchedImages: 0,
          unmatchedImages: 0,
          ambiguousMatches: 0,
          unmatchedProducts: 0,
        },
      }

      const rows = buildReviewRows(invalidResult)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.status).toBe('invalid_product_key')
      expect(rows[0]?.productIdentifier).toBe('(Blank)')
      expect(getProblemCounts(invalidResult.summary).invalidProducts).toBe(1)
    })

    it('handles duplicate-only product set', () => {
      const dup1 = createMockProduct(0, 'DUP-A', 'duplicate_product_key', 'Duplicate')
      const dup2 = createMockProduct(1, 'DUP-A', 'duplicate_product_key', 'Duplicate')
      const dupResult: MatchingEngineResult = {
        products: [dup1, dup2],
        imageResults: [],
        matchedImages: [],
        unmatchedImages: [],
        ambiguousImages: [],
        unmatchedProducts: [],
        invalidProducts: [],
        duplicateProducts: [dup1, dup2],
        unsupportedFiles: [],
        summary: {
          totalProducts: 2,
          validProducts: 0,
          invalidProducts: 0,
          duplicateProducts: 2,
          totalImages: 0,
          supportedImages: 0,
          unsupportedFiles: 0,
          matchedImages: 0,
          unmatchedImages: 0,
          ambiguousMatches: 0,
          unmatchedProducts: 0,
        },
      }

      const rows = buildReviewRows(dupResult)
      expect(rows).toHaveLength(2)
      expect(rows[0]?.status).toBe('duplicate_product_key')
      expect(rows[1]?.status).toBe('duplicate_product_key')
      expect(getProblemCounts(dupResult.summary).duplicateProducts).toBe(2)
    })
  })

  describe('getReviewStatusCounts and Filter Counts Consistency Invariants', () => {
    it('1. duplicate product + image case counts all visible duplicate rows', () => {
      const dupProd1 = createMockProduct(0, 'DUP-SKU', 'duplicate_product_key', 'Duplicate')
      const dupProd2 = createMockProduct(1, 'DUP-SKU', 'duplicate_product_key', 'Duplicate')
      const dupImg = createMockImage('DUP-SKU.jpg')

      const dupResult: MatchingEngineResult = {
        products: [dupProd1, dupProd2],
        imageResults: [
          {
            item: dupImg,
            status: 'duplicate_product_key',
            matchMethod: 'primary_identifier',
            matchedProductRowIndex: null,
            primaryIdentifier: null,
            reason: 'Matched primary identifier has duplicate rows',
          },
        ],
        matchedImages: [],
        unmatchedImages: [],
        ambiguousImages: [],
        unmatchedProducts: [],
        invalidProducts: [],
        duplicateProducts: [dupProd1, dupProd2],
        unsupportedFiles: [],
        summary: {
          totalProducts: 2,
          validProducts: 0,
          invalidProducts: 0,
          duplicateProducts: 2, // Note: engine summary only counts product records (2)
          totalImages: 1,
          supportedImages: 1,
          unsupportedFiles: 0,
          matchedImages: 0,
          unmatchedImages: 0,
          ambiguousMatches: 0,
          unmatchedProducts: 0,
        },
      }

      const rows = buildReviewRows(dupResult)
      const counts = getReviewStatusCounts(rows)

      // Expected: 3 rows with duplicate_product_key
      const dupRows = rows.filter((r) => r.status === 'duplicate_product_key')
      expect(dupRows).toHaveLength(3)

      // displayed/status count helper reports 3
      expect(counts.duplicate_product_key).toBe(3)

      // filterReviewRows(rows, 'duplicate_product_key') returns 3
      expect(filterReviewRows(rows, 'duplicate_product_key')).toHaveLength(3)
    })

    it('2. problems invariant: counts.totalProblems strictly equals filterReviewRows(rows, "problems").length', () => {
      const result = createComprehensiveMockResult()
      const rows = buildReviewRows(result)
      const counts = getReviewStatusCounts(rows)

      const problemRows = filterReviewRows(rows, 'problems')
      expect(counts.totalProblems).toBe(problemRows.length)
      expect(counts.totalProblems).toBe(rows.filter((r) => r.isProblem).length)
    })

    it('3. per-status invariant: counts[status] strictly equals filterReviewRows(rows, status).length', () => {
      const result = createComprehensiveMockResult()
      const rows = buildReviewRows(result)
      const counts = getReviewStatusCounts(rows)

      const statuses: MatchStatus[] = [
        'matched',
        'unmatched_image',
        'unmatched_product',
        'invalid_product_key',
        'duplicate_product_key',
        'ambiguous_match',
        'unsupported_file',
        'output_collision',
      ]

      for (const status of statuses) {
        expect(counts[status]).toBe(filterReviewRows(rows, status).length)
      }
    })

    it('4. matched invariant: counts.matched strictly equals filterReviewRows(rows, "matched").length', () => {
      const result = createComprehensiveMockResult()
      const rows = buildReviewRows(result)
      const counts = getReviewStatusCounts(rows)

      expect(counts.matched).toBe(filterReviewRows(rows, 'matched').length)
    })

    it('total invariant: counts.total strictly equals rows.length and filterReviewRows(rows, "all").length', () => {
      const result = createComprehensiveMockResult()
      const rows = buildReviewRows(result)
      const counts = getReviewStatusCounts(rows)

      expect(counts.total).toBe(rows.length)
      expect(counts.totalRows).toBe(rows.length)
      expect(counts.total).toBe(filterReviewRows(rows, 'all').length)
    })
  })
})
