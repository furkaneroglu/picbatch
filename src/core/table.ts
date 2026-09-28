import type {
  ColumnMapping,
  ParsedSheetData,
  PrimaryIdentifierValidation,
} from '../types/spreadsheet'

/**
 * Checks whether a row has at least one cell with non-whitespace content.
 */
export function isNonEmptyRow(row: readonly string[]): boolean {
  return row.some((cell) => cell.trim().length > 0)
}

/**
 * Disambiguates duplicate headers and provides fallbacks for blank headers.
 */
export function normalizeHeaders(rawHeaders: readonly string[]): string[] {
  const seenCounts = new Map<string, number>()
  const result: string[] = []

  rawHeaders.forEach((raw, index) => {
    const trimmed = raw.trim().normalize('NFKC')
    const baseName = trimmed.length > 0 ? trimmed : `Column ${index + 1}`

    const currentCount = seenCounts.get(baseName) ?? 0
    if (currentCount === 0) {
      seenCounts.set(baseName, 1)
      result.push(baseName)
    } else {
      const nextCount = currentCount + 1
      seenCounts.set(baseName, nextCount)
      result.push(`${baseName} (${nextCount})`)
    }
  })

  return result
}

/**
 * Normalizes 2D raw string matrix into clean headers and row records.
 * Skips leading blank rows to find the first non-empty row as the header row.
 */
export function processRawMatrixToSheetData(
  sheetName: string,
  rawRows: readonly (readonly string[])[],
): ParsedSheetData {
  // Find first non-empty row as header
  let headerIndex = -1
  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i]
    if (row && isNonEmptyRow(row)) {
      headerIndex = i
      break
    }
  }

  if (headerIndex === -1) {
    throw new Error('The spreadsheet contains no readable header or data rows.')
  }

  const rawHeaderRow = rawRows[headerIndex] ?? []
  const headers = normalizeHeaders(rawHeaderRow)

  if (headers.length === 0) {
    throw new Error('No valid column headers found in the spreadsheet.')
  }

  // Process data rows
  const records: Record<string, string>[] = []

  for (let i = headerIndex + 1; i < rawRows.length; i++) {
    const rawRow = rawRows[i]
    if (!rawRow || !isNonEmptyRow(rawRow)) {
      continue // Skip empty data rows
    }

    const record: Record<string, string> = {}
    for (let c = 0; c < headers.length; c++) {
      const headerName = headers[c]
      if (!headerName) continue
      const rawCell = rawRow[c] ?? ''
      record[headerName] = rawCell.trim()
    }
    records.push(record)
  }

  const previewRows = records.slice(0, 5)

  return {
    sheetName,
    headers,
    rows: records,
    totalRowCount: records.length,
    previewRows,
  }
}

/**
 * Validates the primary identifier column.
 */
export function validatePrimaryIdentifierColumn(
  columnName: string,
  headers: readonly string[],
  rows: readonly Record<string, string>[],
): PrimaryIdentifierValidation {
  const trimmedName = columnName.trim()

  if (!trimmedName) {
    return {
      isValid: false,
      totalRows: rows.length,
      validRowsCount: 0,
      blankRowsCount: rows.length,
      duplicateKeysCount: 0,
      errorMessage: 'Please select a primary product identifier column.',
    }
  }

  if (headers.length > 0 && !headers.includes(trimmedName)) {
    return {
      isValid: false,
      totalRows: rows.length,
      validRowsCount: 0,
      blankRowsCount: rows.length,
      duplicateKeysCount: 0,
      errorMessage: `Selected column "${trimmedName}" does not exist in the spreadsheet.`,
    }
  }

  let validRowsCount = 0
  let blankRowsCount = 0
  const normalizedKeyCounts = new Map<string, number>()

  for (const row of rows) {
    const val = (row[trimmedName] ?? '').trim()
    if (val.length === 0) {
      blankRowsCount++
    } else {
      validRowsCount++
      // Key normalization according to MVP.md: NFKC + case-insensitive
      const normalizedKey = val.normalize('NFKC').toLowerCase()
      normalizedKeyCounts.set(normalizedKey, (normalizedKeyCounts.get(normalizedKey) ?? 0) + 1)
    }
  }

  let duplicateKeysCount = 0
  for (const count of normalizedKeyCounts.values()) {
    if (count > 1) {
      duplicateKeysCount += count
    }
  }

  if (rows.length > 0 && validRowsCount === 0) {
    return {
      isValid: false,
      totalRows: rows.length,
      validRowsCount: 0,
      blankRowsCount,
      duplicateKeysCount: 0,
      errorMessage: `Column "${trimmedName}" contains no values (all rows are blank).`,
    }
  }

  return {
    isValid: true,
    totalRows: rows.length,
    validRowsCount,
    blankRowsCount,
    duplicateKeysCount,
  }
}

/**
 * Suggests optional column mappings based on common English and Turkish header patterns.
 * The primary identifier is intentionally left blank so the user must choose it explicitly.
 */
export function suggestColumnMapping(headers: readonly string[]): ColumnMapping {
  const normalizeForMatch = (h: string) =>
    h
      .toLowerCase()
      .normalize('NFKC')
      .replace(/[\s\-_]/g, '')

  const findHeader = (candidates: readonly string[]): string | null => {
    for (const candidate of candidates) {
      const normCand = normalizeForMatch(candidate)
      const found = headers.find((h) => normalizeForMatch(h) === normCand)
      if (found) return found
    }
    // Substring fallback is only used for optional suggestions. The user still chooses the primary key explicitly.
    for (const candidate of candidates) {
      const normCand = normalizeForMatch(candidate)
      const found = headers.find((h) => normalizeForMatch(h).includes(normCand))
      if (found) return found
    }
    return null
  }

  const skuCandidates = ['sku', 'stokkodu', 'stokno', 'itemnumber', 'stok']
  const barcodeCandidates = ['barcode', 'barkod', 'ean', 'gtin', 'upc']
  const filenameCandidates = [
    'image',
    'filename',
    'imagename',
    'görsel',
    'resim',
    'fotoğraf',
    'fotograf',
    'dosyaadı',
    'dosyaadi',
  ]

  const detectedSku = findHeader(skuCandidates)
  const detectedBarcode = findHeader(barcodeCandidates)
  const detectedFilename = findHeader(filenameCandidates)

  return {
    primaryKeyColumn: '',
    skuColumn: detectedSku,
    barcodeColumn: detectedBarcode,
    currentFilenameColumn: detectedFilename,
  }
}
