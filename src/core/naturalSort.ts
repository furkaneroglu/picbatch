/**
 * Pure deterministic, locale-independent natural comparison.
 * Sorts numeric chunks numerically (e.g. '2' before '10') and text chunks
 * case-insensitively with deterministic tie-breaking.
 *
 * Does not rely on localeCompare or OS locale.
 */
export function deterministicNaturalCompare(a: string, b: string): number {
  if (a === b) return 0

  const regex = /(\d+|\D+)/g
  const tokensA = a.match(regex) || []
  const tokensB = b.match(regex) || []

  const minLen = Math.min(tokensA.length, tokensB.length)

  for (let i = 0; i < minLen; i++) {
    const tA = tokensA[i] ?? ''
    const tB = tokensB[i] ?? ''

    const isNumA = /^\d+$/.test(tA)
    const isNumB = /^\d+$/.test(tB)

    if (isNumA && isNumB) {
      try {
        const bA = BigInt(tA)
        const bB = BigInt(tB)
        if (bA !== bB) {
          return bA < bB ? -1 : 1
        }
      } catch {
        // Fallback to string length comparison if BigInt parsing fails
        if (tA.length !== tB.length) {
          return tA.length < tB.length ? -1 : 1
        }
      }

      // If numeric values are identical (e.g. '02' vs '2'), fewer leading zeroes first
      if (tA.length !== tB.length) {
        return tA.length - tB.length
      }
    } else {
      const lowA = tA.toLowerCase()
      const lowB = tB.toLowerCase()

      if (lowA !== lowB) {
        return lowA < lowB ? -1 : 1
      }

      // Tie-break case differences deterministically (lowercase vs uppercase)
      if (tA !== tB) {
        return tA < tB ? -1 : 1
      }
    }
  }

  if (tokensA.length !== tokensB.length) {
    return tokensA.length - tokensB.length
  }

  // Final deterministic tie-breaker
  return a < b ? -1 : (a > b ? 1 : 0)
}

/**
 * Sorts an array of items with a relativePath or key deterministically.
 */
export function stableNaturalSort<T>(
  items: readonly T[],
  keyExtractor: (item: T) => string,
): T[] {
  return [...items].sort((a, b) => {
    const keyA = keyExtractor(a)
    const keyB = keyExtractor(b)
    return deterministicNaturalCompare(keyA, keyB)
  })
}
