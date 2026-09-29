import type { ColumnMapping } from '../types/spreadsheet'
import type { ImageInventory } from '../types/image'
import type {
  ImageMatchResult,
  MatchMethod,
  MatchingEngineResult,
  MatchingSummary,
  ProductRecord,
  UnmatchedProductResult,
} from '../types/matching'
import {
  matchesIdentifierBoundary,
  normalizeFilenameBasename,
  normalizeFilenameStem,
  normalizeIdentifier,
  SUPPORTED_MATCH_BOUNDARIES,
} from './normalize'
import { stableNaturalSort } from './naturalSort'

/**
 * Builds matching-oriented product records from raw spreadsheet rows,
 * classifying invalid and duplicate primary keys without mutating source data.
 */
export function buildProductRecords(
  rows: readonly Record<string, string>[],
  mapping: ColumnMapping,
): ProductRecord[] {
  const primaryCol = mapping.primaryKeyColumn
  const skuCol = mapping.skuColumn
  const barcodeCol = mapping.barcodeColumn
  const filenameCol = mapping.currentFilenameColumn

  // First pass: extract and count normalized primary identifiers
  const primaryCounts = new Map<string, number>()
  const rawRecords: Array<{
    rowIndex: number
    rowNumber: number
    sourceRow: Record<string, string>
    primaryRaw: string
    primaryNorm: string
    skuRaw: string | null
    skuNorm: string | null
    barcodeRaw: string | null
    barcodeNorm: string | null
    filenameRaw: string | null
    filenameNorm: string | null
  }> = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] ?? {}
    const primaryRaw = (row[primaryCol] ?? '').trim()
    const primaryNorm = normalizeIdentifier(primaryRaw)

    const skuRaw = skuCol ? (row[skuCol] ?? '').trim() : null
    const skuNorm = skuRaw !== null && skuRaw !== '' ? normalizeIdentifier(skuRaw) : null

    const barcodeRaw = barcodeCol ? (row[barcodeCol] ?? '').trim() : null
    const barcodeNorm = barcodeRaw !== null && barcodeRaw !== '' ? normalizeIdentifier(barcodeRaw) : null

    const filenameRaw = filenameCol ? (row[filenameCol] ?? '').trim() : null
    const filenameNorm = filenameRaw !== null && filenameRaw !== '' ? normalizeFilenameBasename(filenameRaw) : null

    if (primaryNorm !== '') {
      primaryCounts.set(primaryNorm, (primaryCounts.get(primaryNorm) ?? 0) + 1)
    }

    rawRecords.push({
      rowIndex: i,
      rowNumber: i + 1,
      sourceRow: row,
      primaryRaw,
      primaryNorm,
      skuRaw,
      skuNorm,
      barcodeRaw,
      barcodeNorm,
      filenameRaw,
      filenameNorm,
    })
  }

  // Second pass: determine validity / duplicate status
  return rawRecords.map((r) => {
    if (r.primaryRaw === '' || r.primaryNorm === '') {
      return {
        rowIndex: r.rowIndex,
        rowNumber: r.rowNumber,
        sourceRow: r.sourceRow,
        primaryIdentifierRaw: r.primaryRaw,
        primaryIdentifierNormalized: r.primaryNorm,
        skuRaw: r.skuRaw,
        skuNormalized: r.skuNorm,
        barcodeRaw: r.barcodeRaw,
        barcodeNormalized: r.barcodeNorm,
        currentFilenameRaw: r.filenameRaw,
        currentFilenameNormalized: r.filenameNorm,
        status: 'invalid_product_key',
        reason: 'Blank primary product identifier',
      }
    }

    const count = primaryCounts.get(r.primaryNorm) ?? 0
    if (count > 1) {
      return {
        rowIndex: r.rowIndex,
        rowNumber: r.rowNumber,
        sourceRow: r.sourceRow,
        primaryIdentifierRaw: r.primaryRaw,
        primaryIdentifierNormalized: r.primaryNorm,
        skuRaw: r.skuRaw,
        skuNormalized: r.skuNorm,
        barcodeRaw: r.barcodeRaw,
        barcodeNormalized: r.barcodeNorm,
        currentFilenameRaw: r.filenameRaw,
        currentFilenameNormalized: r.filenameNorm,
        status: 'duplicate_product_key',
        reason: `Duplicate primary product key: "${r.primaryRaw}"`,
      }
    }

    return {
      rowIndex: r.rowIndex,
      rowNumber: r.rowNumber,
      sourceRow: r.sourceRow,
      primaryIdentifierRaw: r.primaryRaw,
      primaryIdentifierNormalized: r.primaryNorm,
      skuRaw: r.skuRaw,
      skuNormalized: r.skuNorm,
      barcodeRaw: r.barcodeRaw,
      barcodeNormalized: r.barcodeNorm,
      currentFilenameRaw: r.filenameRaw,
      currentFilenameNormalized: r.filenameNorm,
      status: 'valid',
    }
  })
}

/**
 * Searches a product index for candidates matching a normalized stem.
 * Prioritizes exact matches, then longest boundary prefix matches.
 * Prevents prefix false positives (e.g. ABC-1 does not steal ABC-10).
 */
export function findBestIdentifierMatch(
  index: Map<string, ProductRecord[]>,
  imgStem: string,
): ProductRecord[] | null {
  // 1. Exact stem match
  const exact = index.get(imgStem)
  if (exact && exact.length > 0) {
    return exact
  }

  // 2. Prefix matches at supported boundary positions ('-', '_', ' ', '(')
  const candidatePrefixes: Array<{ prefix: string; rows: ProductRecord[]; length: number }> = []

  for (let i = 1; i < imgStem.length; i++) {
    const char = imgStem[i]
    if (char && (SUPPORTED_MATCH_BOUNDARIES as readonly string[]).includes(char)) {
      const prefix = imgStem.slice(0, i)
      const matches = index.get(prefix)
      if (matches && matches.length > 0) {
        // Double-check with boundary matcher to ensure full correctness
        if (matchesIdentifierBoundary(imgStem, prefix)) {
          candidatePrefixes.push({ prefix, rows: matches, length: prefix.length })
        }
      }
    }
  }

  if (candidatePrefixes.length === 0) {
    return null
  }

  // Longest matching prefix takes precedence
  candidatePrefixes.sort((a, b) => b.length - a.length)
  const longest = candidatePrefixes[0]
  if (!longest) return null

  // If multiple different prefixes tie for the longest length, combine their rows
  const tiedLongest = candidatePrefixes.filter((p) => p.length === longest.length)
  if (tiedLongest.length === 1) {
    return longest.rows
  }

  const combinedRows: ProductRecord[] = []
  for (const c of tiedLongest) {
    combinedRows.push(...c.rows)
  }
  return combinedRows
}

/**
 * Executes deterministic product-to-image matching according to docs/MVP.md rules.
 */
export function executeDeterministicMatching(
  rows: readonly Record<string, string>[],
  mapping: ColumnMapping,
  inventory: ImageInventory,
): MatchingEngineResult {
  const products = buildProductRecords(rows, mapping)

  // Build multi-row indexes for each field
  const primaryIndex = new Map<string, ProductRecord[]>()
  const skuIndex = new Map<string, ProductRecord[]>()
  const barcodeIndex = new Map<string, ProductRecord[]>()
  const explicitBasenameIndex = new Map<string, ProductRecord[]>()
  const explicitStemIndex = new Map<string, ProductRecord[]>()

  const addToIndex = (index: Map<string, ProductRecord[]>, key: string | null, product: ProductRecord) => {
    if (!key) return
    const list = index.get(key)
    if (list) {
      list.push(product)
    } else {
      index.set(key, [product])
    }
  }

  for (const p of products) {
    addToIndex(primaryIndex, p.primaryIdentifierNormalized, p)

    if (mapping.skuColumn && p.skuNormalized) {
      addToIndex(skuIndex, p.skuNormalized, p)
    }

    if (mapping.barcodeColumn && p.barcodeNormalized) {
      addToIndex(barcodeIndex, p.barcodeNormalized, p)
    }

    if (mapping.currentFilenameColumn && p.currentFilenameNormalized) {
      addToIndex(explicitBasenameIndex, p.currentFilenameNormalized, p)
      const stem = normalizeFilenameStem(p.currentFilenameRaw ?? '')
      if (stem) {
        addToIndex(explicitStemIndex, stem, p)
      }
    }
  }

  const rawImageResults: ImageMatchResult[] = []

  // Process all items in inventory in order
  for (const item of inventory.items) {
    // Non-image files are classified as unsupported_file
    if (!item.isSupported) {
      rawImageResults.push({
        item,
        status: 'unsupported_file',
        matchMethod: 'none',
        matchedProductRowIndex: null,
        primaryIdentifier: null,
        reason: `Unsupported file format (.${item.extension || 'unknown'})`,
      })
      continue
    }

    const imgBasename = normalizeFilenameBasename(item.basename)
    const imgStem = normalizeFilenameStem(item.basename)

    // --- Step 1: Explicit Current Filename Matching (Highest Precedence) ---
    let explicitMatches: ProductRecord[] | null = null

    if (mapping.currentFilenameColumn) {
      // Try exact basename match first
      const exactBasename = explicitBasenameIndex.get(imgBasename)
      if (exactBasename && exactBasename.length > 0) {
        explicitMatches = exactBasename
      } else {
        // Fallback: extension-insensitive stem match
        const exactStem = explicitStemIndex.get(imgStem)
        if (exactStem && exactStem.length > 0) {
          explicitMatches = exactStem
        }
      }
    }

    if (explicitMatches !== null) {
      if (explicitMatches.length === 1) {
        const product = explicitMatches[0]!
        if (product.status === 'duplicate_product_key') {
          rawImageResults.push({
            item,
            status: 'duplicate_product_key',
            matchMethod: 'explicit_filename',
            matchedProductRowIndex: product.rowIndex,
            matchedProduct: product,
            primaryIdentifier: product.primaryIdentifierRaw,
            reason: `Matched product has duplicate primary key: "${product.primaryIdentifierRaw}"`,
          })
        } else if (product.status === 'invalid_product_key') {
          rawImageResults.push({
            item,
            status: 'invalid_product_key',
            matchMethod: 'explicit_filename',
            matchedProductRowIndex: product.rowIndex,
            matchedProduct: product,
            primaryIdentifier: product.primaryIdentifierRaw,
            reason: 'Matched product has blank primary key',
          })
        } else {
          rawImageResults.push({
            item,
            status: 'matched',
            matchMethod: 'explicit_filename',
            matchedProductRowIndex: product.rowIndex,
            matchedProduct: product,
            primaryIdentifier: product.primaryIdentifierRaw,
          })
        }
        continue
      } else {
        rawImageResults.push({
          item,
          status: 'ambiguous_match',
          matchMethod: 'explicit_filename',
          matchedProductRowIndex: null,
          primaryIdentifier: null,
          reason: `Explicit filename matches ${explicitMatches.length} product rows`,
        })
        continue
      }
    }

    // --- Step 2: Inferred Identifier Matching ---
    interface FieldResolution {
      field: 'primary' | 'sku' | 'barcode'
      rows: ProductRecord[]
    }

    const fieldResolutions: FieldResolution[] = []

    // Test Primary Identifier index
    const primaryMatch = findBestIdentifierMatch(primaryIndex, imgStem)
    if (primaryMatch) {
      fieldResolutions.push({ field: 'primary', rows: primaryMatch })
    }

    // Test SKU index if mapped and not identical column to primary
    if (mapping.skuColumn && mapping.skuColumn !== mapping.primaryKeyColumn) {
      const skuMatch = findBestIdentifierMatch(skuIndex, imgStem)
      if (skuMatch) {
        fieldResolutions.push({ field: 'sku', rows: skuMatch })
      }
    }

    // Test Barcode index if mapped and not identical column to primary/sku
    if (
      mapping.barcodeColumn &&
      mapping.barcodeColumn !== mapping.primaryKeyColumn &&
      mapping.barcodeColumn !== mapping.skuColumn
    ) {
      const barcodeMatch = findBestIdentifierMatch(barcodeIndex, imgStem)
      if (barcodeMatch) {
        fieldResolutions.push({ field: 'barcode', rows: barcodeMatch })
      }
    }

    // No field matched
    if (fieldResolutions.length === 0) {
      rawImageResults.push({
        item,
        status: 'unmatched_image',
        matchMethod: 'none',
        matchedProductRowIndex: null,
        primaryIdentifier: null,
        reason: 'No matching product identifier found for image filename',
      })
      continue
    }

    // Check if any matching field points to multiple rows (duplicate lookup key)
    const multiRowField = fieldResolutions.find((f) => f.rows.length > 1)
    if (multiRowField) {
      if (
        multiRowField.field === 'primary' ||
        multiRowField.rows.some((r) => r.status === 'duplicate_product_key')
      ) {
        rawImageResults.push({
          item,
          status: 'duplicate_product_key',
          matchMethod: 'primary_identifier',
          matchedProductRowIndex: null,
          primaryIdentifier: null,
          reason: `Matched primary identifier has duplicate rows in spreadsheet: "${multiRowField.rows[0]?.primaryIdentifierRaw}"`,
        })
        continue
      }

      const fieldName = multiRowField.field.toUpperCase()
      rawImageResults.push({
        item,
        status: 'ambiguous_match',
        matchMethod: multiRowField.field,
        matchedProductRowIndex: null,
        primaryIdentifier: null,
        reason: `Identifier matches multiple product rows via ${fieldName}`,
      })
      continue
    }

    // Collect distinct matched row indices
    const distinctRowIndices = Array.from(new Set(fieldResolutions.map((f) => f.rows[0]!.rowIndex)))

    // If different fields resolved to different products -> Ambiguous match
    if (distinctRowIndices.length > 1) {
      rawImageResults.push({
        item,
        status: 'ambiguous_match',
        matchMethod: 'none',
        matchedProductRowIndex: null,
        primaryIdentifier: null,
        reason: 'Conflicting matches: SKU and barcode resolved to different product rows',
      })
      continue
    }

    // All matching fields agreed on the same row!
    const targetProduct = fieldResolutions[0]!.rows[0]!

    // Determine match method label
    let matchMethod: MatchMethod = 'primary_identifier'
    if (fieldResolutions.some((f) => f.field === 'sku')) {
      matchMethod = 'sku'
    } else if (fieldResolutions.some((f) => f.field === 'barcode')) {
      matchMethod = 'barcode'
    }

    if (targetProduct.status === 'duplicate_product_key') {
      rawImageResults.push({
        item,
        status: 'duplicate_product_key',
        matchMethod,
        matchedProductRowIndex: targetProduct.rowIndex,
        matchedProduct: targetProduct,
        primaryIdentifier: targetProduct.primaryIdentifierRaw,
        reason: `Matched product has duplicate primary key: "${targetProduct.primaryIdentifierRaw}"`,
      })
    } else if (targetProduct.status === 'invalid_product_key') {
      rawImageResults.push({
        item,
        status: 'invalid_product_key',
        matchMethod,
        matchedProductRowIndex: targetProduct.rowIndex,
        matchedProduct: targetProduct,
        primaryIdentifier: targetProduct.primaryIdentifierRaw,
        reason: 'Matched product has blank primary key',
      })
    } else {
      rawImageResults.push({
        item,
        status: 'matched',
        matchMethod,
        matchedProductRowIndex: targetProduct.rowIndex,
        matchedProduct: targetProduct,
        primaryIdentifier: targetProduct.primaryIdentifierRaw,
      })
    }
  }

  // --- Step 3: Assign Stable Natural Ordering and 1-based Sequence Numbers ---
  // Group matched images by product row index
  const matchedImagesByProduct = new Map<number, ImageMatchResult[]>()
  for (const result of rawImageResults) {
    if (result.status === 'matched' && result.matchedProductRowIndex !== null) {
      const list = matchedImagesByProduct.get(result.matchedProductRowIndex)
      if (list) {
        list.push(result)
      } else {
        matchedImagesByProduct.set(result.matchedProductRowIndex, [result])
      }
    }
  }

  // Map to hold sequence number per item id
  const sequenceNumberByItemId = new Map<string, number>()
  for (const [, results] of matchedImagesByProduct.entries()) {
    // Sort stably using natural sort on relativePath
    const sorted = stableNaturalSort(results, (r) => r.item.relativePath)
    sorted.forEach((r, seqIdx) => {
      sequenceNumberByItemId.set(r.item.id, seqIdx + 1)
    })
  }

  // Apply sequence numbers back to image results
  const finalizedImageResults: ImageMatchResult[] = rawImageResults.map((r) => {
    if (r.status === 'matched') {
      const seq = sequenceNumberByItemId.get(r.item.id)
      return {
        ...r,
        sequenceNumber: seq,
      }
    }
    return r
  })

  // --- Step 4: Collect Outputs and Summaries ---
  const matchedImages = finalizedImageResults.filter((r) => r.status === 'matched')
  const unmatchedImages = finalizedImageResults.filter((r) => r.status === 'unmatched_image')
  const ambiguousImages = finalizedImageResults.filter((r) => r.status === 'ambiguous_match')
  const unsupportedFiles = finalizedImageResults.filter((r) => r.status === 'unsupported_file')

  const matchedProductRowIndices = new Set(matchedImages.map((m) => m.matchedProductRowIndex))

  const unmatchedProducts: UnmatchedProductResult[] = []
  const invalidProducts: ProductRecord[] = []
  const duplicateProducts: ProductRecord[] = []

  for (const p of products) {
    if (p.status === 'invalid_product_key') {
      invalidProducts.push(p)
    } else if (p.status === 'duplicate_product_key') {
      duplicateProducts.push(p)
    } else if (p.status === 'valid') {
      if (!matchedProductRowIndices.has(p.rowIndex)) {
        unmatchedProducts.push({
          product: p,
          status: 'unmatched_product',
          reason: 'No images matched this product',
        })
      }
    }
  }

  const validProductsCount = products.filter((p) => p.status === 'valid').length

  const summary: MatchingSummary = {
    totalProducts: products.length,
    validProducts: validProductsCount,
    invalidProducts: invalidProducts.length,
    duplicateProducts: duplicateProducts.length,
    totalImages: inventory.totalFileCount,
    supportedImages: inventory.supportedFileCount,
    unsupportedFiles: inventory.unsupportedFileCount,
    matchedImages: matchedImages.length,
    unmatchedImages: unmatchedImages.length,
    ambiguousMatches: ambiguousImages.length,
    unmatchedProducts: unmatchedProducts.length,
  }

  return {
    products,
    imageResults: finalizedImageResults,
    matchedImages,
    unmatchedImages,
    ambiguousImages,
    unmatchedProducts,
    invalidProducts,
    duplicateProducts,
    unsupportedFiles,
    summary,
  }
}
