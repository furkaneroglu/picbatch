import JSZip from 'jszip'
import type { ImageInventory, ImageInventoryItem } from '../types/image'
import {
  extractBasename,
  extractExtension,
  extractStem,
  getImageMimeType,
  isSupportedImageExtension,
  normalizeRelativePath,
} from './path'

const LARGE_DATASET_COUNT_THRESHOLD = 1000
const LARGE_DATASET_BYTES_THRESHOLD = 1024 * 1024 * 1024 // 1 GB

/**
 * Builds a normalized ImageInventory from an array of File objects (e.g. from folder picker).
 */
export function buildImageInventoryFromFiles(
  files: readonly File[],
  sourceName?: string,
): ImageInventory {
  const pathCounts = new Map<string, number>()

  // First pass: count paths to detect duplicates
  for (const file of files) {
    const rawPath = file.webkitRelativePath || file.name
    const normalized = normalizeRelativePath(rawPath)
    pathCounts.set(normalized, (pathCounts.get(normalized) ?? 0) + 1)
  }

  const items: ImageInventoryItem[] = []
  let totalSupportedBytes = 0

  for (let idx = 0; idx < files.length; idx++) {
    const file = files[idx]
    if (!file) continue

    const rawPath = file.webkitRelativePath || file.name
    const relativePath = normalizeRelativePath(rawPath)
    const basename = extractBasename(relativePath)
    const stem = extractStem(basename)
    const extension = extractExtension(basename)
    const isSupported = isSupportedImageExtension(extension)
    const mimeType = isSupported ? file.type || getImageMimeType(extension) : file.type
    const hasDuplicatePath = (pathCounts.get(relativePath) ?? 0) > 1

    if (isSupported) {
      totalSupportedBytes += file.size
    }

    items.push({
      id: `folder-${idx}-${relativePath}`,
      originalFilename: file.name,
      basename,
      stem,
      extension,
      relativePath,
      fileSize: file.size,
      mimeType,
      sourceMethod: 'folder',
      isSupported,
      hasDuplicatePath,
      fileRef: file,
    })
  }

  const supportedItems = items.filter((item) => item.isSupported)
  const unsupportedItems = items.filter((item) => !item.isSupported)

  // Derive source folder name from first relative path or fallback
  let resolvedSourceName = sourceName || 'Selected Folder'
  if (!sourceName && files.length > 0) {
    const firstRawPath = files[0]?.webkitRelativePath || files[0]?.name || ''
    const normalizedFirst = normalizeRelativePath(firstRawPath)
    if (normalizedFirst.includes('/')) {
      resolvedSourceName = normalizedFirst.split('/')[0] || 'Selected Folder'
    }
  }

  return {
    sourceMethod: 'folder',
    sourceName: resolvedSourceName,
    items,
    supportedItems,
    unsupportedItems,
    totalFileCount: items.length,
    supportedFileCount: supportedItems.length,
    unsupportedFileCount: unsupportedItems.length,
    totalSupportedBytes,
    hasLargeDatasetWarning:
      supportedItems.length > LARGE_DATASET_COUNT_THRESHOLD ||
      totalSupportedBytes > LARGE_DATASET_BYTES_THRESHOLD,
  }
}

/**
 * Builds a normalized ImageInventory by parsing a ZIP archive entirely in the browser.
 */
export async function buildImageInventoryFromZip(zipFile: File): Promise<ImageInventory> {
  if (zipFile.size === 0) {
    throw new Error(`The selected ZIP file "${zipFile.name}" is empty (0 bytes).`)
  }

  const buffer = await zipFile.arrayBuffer()

  // Validate ZIP magic number (PK\x03\x04 or PK\x05\x06)
  if (buffer.byteLength < 4) {
    throw new Error(`The file "${zipFile.name}" is too small to be a valid ZIP archive.`)
  }

  const header = new Uint8Array(buffer.slice(0, 2))
  if (header[0] !== 0x50 || header[1] !== 0x4b) {
    throw new Error(`The file "${zipFile.name}" is not a valid ZIP archive.`)
  }

  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(buffer)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to read ZIP archive: ${message}`, { cause: err })
  }

  const entries = Object.values(zip.files)
  const pathCounts = new Map<string, number>()

  // Filter out directories and collect paths
  const fileEntries: JSZip.JSZipObject[] = []
  for (const entry of entries) {
    if (entry.dir || entry.name.endsWith('/')) {
      continue // Ignore directory entries
    }
    const normalized = normalizeRelativePath(entry.name)
    if (!normalized) continue

    fileEntries.push(entry)
    pathCounts.set(normalized, (pathCounts.get(normalized) ?? 0) + 1)
  }

  const items: ImageInventoryItem[] = []
  let totalSupportedBytes = 0

  for (let idx = 0; idx < fileEntries.length; idx++) {
    const entry = fileEntries[idx]
    if (!entry) continue

    const relativePath = normalizeRelativePath(entry.name)
    const basename = extractBasename(relativePath)
    const stem = extractStem(basename)
    const extension = extractExtension(basename)
    const isSupported = isSupportedImageExtension(extension)
    const hasDuplicatePath = (pathCounts.get(relativePath) ?? 0) > 1

    let fileRef: Blob
    let fileSize: number
    let mimeType: string | undefined

    if (isSupported) {
      mimeType = getImageMimeType(extension)
      const rawBlob = await entry.async('blob')
      fileRef = mimeType ? new Blob([rawBlob], { type: mimeType }) : rawBlob
      fileSize = fileRef.size
      totalSupportedBytes += fileSize
    } else {
      // For unsupported files, do not expand uncompressed bytes into memory
      fileRef = new Blob([])
      fileSize = 0
    }

    items.push({
      id: `zip-${idx}-${relativePath}`,
      originalFilename: basename,
      basename,
      stem,
      extension,
      relativePath,
      fileSize,
      mimeType,
      sourceMethod: 'zip',
      isSupported,
      hasDuplicatePath,
      fileRef,
    })
  }

  const supportedItems = items.filter((item) => item.isSupported)
  const unsupportedItems = items.filter((item) => !item.isSupported)

  if (supportedItems.length === 0) {
    throw new Error(
      `The ZIP archive "${zipFile.name}" contains no supported images (.jpg, .jpeg, .png, .webp). Found ${items.length} unsupported file(s).`,
    )
  }

  return {
    sourceMethod: 'zip',
    sourceName: zipFile.name,
    items,
    supportedItems,
    unsupportedItems,
    totalFileCount: items.length,
    supportedFileCount: supportedItems.length,
    unsupportedFileCount: unsupportedItems.length,
    totalSupportedBytes,
    hasLargeDatasetWarning:
      supportedItems.length > LARGE_DATASET_COUNT_THRESHOLD ||
      totalSupportedBytes > LARGE_DATASET_BYTES_THRESHOLD,
  }
}
