export type CsvDelimiter = ',' | ';' | '\t'

export type SpreadsheetFileType = 'csv' | 'xlsx'

export interface ParsedSheetData {
  readonly sheetName: string
  readonly headers: readonly string[]
  readonly rows: readonly Record<string, string>[]
  readonly totalRowCount: number
  readonly previewRows: readonly Record<string, string>[]
}

export interface ParsedSpreadsheet {
  readonly fileName: string
  readonly fileSize: number
  readonly fileType: SpreadsheetFileType
  readonly detectedDelimiter?: CsvDelimiter
  readonly sheetNames: readonly string[]
  readonly activeSheetName: string
  readonly currentSheet: ParsedSheetData
  /**
   * Internal reference for multi-sheet XLSX switching without re-parsing array buffer.
   */
  readonly _workbookRef?: unknown
}

export interface ColumnMapping {
  primaryKeyColumn: string
  skuColumn: string | null
  barcodeColumn: string | null
  currentFilenameColumn: string | null
}

export interface PrimaryIdentifierValidation {
  readonly isValid: boolean
  readonly totalRows: number
  readonly validRowsCount: number
  readonly blankRowsCount: number
  readonly duplicateKeysCount: number
  readonly errorMessage?: string
}
