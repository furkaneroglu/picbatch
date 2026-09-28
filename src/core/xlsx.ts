import * as XLSX from 'xlsx'

export interface ParsedXlsxResult {
  readonly sheetNames: readonly string[]
  readonly getRawSheetRows: (sheetName: string) => string[][]
  readonly workbook: XLSX.WorkBook
}

/**
 * Parses XLSX ArrayBuffer into a SheetJS workbook.
 * Does not evaluate formulas and extracts cell text without numeric coercion.
 */
export function parseXlsxWorkbook(data: ArrayBuffer): ParsedXlsxResult {
  if (data.byteLength < 4) {
    throw new Error('Failed to parse Excel workbook: File is too small to be a valid .xlsx spreadsheet.')
  }

  // Validate ZIP / OpenXML header (PK\x03\x04 or PK\x05\x06)
  const header = new Uint8Array(data.slice(0, 2))
  if (header[0] !== 0x50 || header[1] !== 0x4b) {
    throw new Error('Failed to parse Excel workbook: File does not contain a valid .xlsx signature.')
  }

  let workbook: XLSX.WorkBook

  try {
    workbook = XLSX.read(data, {
      type: 'array',
      raw: false, // Reads formatted string representation (preserves leading zeroes)
      cellText: true,
      cellFormula: false, // Does not evaluate formulas
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to parse Excel workbook: ${message}`, { cause: err })
  }

  const sheetNames = workbook.SheetNames

  if (!sheetNames || sheetNames.length === 0) {
    throw new Error('Excel workbook contains no sheets.')
  }

  const getRawSheetRows = (sheetName: string): string[][] => {
    const ws = workbook.Sheets[sheetName]
    if (!ws) {
      return []
    }

    // Convert sheet to 2D array with raw: false to ensure text output
    const rawMatrix = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      raw: false,
      defval: '',
    }) as unknown[][]

    return rawMatrix.map((row) =>
      Array.isArray(row) ? row.map((cell) => String(cell ?? '')) : [],
    )
  }

  return {
    sheetNames,
    getRawSheetRows,
    workbook,
  }
}
