import type { MatchingEngineResult } from '../types/matching'
import type { OutputImagePlan, OutputPlan } from '../types/output'

/**
 * Sanitizes a primary identifier for filesystem safety according to PicBatch rules.
 *
 * Rules:
 * 1. Trim surrounding whitespace.
 * 2. Replace filesystem-unsafe characters (/, \, :, *, ?, ", <, >, |, and ASCII control chars U+0000-U+001F, U+007F) with '-'.
 * 3. Collapse consecutive unsafe characters into a single '-' (e.g. ABC///DEF -> ABC-DEF).
 * 4. Remove trailing spaces and periods.
 * 5. Preserve Turkish characters, internal spaces, punctuation, and all other Unicode without transliteration.
 * 6. Return null if sanitization leaves an empty string.
 */
export function sanitizeIdentifierForFilename(rawIdentifier: string): string | null {
  if (!rawIdentifier) return null
  let result = rawIdentifier.trim()
  if (!result) return null

  // Replace unsafe characters (including ASCII controls 0x00-0x1F and 0x7F)
  // The '+' collapses consecutive runs of unsafe characters into a single '-'
  // eslint-disable-next-line no-control-regex
  result = result.replace(/[/\\:*?"<>|\x00-\x1F\x7F]+/g, '-')

  // Remove trailing spaces and periods
  result = result.replace(/[\s.]+$/, '')

  if (!result) return null
  return result
}

/**
 * Builds a deterministic OutputPlan for all images in the matching engine result.
 *
 * For matched images:
 * - Sanitizes the primary product identifier.
 * - Generates proposed output filenames: `IDENTIFIER-SEQ.ext` where ext is lowercase.
 * - Resolves output path: `images/IDENTIFIER-SEQ.ext`.
 * - Detects output collisions: if multiple images resolve to the same output path,
 *   all affected files are marked `output_collision` and excluded from safe output.
 *
 * Unmatched, ambiguous, duplicate, invalid, or unsupported files retain their failure state
 * and do not receive proposed output filenames.
 */
export function buildOutputPlan(result: MatchingEngineResult): OutputPlan {
  // Step 1: Initial candidate planning for each image result
  const initialPlans: OutputImagePlan[] = result.imageResults.map((img) => {
    if (img.status !== 'matched') {
      return {
        item: img.item,
        matchedProduct: img.matchedProduct ?? null,
        originalIdentifier: img.primaryIdentifier,
        sanitizedIdentifier: null,
        sequenceNumber: null,
        sourceExtension: img.item.extension.toLowerCase().replace(/^\./, ''),
        proposedFilename: null,
        proposedOutputPath: null,
        status: img.status,
        matchMethod: img.matchMethod,
        reason: img.reason ?? '—',
        isProblem: true,
      }
    }

    const rawId = img.matchedProduct?.primaryIdentifierRaw ?? img.primaryIdentifier ?? ''
    const sanitized = sanitizeIdentifierForFilename(rawId)

    if (!sanitized) {
      return {
        item: img.item,
        matchedProduct: img.matchedProduct ?? null,
        originalIdentifier: rawId,
        sanitizedIdentifier: null,
        sequenceNumber: img.sequenceNumber ?? null,
        sourceExtension: img.item.extension.toLowerCase().replace(/^\./, ''),
        proposedFilename: null,
        proposedOutputPath: null,
        status: 'invalid_product_key',
        matchMethod: img.matchMethod,
        reason: 'Primary identifier becomes empty after filename sanitization',
        isProblem: true,
      }
    }

    const seq = img.sequenceNumber ?? 1
    const ext = img.item.extension.toLowerCase().replace(/^\./, '')
    const proposedFilename = `${sanitized}-${seq}.${ext}`
    const proposedOutputPath = `images/${proposedFilename}`

    return {
      item: img.item,
      matchedProduct: img.matchedProduct ?? null,
      originalIdentifier: rawId,
      sanitizedIdentifier: sanitized,
      sequenceNumber: seq,
      sourceExtension: ext,
      proposedFilename,
      proposedOutputPath,
      status: 'matched',
      matchMethod: img.matchMethod,
      reason: '—',
      isProblem: false,
    }
  })

  // Step 2: Collision detection among candidate matched items
  const pathCounts = new Map<string, number>()
  for (const plan of initialPlans) {
    if (plan.status === 'matched' && plan.proposedOutputPath) {
      const normalizedPath = plan.proposedOutputPath.toLowerCase()
      pathCounts.set(normalizedPath, (pathCounts.get(normalizedPath) ?? 0) + 1)
    }
  }

  const finalPlans: OutputImagePlan[] = initialPlans.map((plan) => {
    if (plan.status === 'matched' && plan.proposedOutputPath) {
      const normalizedPath = plan.proposedOutputPath.toLowerCase()
      const count = pathCounts.get(normalizedPath) ?? 0
      if (count > 1) {
        return {
          ...plan,
          status: 'output_collision',
          isProblem: true,
          reason: `Multiple images resolve to the same output path: ${plan.proposedOutputPath}`,
        }
      }
    }
    return plan
  })

  const safeOutputCount = finalPlans.filter((p) => p.status === 'matched').length
  const collisionCount = finalPlans.filter((p) => p.status === 'output_collision').length
  const problemCount = finalPlans.filter((p) => p.isProblem).length

  return {
    imagePlans: finalPlans,
    safeOutputCount,
    collisionCount,
    problemCount,
  }
}
