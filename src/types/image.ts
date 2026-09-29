export type SupportedImageExtension = 'jpg' | 'jpeg' | 'png' | 'webp'

export type ImageSourceMethod = 'folder' | 'zip'

export interface ImageInventoryItem {
  readonly id: string
  readonly originalFilename: string
  readonly basename: string
  readonly stem: string
  readonly extension: string
  readonly relativePath: string
  /** Null when size is intentionally not obtained to avoid expanding unsupported ZIP entries. */
  readonly fileSize: number | null
  readonly mimeType?: string
  readonly sourceMethod: ImageSourceMethod
  readonly isSupported: boolean
  readonly hasDuplicatePath?: boolean
  /** Unsupported ZIP entries deliberately retain no extracted Blob to avoid unnecessary memory use. */
  readonly fileRef: File | Blob | null
}

export interface ImageInventory {
  readonly sourceMethod: ImageSourceMethod
  readonly sourceName: string
  readonly items: readonly ImageInventoryItem[]
  readonly supportedItems: readonly ImageInventoryItem[]
  readonly unsupportedItems: readonly ImageInventoryItem[]
  readonly totalFileCount: number
  readonly supportedFileCount: number
  readonly unsupportedFileCount: number
  /** Bytes of the selected source: all selected folder files, or the ZIP archive itself. */
  readonly totalSourceBytes: number
  /** Total extracted/selected bytes for supported images only. */
  readonly totalSupportedBytes: number
  readonly hasLargeDatasetWarning: boolean
}
