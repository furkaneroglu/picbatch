import type { CsvDelimiter } from '../types/spreadsheet'

const SUPPORTED_DELIMITERS: readonly CsvDelimiter[] = [',', ';', '\t']

/**
 * Strips UTF-8 Byte Order Mark (BOM) if present at the beginning of the text.
 */
export function stripBom(text: string): string {
  if (text.length > 0 && text.charCodeAt(0) === 0xFEFF) {
    return text.slice(1)
  }
  return text
}

/**
 * Counts occurrences of candidate delimiters outside of double quotes across sample lines.
 */
export function detectCsvDelimiter(rawText: string): CsvDelimiter {
  const cleanText = stripBom(rawText)
  const lines = cleanText
    .split(/\r\n|\n|\r/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 20)

  if (lines.length === 0) {
    return ','
  }

  // Count delimiter occurrences outside quotes for each sample line
  const delimiterScores = SUPPORTED_DELIMITERS.map((delimiter) => {
    const countsPerLine: number[] = []

    for (const line of lines) {
      let inQuotes = false
      let count = 0

      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        if (char === '"') {
          // Check for escaped quote inside quotes ("")
          if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
            i++ // Skip next quote
          } else {
            inQuotes = !inQuotes
          }
        } else if (!inQuotes && char === delimiter) {
          count++
        }
      }

      countsPerLine.push(count)
    }

    const totalCount = countsPerLine.reduce((sum, c) => sum + c, 0)
    const nonZeroLines = countsPerLine.filter((c) => c > 0).length

    // If never occurs, score is 0
    if (totalCount === 0 || nonZeroLines === 0) {
      return { delimiter, score: 0, totalCount, consistency: 0 }
    }

    // Measure consistency: ideally all non-empty lines have the same count
    const firstCount = countsPerLine[0] ?? 0
    const allSame = countsPerLine.every((c) => c === firstCount && c > 0)
    const consistency = nonZeroLines / countsPerLine.length

    // Score combines line coverage, uniformity, and total count
    let score = consistency * 100
    if (allSame && firstCount > 0) {
      score += 500
    }
    score += totalCount

    return { delimiter, score, totalCount, consistency }
  })

  // Sort by score descending
  delimiterScores.sort((a, b) => b.score - a.score)

  const bestMatch = delimiterScores[0]
  if (bestMatch && bestMatch.totalCount > 0) {
    return bestMatch.delimiter
  }

  return ','
}

/**
 * Parses raw CSV string into a 2D array of string values adhering to RFC-4180 rules.
 * Handles quoted fields, escaped quotes, multiline fields, and custom delimiters.
 */
export function parseCsv(rawText: string, delimiter?: CsvDelimiter): string[][] {
  const text = stripBom(rawText)
  const actualDelimiter = delimiter ?? detectCsvDelimiter(text)

  const rows: string[][] = []
  let currentRow: string[] = []
  let currentField = ''
  let inQuotes = false
  let i = 0
  const len = text.length

  while (i < len) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < len && text[i + 1] === '"') {
          // Escaped quote ("")
          currentField += '"'
          i += 2
          continue
        } else {
          // End of quoted section
          inQuotes = false
          i++
          continue
        }
      } else {
        currentField += char
        i++
        continue
      }
    } else {
      if (char === '"') {
        inQuotes = true
        i++
        continue
      } else if (char === actualDelimiter) {
        currentRow.push(currentField)
        currentField = ''
        i++
        continue
      } else if (char === '\r') {
        if (i + 1 < len && text[i + 1] === '\n') {
          i++
        }
        currentRow.push(currentField)
        currentField = ''
        rows.push(currentRow)
        currentRow = []
        i++
        continue
      } else if (char === '\n') {
        currentRow.push(currentField)
        currentField = ''
        rows.push(currentRow)
        currentRow = []
        i++
        continue
      } else {
        currentField += char
        i++
        continue
      }
    }
  }

  if (inQuotes) {
    throw new Error('Malformed CSV: unterminated quoted field.')
  }

  // Push remaining field / row
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField)
    rows.push(currentRow)
  }

  return rows
}
