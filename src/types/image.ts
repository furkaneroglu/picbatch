export type SupportedImageExtension = 'jpg' | 'jpeg' | 'png' | 'webp'

export type ImageSourceMethod = 'folder' | 'zip'

export interface ImageInventoryItem {
  readonly id: string
  readonly originalFilename: string
  readonly basename: string
  readonly stem: string
  readonly extension: string
  readonly relativePath: string
  readonly fileSize: number
  readonly mimeType?: string
  readonly sourceMethod: ImageSourceMethod
  readonly isSupported: boolean
  readonly hasDuplicatePath?: boolean
  readonly fileRef: File | Blob
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
  readonly totalSupportedBytes: number
  readonly hasLargeDatasetWarning: boolean
}
