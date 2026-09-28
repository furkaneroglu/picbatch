import type { SupportedImageExtension } from '../types/image'

export const SUPPORTED_IMAGE_EXTENSIONS: readonly SupportedImageExtension[] = [
  'jpg',
  'jpeg',
  'png',
  'webp',
]

/**
 * Normalizes an untrusted file or directory path into a safe relative path:
 * - Converts backslashes `\` to forward slashes `/`
 * - Removes empty and `.` segments
 * - Resolves `..` segments without allowing traversal above the relative root
 * - Strips leading/trailing slashes
 * - Preserves original casing and characters within normal path segments
 */
export function normalizeRelativePath(rawPath: string): string {
  if (!rawPath) return ''

  const unified = rawPath.trim().replace(/\\/g, '/').replace(/\/+/g, '/')
  const segments: string[] = []

  for (const segment of unified.split('/')) {
    if (!segment || segment === '.') continue

    if (segment === '..') {
      segments.pop()
      continue
    }

    segments.push(segment)
  }

  return segments.join('/')
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
