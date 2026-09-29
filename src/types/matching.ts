import type { ImageInventoryItem } from './image'

export type MatchStatus =
  | 'matched'
  | 'unmatched_image'
  | 'unmatched_product'
  | 'invalid_product_key'
  | 'duplicate_product_key'
  | 'ambiguous_match'
  | 'output_collision'
  | 'unsupported_file'

export type MatchMethod =
  | 'explicit_filename'
  | 'primary_identifier'
  | 'sku'
  | 'barcode'
  | 'none'

export interface ProductRecord {
  readonly rowIndex: number
  readonly rowNumber: number
  readonly sourceRow: Record<string, string>
  readonly primaryIdentifierRaw: string
  readonly primaryIdentifierNormalized: string
  readonly skuRaw: string | null
  readonly skuNormalized: string | null
  readonly barcodeRaw: string | null
  readonly barcodeNormalized: string | null
  readonly currentFilenameRaw: string | null
  readonly currentFilenameNormalized: string | null
  readonly status: 'valid' | 'invalid_product_key' | 'duplicate_product_key'
  readonly reason?: string
}

export interface ImageMatchResult {
  readonly item: ImageInventoryItem
  readonly status: MatchStatus
  readonly matchMethod: MatchMethod
  readonly matchedProductRowIndex: number | null
  readonly matchedProduct?: ProductRecord
  readonly primaryIdentifier: string | null
  readonly sequenceNumber?: number
  readonly reason?: string
}

export interface UnmatchedProductResult {
  readonly product: ProductRecord
  readonly status: 'unmatched_product'
  readonly reason: string
}

export interface MatchingSummary {
  readonly totalProducts: number
  readonly validProducts: number
  readonly invalidProducts: number
  readonly duplicateProducts: number
  readonly totalImages: number
  readonly supportedImages: number
  readonly unsupportedFiles: number
  readonly matchedImages: number
  readonly unmatchedImages: number
  readonly ambiguousMatches: number
  readonly unmatchedProducts: number
}

export interface MatchingEngineResult {
  readonly products: readonly ProductRecord[]
  readonly imageResults: readonly ImageMatchResult[]
  readonly matchedImages: readonly ImageMatchResult[]
  readonly unmatchedImages: readonly ImageMatchResult[]
  readonly ambiguousImages: readonly ImageMatchResult[]
  readonly unmatchedProducts: readonly UnmatchedProductResult[]
  readonly invalidProducts: readonly ProductRecord[]
  readonly duplicateProducts: readonly ProductRecord[]
  readonly unsupportedFiles: readonly ImageMatchResult[]
  readonly summary: MatchingSummary
}
