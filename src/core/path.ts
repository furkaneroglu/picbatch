import type { SupportedImageExtension } from '../types/image'

export const SUPPORTED_IMAGE_EXTENSIONS: readonly SupportedImageExtension[] = [
  'jpg',
  'jpeg',
  'png',
  'webp',
]

/**
 * Normalizes a file or directory path:
 * - Converts backslashes `\` to forward slashes `/`
 * - Strips leading `./`
 * - Collapses consecutive slashes
 * - Strips leading and trailing slashes
 * - Preserves original casing and characters
 */
export function normalizeRelativePath(rawPath: string): string {
  if (!rawPath) return ''

  return rawPath
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/\/+/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
}

/**
 * Extracts the filename component from a path (including its extension).
 * Preserves original letter casing.
 */
export function extractBasename(normalizedPath: string): string {
  const cleanPath = normalizeRelativePath(normalizedPath)
  const lastSlashIndex = cleanPath.lastIndexOf('/')
  return lastSlashIndex === -1 ? cleanPath : cleanPath.slice(lastSlashIndex + 1)
}

/**
 * Extracts the file extension in lowercase without leading dot.
 * Returns empty string if no extension is found or for files like `.DS_Store`.
 */
export function extractExtension(filenameOrPath: string): string {
  const basename = extractBasename(filenameOrPath)
  const lastDotIndex = basename.lastIndexOf('.')

  if (lastDotIndex <= 0 || lastDotIndex === basename.length - 1) {
    return ''
  }

  return basename.slice(lastDotIndex + 1).toLowerCase()
}

/**
 * Extracts the stem (filename without extension) from a basename or path.
 */
export function extractStem(filenameOrPath: string): string {
  const basename = extractBasename(filenameOrPath)
  const lastDotIndex = basename.lastIndexOf('.')

  if (lastDotIndex <= 0) {
    return basename
  }

  return basename.slice(0, lastDotIndex)
}

/**
 * Checks if the given extension is one of the supported image formats:
 * jpg, jpeg, png, webp (case-insensitive).
 */
export function isSupportedImageExtension(extension: string): extension is SupportedImageExtension {
  const lowerExt = extension.toLowerCase().replace(/^\./, '')
  return (SUPPORTED_IMAGE_EXTENSIONS as readonly string[]).includes(lowerExt)
}

/**
 * Returns the MIME type corresponding to a supported image extension.
 */
export function getImageMimeType(extension: string): string | undefined {
  const lowerExt = extension.toLowerCase().replace(/^\./, '')

  switch (lowerExt) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'webp':
      return 'image/webp'
    default:
      return undefined
  }
}
