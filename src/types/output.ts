import type { ImageInventoryItem } from './image'
import type { MatchMethod, MatchStatus, ProductRecord } from './matching'

export interface OutputImagePlan {
  readonly item: ImageInventoryItem
  readonly matchedProduct: ProductRecord | null
  readonly originalIdentifier: string | null
  readonly sanitizedIdentifier: string | null
  readonly sequenceNumber: number | null
  readonly sourceExtension: string
  readonly proposedFilename: string | null
  readonly proposedOutputPath: string | null
  readonly status: MatchStatus
  readonly matchMethod: MatchMethod
  readonly reason: string
  readonly isProblem: boolean
}

export interface OutputPlan {
  readonly imagePlans: readonly OutputImagePlan[]
  readonly safeOutputCount: number
  readonly collisionCount: number
  readonly problemCount: number
}

export interface ReportRow {
  readonly rowType: 'image' | 'product'
  readonly sourcePath: string
  readonly sourceFilename: string
  readonly sourceSize: string
  readonly productRowNumber: string
  readonly primaryIdentifier: string
  readonly sanitizedIdentifier: string
  readonly sku: string
  readonly barcode: string
  readonly sequenceNumber: string
  readonly matchMethod: string
  readonly proposedFilename: string
  readonly proposedOutputPath: string
  readonly status: string
  readonly reason: string
}
