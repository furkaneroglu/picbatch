import { extractBasename, extractStem } from './path'

export const SUPPORTED_MATCH_BOUNDARIES = ['-', '_', ' ', '('] as const

export type SupportedMatchBoundary = (typeof SUPPORTED_MATCH_BOUNDARIES)[number]

/**
 * Normalizes a product identifier (SKU, barcode, primary key) for deterministic comparison:
 * 1. Converts input to string without numeric coercion.
 * 2. Trims surrounding whitespace.
 * 3. Applies Unicode NFKC normalization.
 * 4. Lowercases using standard locale-independent toLowerCase.
 * 5. Preserves leading zeroes, hyphens, underscores, punctuation, and Turkish characters.
 */
export function normalizeIdentifier(val: unknown): string {
  if (val === null || val === undefined) {
    return ''
  }

  const str = String(val)
  return str.trim().normalize('NFKC').toLowerCase()
}

/**
 * Normalizes a filename basename (including extension) for comparison.
 */
export function normalizeFilenameBasename(filenameOrPath: string): string {
  const basename = extractBasename(filenameOrPath)
  return basename.trim().normalize('NFKC').toLowerCase()
}

/**
 * Normalizes a filename stem (basename without final extension) for comparison.
 */
export function normalizeFilenameStem(filenameOrPath: string): string {
  const stem = extractStem(filenameOrPath)
  return stem.trim().normalize('NFKC').toLowerCase()
}

/**
 * Checks whether a normalized image stem matches a normalized identifier:
 * 1. Stem is exactly equal to the identifier, OR
 * 2. Stem begins with the exact identifier immediately followed by a boundary:
 *    '-', '_', ' ', or '('
 *
 * General substring matching is prohibited.
 */
export function matchesIdentifierBoundary(
  normalizedStem: string,
  normalizedIdentifier: string,
): boolean {
  if (!normalizedStem || !normalizedIdentifier) {
    return false
  }

  // Exact match
  if (normalizedStem === normalizedIdentifier) {
    return true
  }

  // Prefix match with boundary
  if (normalizedStem.startsWith(normalizedIdentifier)) {
    const nextChar = normalizedStem[normalizedIdentifier.length]
    if (nextChar && (SUPPORTED_MATCH_BOUNDARIES as readonly string[]).includes(nextChar)) {
      return true
    }
  }

  return false
}
