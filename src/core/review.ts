import type { ImageInventoryItem } from '../types/image'
import type {
  MatchingEngineResult,
  MatchingSummary,
  MatchMethod,
  MatchStatus,
  ProductRecord,
} from '../types/matching'

export type ReviewRowType = 'image' | 'product'

export interface ReviewRow {
  readonly id: string
  readonly rowType: ReviewRowType
  readonly sourcePath: string
  readonly filename: string
  readonly productIdentifier: string
  readonly sequenceNumber: number | null
  readonly proposedFilename: string
  readonly matchMethod: MatchMethod
  readonly status: MatchStatus
  readonly reason: string
  readonly isProblem: boolean
  readonly matchedProduct?: ProductRecord
  readonly item?: ImageInventoryItem
}

export type ReviewFilter =
  | 'all'
  | 'matched'
  | 'problems'
  | 'unmatched_image'
  | 'unmatched_product'
  | 'invalid_product_key'
  | 'duplicate_product_key'
  | 'ambiguous_match'
  | 'unsupported_file'
  | 'output_collision'

export interface ReviewStatusCounts {
  readonly total: number
  readonly totalRows: number
  readonly matched: number
  readonly totalProblems: number
  readonly unmatched_image: number
  readonly unmatched_product: number
  readonly invalid_product_key: number
  readonly duplicate_product_key: number
  readonly ambiguous_match: number
  readonly unsupported_file: number
  readonly output_collision: number
}

export interface ReviewProblemCounts {
  readonly totalProblems: number
  readonly unmatchedImages: number
  readonly unmatchedProducts: number
  readonly invalidProducts: number
  readonly duplicateProducts: number
  readonly ambiguousMatches: number
  readonly unsupportedFiles: number
  readonly outputCollisions: number
}

/**
 * Calculates exact status and problem counts directly from visible ReviewRows.
 * Ensures the count displayed beside any filter strictly equals the number of rows
 * returned when that filter is active.
 */
export function getReviewStatusCounts(rows: readonly ReviewRow[]): ReviewStatusCounts {
  let matched = 0
  let totalProblems = 0
  let unmatched_image = 0
  let unmatched_product = 0
  let invalid_product_key = 0
  let duplicate_product_key = 0
  let ambiguous_match = 0
  let unsupported_file = 0
  let output_collision = 0

  for (const row of rows) {
    if (row.isProblem) {
      totalProblems++
    }
    switch (row.status) {
      case 'matched':
        matched++
        break
      case 'unmatched_image':
        unmatched_image++
        break
      case 'unmatched_product':
        unmatched_product++
        break
      case 'invalid_product_key':
        invalid_product_key++
        break
      case 'duplicate_product_key':
        duplicate_product_key++
        break
      case 'ambiguous_match':
        ambiguous_match++
        break
      case 'unsupported_file':
        unsupported_file++
        break
      case 'output_collision':
        output_collision++
        break
    }
  }

  return {
    total: rows.length,
    totalRows: rows.length,
    matched,
    totalProblems,
    unmatched_image,
    unmatched_product,
    invalid_product_key,
    duplicate_product_key,
    ambiguous_match,
    unsupported_file,
    output_collision,
  }
}

/**
 * Formats a MatchStatus into a human-readable display label.
 */
export function formatMatchStatus(status: MatchStatus): string {
  switch (status) {
    case 'matched':
      return 'Matched'
    case 'unmatched_image':
      return 'Unmatched image'
    case 'unmatched_product':
      return 'Unmatched product'
    case 'invalid_product_key':
      return 'Invalid product key'
    case 'duplicate_product_key':
      return 'Duplicate product key'
    case 'ambiguous_match':
      return 'Ambiguous match'
    case 'output_collision':
      return 'Output collision'
    case 'unsupported_file':
      return 'Unsupported file'
  }
}

/**
 * Formats a MatchMethod into a human-readable display label.
 */
export function formatMatchMethod(method: MatchMethod): string {
  switch (method) {
    case 'explicit_filename':
      return 'Explicit filename'
    case 'primary_identifier':
      return 'Primary identifier'
    case 'sku':
      return 'SKU'
    case 'barcode':
      return 'Barcode'
    case 'none':
      return '—'
  }
}

/**
 * Calculates aggregated problem counts from a MatchingSummary.
 */
export function getProblemCounts(summary: MatchingSummary): ReviewProblemCounts {
  const totalProblems =
    summary.unmatchedImages +
    summary.unmatchedProducts +
    summary.invalidProducts +
    summary.duplicateProducts +
    summary.ambiguousMatches +
    summary.unsupportedFiles

  return {
    totalProblems,
    unmatchedImages: summary.unmatchedImages,
    unmatchedProducts: summary.unmatchedProducts,
    invalidProducts: summary.invalidProducts,
    duplicateProducts: summary.duplicateProducts,
    ambiguousMatches: summary.ambiguousMatches,
    unsupportedFiles: summary.unsupportedFiles,
    outputCollisions: 0,
  }
}

/**
 * Transforms MatchingEngineResult into a unified, deterministic list of ReviewRows
 * covering both image-oriented rows and product-oriented problems.
 */
export function buildReviewRows(result: MatchingEngineResult): ReviewRow[] {
  // 1. Image-oriented rows (deterministic inventory order)
  const imageRows: ReviewRow[] = result.imageResults.map((img) => ({
    id: `img-${img.item.id}`,
    rowType: 'image',
    sourcePath: img.item.relativePath,
    filename: img.item.basename,
    productIdentifier: img.primaryIdentifier ?? '—',
    sequenceNumber: img.sequenceNumber ?? null,
    proposedFilename: img.status === 'matched' ? 'Pending naming step' : '—',
    matchMethod: img.matchMethod,
    status: img.status,
    reason: img.reason ?? '—',
    isProblem: img.status !== 'matched',
    matchedProduct: img.matchedProduct,
    item: img.item,
  }))

  // 2. Product-oriented rows: Unmatched products (in spreadsheet row order)
  const unmatchedProductRows: ReviewRow[] = result.unmatchedProducts.map((u) => ({
    id: `prod-unmatched-${u.product.rowIndex}`,
    rowType: 'product',
    sourcePath: '—',
    filename: '—',
    productIdentifier: u.product.primaryIdentifierRaw || '—',
    sequenceNumber: null,
    proposedFilename: '—',
    matchMethod: 'none',
    status: 'unmatched_product',
    reason: u.reason,
    isProblem: true,
    matchedProduct: u.product,
  }))

  // 3. Product-oriented rows: Invalid product keys (in spreadsheet row order)
  const invalidProductRows: ReviewRow[] = result.invalidProducts.map((inv) => ({
    id: `prod-invalid-${inv.rowIndex}`,
    rowType: 'product',
    sourcePath: '—',
    filename: '—',
    productIdentifier: inv.primaryIdentifierRaw.trim() ? inv.primaryIdentifierRaw : '(Blank)',
    sequenceNumber: null,
    proposedFilename: '—',
    matchMethod: 'none',
    status: 'invalid_product_key',
    reason: inv.reason ?? 'Blank primary product identifier',
    isProblem: true,
    matchedProduct: inv,
  }))

  // 4. Product-oriented rows: Duplicate product keys (in spreadsheet row order)
  const duplicateProductRows: ReviewRow[] = result.duplicateProducts.map((dup) => ({
    id: `prod-dup-${dup.rowIndex}`,
    rowType: 'product',
    sourcePath: '—',
    filename: '—',
    productIdentifier: dup.primaryIdentifierRaw || '—',
    sequenceNumber: null,
    proposedFilename: '—',
    matchMethod: 'none',
    status: 'duplicate_product_key',
    reason: dup.reason ?? `Duplicate primary product key: "${dup.primaryIdentifierRaw}"`,
    isProblem: true,
    matchedProduct: dup,
  }))

  return [
    ...imageRows,
    ...unmatchedProductRows,
    ...invalidProductRows,
    ...duplicateProductRows,
  ]
}

/**
 * Filters a list of ReviewRows by filter category/status and optional text query.
 */
export function filterReviewRows(
  rows: readonly ReviewRow[],
  filter: ReviewFilter,
  searchQuery?: string,
): ReviewRow[] {
  let filtered = rows

  if (filter === 'matched') {
    filtered = filtered.filter((r) => r.status === 'matched')
  } else if (filter === 'problems') {
    filtered = filtered.filter((r) => r.isProblem)
  } else if (filter !== 'all') {
    filtered = filtered.filter((r) => r.status === filter)
  }

  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase()
    filtered = filtered.filter((r) => {
      return (
        r.sourcePath.toLowerCase().includes(q) ||
        r.filename.toLowerCase().includes(q) ||
        r.productIdentifier.toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q) ||
        formatMatchStatus(r.status).toLowerCase().includes(q) ||
        formatMatchMethod(r.matchMethod).toLowerCase().includes(q)
      )
    })
  }

  return [...filtered]
}
