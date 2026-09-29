import { describe, expect, it } from 'vitest'
import { sanitizeIdentifierForFilename, buildOutputPlan } from './naming'
import type { ImageInventoryItem } from '../types/image'
import type {
  ImageMatchResult,
  MatchingEngineResult,
  ProductRecord,
  UnmatchedProductResult,
} from '../types/matching'

function createFakeItem(overrides: Partial<ImageInventoryItem>): ImageInventoryItem {
  const relativePath = overrides.relativePath ?? 'sample.jpg'
  const basename = overrides.basename ?? 'sample.jpg'
  return {
    id: overrides.id ?? 'item-1',
    originalFilename: basename,
    basename,
    stem: overrides.stem ?? 'sample',
    extension: overrides.extension ?? 'jpg',
    relativePath,
    fileSize: 1024,
    sourceMethod: 'folder',
    isSupported: true,
    fileRef: null,
    ...overrides,
  }
}

function createFakeProduct(overrides: Partial<ProductRecord>): ProductRecord {
  const idRaw = overrides.primaryIdentifierRaw ?? 'PROD-1'
  return {
    rowIndex: overrides.rowIndex ?? 0,
    rowNumber: overrides.rowNumber ?? 2,
    sourceRow: { ID: idRaw },
    primaryIdentifierRaw: idRaw,
    primaryIdentifierNormalized: overrides.primaryIdentifierNormalized ?? idRaw.toLowerCase(),
    skuRaw: overrides.skuRaw ?? null,
    skuNormalized: overrides.skuNormalized ?? null,
    barcodeRaw: overrides.barcodeRaw ?? null,
    barcodeNormalized: overrides.barcodeNormalized ?? null,
    currentFilenameRaw: overrides.currentFilenameRaw ?? null,
    currentFilenameNormalized: overrides.currentFilenameNormalized ?? null,
    status: overrides.status ?? 'valid',
    ...overrides,
  }
}

function createFakeEngineResult(
  imageResults: ImageMatchResult[],
  unmatchedProducts: UnmatchedProductResult[] = [],
  invalidProducts: ProductRecord[] = [],
  duplicateProducts: ProductRecord[] = [],
): MatchingEngineResult {
  return {
    products: [],
    imageResults,
    matchedImages: imageResults.filter((i) => i.status === 'matched'),
    unmatchedImages: imageResults.filter((i) => i.status === 'unmatched_image'),
    ambiguousImages: imageResults.filter((i) => i.status === 'ambiguous_match'),
    unmatchedProducts,
    invalidProducts,
    duplicateProducts,
    unsupportedFiles: imageResults.filter((i) => !i.item.isSupported),
    summary: {
      totalProducts: 10,
      validProducts: 10,
      invalidProducts: invalidProducts.length,
      duplicateProducts: duplicateProducts.length,
      totalImages: imageResults.length,
      supportedImages: imageResults.filter((i) => i.item.isSupported).length,
      unsupportedFiles: imageResults.filter((i) => !i.item.isSupported).length,
      matchedImages: imageResults.filter((i) => i.status === 'matched').length,
      unmatchedImages: imageResults.filter((i) => i.status === 'unmatched_image').length,
      ambiguousMatches: imageResults.filter((i) => i.status === 'ambiguous_match').length,
      unmatchedProducts: unmatchedProducts.length,
    },
  }
}

describe('sanitizeIdentifierForFilename', () => {
  it('leaves a normal alphanumeric and hyphenated identifier unchanged', () => {
    expect(sanitizeIdentifierForFilename('ABC-123')).toBe('ABC-123')
    expect(sanitizeIdentifierForFilename('SKU_99-A')).toBe('SKU_99-A')
  })

  it('trims surrounding whitespace', () => {
    expect(sanitizeIdentifierForFilename('   ABC-123   ')).toBe('ABC-123')
    expect(sanitizeIdentifierForFilename('\tSKU-01\n')).toBe('SKU-01')
  })

  it('replaces forward slash (/) with hyphen', () => {
    expect(sanitizeIdentifierForFilename('ABC/DEF')).toBe('ABC-DEF')
  })

  it('replaces backslash (\\) with hyphen', () => {
    expect(sanitizeIdentifierForFilename('ABC\\DEF')).toBe('ABC-DEF')
  })

  it('replaces colon (:) with hyphen', () => {
    expect(sanitizeIdentifierForFilename('ABC:DEF')).toBe('ABC-DEF')
  })

  it('replaces asterisk (*) with hyphen', () => {
    expect(sanitizeIdentifierForFilename('ABC*DEF')).toBe('ABC-DEF')
  })

  it('replaces question mark (?) with hyphen', () => {
    expect(sanitizeIdentifierForFilename('ABC?DEF')).toBe('ABC-DEF')
  })

  it('replaces double quote (") with hyphen', () => {
    expect(sanitizeIdentifierForFilename('ABC"DEF')).toBe('ABC-DEF')
  })

  it('replaces less-than (<) with hyphen', () => {
    expect(sanitizeIdentifierForFilename('ABC<DEF')).toBe('ABC-DEF')
  })

  it('replaces greater-than (>) with hyphen', () => {
    expect(sanitizeIdentifierForFilename('ABC>DEF')).toBe('ABC-DEF')
  })

  it('replaces pipe (|) with hyphen', () => {
    expect(sanitizeIdentifierForFilename('ABC|DEF')).toBe('ABC-DEF')
  })

  it('replaces ASCII control characters (0x00-0x1F, 0x7F) with hyphen', () => {
    expect(sanitizeIdentifierForFilename('ABC\x00DEF')).toBe('ABC-DEF')
    expect(sanitizeIdentifierForFilename('ABC\x1FDEF')).toBe('ABC-DEF')
    expect(sanitizeIdentifierForFilename('ABC\x7FDEF')).toBe('ABC-DEF')
  })

  it('collapses consecutive unsafe characters cleanly into a single hyphen', () => {
    expect(sanitizeIdentifierForFilename('ABC///DEF')).toBe('ABC-DEF')
    expect(sanitizeIdentifierForFilename('ABC/*?:"<>|DEF')).toBe('ABC-DEF')
    expect(sanitizeIdentifierForFilename('ABC\\\\\\DEF')).toBe('ABC-DEF')
  })

  it('removes trailing period(s)', () => {
    expect(sanitizeIdentifierForFilename('ABC-123.')).toBe('ABC-123')
    expect(sanitizeIdentifierForFilename('ABC-123...')).toBe('ABC-123')
  })

  it('removes trailing spaces and periods in any combination', () => {
    expect(sanitizeIdentifierForFilename('ABC-123   ')).toBe('ABC-123')
    expect(sanitizeIdentifierForFilename('ABC-123.  ')).toBe('ABC-123')
    expect(sanitizeIdentifierForFilename('ABC-123 . . ')).toBe('ABC-123')
  })

  it('preserves Turkish characters without transliteration', () => {
    expect(sanitizeIdentifierForFilename('Çorap-001')).toBe('Çorap-001')
    expect(sanitizeIdentifierForFilename('Şapka-ĞÜİıöç')).toBe('Şapka-ĞÜİıöç')
  })

  it('preserves arbitrary Unicode characters', () => {
    expect(sanitizeIdentifierForFilename('日本語-100')).toBe('日本語-100')
    expect(sanitizeIdentifierForFilename('Café-au-lait')).toBe('Café-au-lait')
    expect(sanitizeIdentifierForFilename('Товар-01')).toBe('Товар-01')
  })

  it('returns null when identifier becomes empty or unusable after sanitization', () => {
    expect(sanitizeIdentifierForFilename('')).toBeNull()
    expect(sanitizeIdentifierForFilename('   ')).toBeNull()
    expect(sanitizeIdentifierForFilename('...')).toBeNull()
    expect(sanitizeIdentifierForFilename('  . . .  ')).toBeNull()
  })
})

describe('buildOutputPlan naming and sequencing', () => {
  it('assigns -1 to a single matched image', () => {
    const product = createFakeProduct({ primaryIdentifierRaw: 'ABC-100' })
    const item = createFakeItem({ basename: 'ABC-100.jpg', extension: 'jpg' })
    const engineResult = createFakeEngineResult([
      {
        item,
        status: 'matched',
        matchMethod: 'primary_identifier',
        matchedProductRowIndex: 0,
        matchedProduct: product,
        primaryIdentifier: 'ABC-100',
        sequenceNumber: 1,
      },
    ])

    const plan = buildOutputPlan(engineResult)
    expect(plan.safeOutputCount).toBe(1)
    expect(plan.collisionCount).toBe(0)
    expect(plan.problemCount).toBe(0)

    const imgPlan = plan.imagePlans[0]
    expect(imgPlan?.status).toBe('matched')
    expect(imgPlan?.sequenceNumber).toBe(1)
    expect(imgPlan?.proposedFilename).toBe('ABC-100-1.jpg')
    expect(imgPlan?.proposedOutputPath).toBe('images/ABC-100-1.jpg')
  })

  it('generates stable -1, -2, -10 based on provided sequence numbers', () => {
    const product = createFakeProduct({ primaryIdentifierRaw: 'PROD-X' })
    const items = [
      createFakeItem({ id: '1', basename: 'p-1.jpg', extension: 'jpg' }),
      createFakeItem({ id: '2', basename: 'p-2.jpg', extension: 'jpg' }),
      createFakeItem({ id: '10', basename: 'p-10.jpg', extension: 'jpg' }),
    ]
    const engineResult = createFakeEngineResult([
      {
        item: items[0]!,
        status: 'matched',
        matchMethod: 'primary_identifier',
        matchedProductRowIndex: 0,
        matchedProduct: product,
        primaryIdentifier: 'PROD-X',
        sequenceNumber: 1,
      },
      {
        item: items[1]!,
        status: 'matched',
        matchMethod: 'primary_identifier',
        matchedProductRowIndex: 0,
        matchedProduct: product,
        primaryIdentifier: 'PROD-X',
        sequenceNumber: 2,
      },
      {
        item: items[2]!,
        status: 'matched',
        matchMethod: 'primary_identifier',
        matchedProductRowIndex: 0,
        matchedProduct: product,
        primaryIdentifier: 'PROD-X',
        sequenceNumber: 10,
      },
    ])

    const plan = buildOutputPlan(engineResult)
    expect(plan.safeOutputCount).toBe(3)
    expect(plan.imagePlans[0]?.proposedFilename).toBe('PROD-X-1.jpg')
    expect(plan.imagePlans[1]?.proposedFilename).toBe('PROD-X-2.jpg')
    expect(plan.imagePlans[2]?.proposedFilename).toBe('PROD-X-10.jpg')
  })

  it('converts uppercase source extensions to lowercase', () => {
    const product = createFakeProduct({ primaryIdentifierRaw: 'ITEM-1' })
    const item = createFakeItem({ basename: 'ITEM-1.JPG', extension: 'JPG' })
    const engineResult = createFakeEngineResult([
      {
        item,
        status: 'matched',
        matchMethod: 'primary_identifier',
        matchedProductRowIndex: 0,
        matchedProduct: product,
        primaryIdentifier: 'ITEM-1',
        sequenceNumber: 1,
      },
    ])

    const plan = buildOutputPlan(engineResult)
    expect(plan.imagePlans[0]?.sourceExtension).toBe('jpg')
    expect(plan.imagePlans[0]?.proposedFilename).toBe('ITEM-1-1.jpg')
  })

  it('preserves jpeg extension when source extension is jpeg', () => {
    const product = createFakeProduct({ primaryIdentifierRaw: 'ITEM-1' })
    const item = createFakeItem({ basename: 'ITEM-1.jpeg', extension: 'jpeg' })
    const engineResult = createFakeEngineResult([
      {
        item,
        status: 'matched',
        matchMethod: 'primary_identifier',
        matchedProductRowIndex: 0,
        matchedProduct: product,
        primaryIdentifier: 'ITEM-1',
        sequenceNumber: 1,
      },
    ])

    const plan = buildOutputPlan(engineResult)
    expect(plan.imagePlans[0]?.sourceExtension).toBe('jpeg')
    expect(plan.imagePlans[0]?.proposedFilename).toBe('ITEM-1-1.jpeg')
  })

  it('does not leak nested source folder paths into proposed filenames', () => {
    const product = createFakeProduct({ primaryIdentifierRaw: 'NESTED-01' })
    const item = createFakeItem({
      relativePath: 'nested/subfolder/deep/NESTED-01.png',
      basename: 'NESTED-01.png',
      extension: 'png',
    })
    const engineResult = createFakeEngineResult([
      {
        item,
        status: 'matched',
        matchMethod: 'primary_identifier',
        matchedProductRowIndex: 0,
        matchedProduct: product,
        primaryIdentifier: 'NESTED-01',
        sequenceNumber: 1,
      },
    ])

    const plan = buildOutputPlan(engineResult)
    expect(plan.imagePlans[0]?.proposedFilename).toBe('NESTED-01-1.png')
    expect(plan.imagePlans[0]?.proposedOutputPath).toBe('images/NESTED-01-1.png')
  })

  it('preserves original raw primary identifier letter casing in proposed filename', () => {
    const product = createFakeProduct({
      primaryIdentifierRaw: 'Çorap-001',
      primaryIdentifierNormalized: 'çorap-001',
    })
    const item = createFakeItem({ basename: 'çorap-001.jpg', extension: 'jpg' })
    const engineResult = createFakeEngineResult([
      {
        item,
        status: 'matched',
        matchMethod: 'primary_identifier',
        matchedProductRowIndex: 0,
        matchedProduct: product,
        primaryIdentifier: 'Çorap-001',
        sequenceNumber: 1,
      },
    ])

    const plan = buildOutputPlan(engineResult)
    expect(plan.imagePlans[0]?.proposedFilename).toBe('Çorap-001-1.jpg')
  })
})

describe('buildOutputPlan collision detection', () => {
  it('has zero collisions when all output paths are distinct', () => {
    const prodA = createFakeProduct({ primaryIdentifierRaw: 'PROD-A' })
    const prodB = createFakeProduct({ primaryIdentifierRaw: 'PROD-B' })
    const engineResult = createFakeEngineResult([
      {
        item: createFakeItem({ id: '1', basename: 'PROD-A.jpg' }),
        status: 'matched',
        matchMethod: 'primary_identifier',
        matchedProductRowIndex: 0,
        matchedProduct: prodA,
        primaryIdentifier: 'PROD-A',
        sequenceNumber: 1,
      },
      {
        item: createFakeItem({ id: '2', basename: 'PROD-B.jpg' }),
        status: 'matched',
        matchMethod: 'primary_identifier',
        matchedProductRowIndex: 1,
        matchedProduct: prodB,
        primaryIdentifier: 'PROD-B',
        sequenceNumber: 1,
      },
    ])

    const plan = buildOutputPlan(engineResult)
    expect(plan.safeOutputCount).toBe(2)
    expect(plan.collisionCount).toBe(0)
    expect(plan.problemCount).toBe(0)
  })

  it('detects collision when two images resolve to the exact same output path', () => {
    const prodA = createFakeProduct({ primaryIdentifierRaw: 'COLLIDE-1' })
    const item1 = createFakeItem({ id: '1', relativePath: 'dirA/COLLIDE-1.jpg', basename: 'COLLIDE-1.jpg' })
    const item2 = createFakeItem({ id: '2', relativePath: 'dirB/COLLIDE-1.jpg', basename: 'COLLIDE-1.jpg' })

    const engineResult = createFakeEngineResult([
      {
        item: item1,
        status: 'matched',
        matchMethod: 'explicit_filename',
        matchedProductRowIndex: 0,
        matchedProduct: prodA,
        primaryIdentifier: 'COLLIDE-1',
        sequenceNumber: 1,
      },
      {
        item: item2,
        status: 'matched',
        matchMethod: 'explicit_filename',
        matchedProductRowIndex: 0,
        matchedProduct: prodA,
        primaryIdentifier: 'COLLIDE-1',
        sequenceNumber: 1,
      },
    ])

    const plan = buildOutputPlan(engineResult)
    expect(plan.safeOutputCount).toBe(0)
    expect(plan.collisionCount).toBe(2)
    expect(plan.problemCount).toBe(2)

    // Neither item is considered safe; both marked output_collision
    expect(plan.imagePlans[0]?.status).toBe('output_collision')
    expect(plan.imagePlans[0]?.isProblem).toBe(true)
    expect(plan.imagePlans[0]?.reason).toContain('Multiple images resolve to the same output path: images/COLLIDE-1-1.jpg')
    expect(plan.imagePlans[0]?.proposedFilename).toBe('COLLIDE-1-1.jpg')

    expect(plan.imagePlans[1]?.status).toBe('output_collision')
    expect(plan.imagePlans[1]?.isProblem).toBe(true)
    expect(plan.imagePlans[1]?.reason).toContain('Multiple images resolve to the same output path: images/COLLIDE-1-1.jpg')
    expect(plan.imagePlans[1]?.proposedFilename).toBe('COLLIDE-1-1.jpg')
  })

  it('detects collisions caused by sanitization of different identifiers', () => {
    // ABC/DEF and ABC\DEF both sanitize to ABC-DEF
    const prodSlash = createFakeProduct({ primaryIdentifierRaw: 'ABC/DEF' })
    const prodBackslash = createFakeProduct({ primaryIdentifierRaw: 'ABC\\DEF' })

    const item1 = createFakeItem({ id: '1', basename: 'img1.jpg' })
    const item2 = createFakeItem({ id: '2', basename: 'img2.jpg' })

    const engineResult = createFakeEngineResult([
      {
        item: item1,
        status: 'matched',
        matchMethod: 'primary_identifier',
        matchedProductRowIndex: 0,
        matchedProduct: prodSlash,
        primaryIdentifier: 'ABC/DEF',
        sequenceNumber: 1,
      },
      {
        item: item2,
        status: 'matched',
        matchMethod: 'primary_identifier',
        matchedProductRowIndex: 1,
        matchedProduct: prodBackslash,
        primaryIdentifier: 'ABC\\DEF',
        sequenceNumber: 1,
      },
    ])

    const plan = buildOutputPlan(engineResult)
    expect(plan.safeOutputCount).toBe(0)
    expect(plan.collisionCount).toBe(2)
    expect(plan.imagePlans[0]?.status).toBe('output_collision')
    expect(plan.imagePlans[1]?.status).toBe('output_collision')
    expect(plan.imagePlans[0]?.proposedFilename).toBe('ABC-DEF-1.jpg')
    expect(plan.imagePlans[1]?.proposedFilename).toBe('ABC-DEF-1.jpg')
  })

  it('is deterministic across repeated runs', () => {
    const prodA = createFakeProduct({ primaryIdentifierRaw: 'DET-1' })
    const item1 = createFakeItem({ id: '1', basename: 'DET-1.jpg' })
    const engineResult = createFakeEngineResult([
      {
        item: item1,
        status: 'matched',
        matchMethod: 'primary_identifier',
        matchedProductRowIndex: 0,
        matchedProduct: prodA,
        primaryIdentifier: 'DET-1',
        sequenceNumber: 1,
      },
    ])

    const run1 = buildOutputPlan(engineResult)
    const run2 = buildOutputPlan(engineResult)
    expect(run1).toEqual(run2)
  })
})

describe('buildOutputPlan problem handling', () => {
  it('handles identifier that becomes empty after sanitization', () => {
    const product = createFakeProduct({ primaryIdentifierRaw: '...' })
    const item = createFakeItem({ basename: 'item.jpg' })
    const engineResult = createFakeEngineResult([
      {
        item,
        status: 'matched',
        matchMethod: 'primary_identifier',
        matchedProductRowIndex: 0,
        matchedProduct: product,
        primaryIdentifier: '...',
        sequenceNumber: 1,
      },
    ])

    const plan = buildOutputPlan(engineResult)
    expect(plan.safeOutputCount).toBe(0)
    expect(plan.collisionCount).toBe(0)
    expect(plan.problemCount).toBe(1)

    const imgPlan = plan.imagePlans[0]
    expect(imgPlan?.status).toBe('invalid_product_key')
    expect(imgPlan?.isProblem).toBe(true)
    expect(imgPlan?.proposedFilename).toBeNull()
    expect(imgPlan?.proposedOutputPath).toBeNull()
    expect(imgPlan?.reason).toContain('empty after filename sanitization')
  })

  it('preserves existing problem statuses and does not invent proposed filenames', () => {
    const engineResult = createFakeEngineResult([
      {
        item: createFakeItem({ id: 'unmatched', basename: 'unknown.jpg' }),
        status: 'unmatched_image',
        matchMethod: 'none',
        matchedProductRowIndex: null,
        primaryIdentifier: null,
        reason: 'No matching product identifier found',
      },
      {
        item: createFakeItem({ id: 'ambig', basename: 'ambig.jpg' }),
        status: 'ambiguous_match',
        matchMethod: 'sku',
        matchedProductRowIndex: null,
        primaryIdentifier: null,
        reason: 'Multiple products match',
      },
      {
        item: createFakeItem({ id: 'unsupported', basename: 'doc.pdf', isSupported: false }),
        status: 'unsupported_file',
        matchMethod: 'none',
        matchedProductRowIndex: null,
        primaryIdentifier: null,
        reason: 'Unsupported extension',
      },
    ])

    const plan = buildOutputPlan(engineResult)
    expect(plan.safeOutputCount).toBe(0)
    expect(plan.problemCount).toBe(3)

    expect(plan.imagePlans[0]?.status).toBe('unmatched_image')
    expect(plan.imagePlans[0]?.proposedFilename).toBeNull()

    expect(plan.imagePlans[1]?.status).toBe('ambiguous_match')
    expect(plan.imagePlans[1]?.proposedFilename).toBeNull()

    expect(plan.imagePlans[2]?.status).toBe('unsupported_file')
    expect(plan.imagePlans[2]?.proposedFilename).toBeNull()
  })
})
