import type {
  ParsedSpreadsheet,
  SpreadsheetFileType,
} from '../types/spreadsheet'
import { detectCsvDelimiter, parseCsv } from './csv'
import { processRawMatrixToSheetData } from './table'
import { parseXlsxWorkbook, type ParsedXlsxResult } from './xlsx'

/**
 * Extracts and validates file extension.
 */
export function getSpreadsheetFileType(fileName: string): SpreadsheetFileType {
  const lowerName = fileName.toLowerCase()

  if (lowerName.endsWith('.csv')) {
    return 'csv'
  }
  if (lowerName.endsWith('.xlsx')) {
    return 'xlsx'
  }
  if (lowerName.endsWith('.xls')) {
    throw new Error(
      'Legacy .xls format is not supported. Please convert and save your spreadsheet as .xlsx or .csv.',
    )
  }

  throw new Error(
    `Unsupported file type for "${fileName}". Only .csv and .xlsx spreadsheets are supported.`,
  )
}

/**
 * High-level browser loader that parses a selected File locally into a ParsedSpreadsheet.
 * Never performs network requests or uploads.
 */
export async function parseSpreadsheetFile(file: File): Promise<ParsedSpreadsheet> {
  if (file.size === 0) {
    throw new Error(`The selected file "${file.name}" is empty (0 bytes).`)
  }

  const fileType = getSpreadsheetFileType(file.name)

  if (fileType === 'csv') {
    const rawText = await file.text()

    if (!rawText.trim()) {
      throw new Error(`The CSV file "${file.name}" is empty.`)
    }

    const detectedDelimiter = detectCsvDelimiter(rawText)
    const rawRows = parseCsv(rawText, detectedDelimiter)
    const currentSheet = processRawMatrixToSheetData(file.name, rawRows)

    return {
      fileName: file.name,
      fileSize: file.size,
      fileType: 'csv',
      detectedDelimiter,
      sheetNames: [file.name],
      activeSheetName: file.name,
      currentSheet,
    }
  }

  // Handle XLSX
  const arrayBuffer = await file.arrayBuffer()
  const xlsxResult = parseXlsxWorkbook(arrayBuffer)
  const sheetNames = xlsxResult.sheetNames

  // Find first sheet that has rows, or fallback to first sheet
  let activeSheetName = sheetNames[0] ?? 'Sheet1'
  let rawRows = xlsxResult.getRawSheetRows(activeSheetName)

  // Try finding a sheet with content if first is empty
  if (rawRows.length === 0 && sheetNames.length > 1) {
    for (const name of sheetNames) {
      const candidateRows = xlsxResult.getRawSheetRows(name)
      if (candidateRows.length > 0) {
        activeSheetName = name
        rawRows = candidateRows
        break
      }
    }
  }

  const currentSheet = processRawMatrixToSheetData(activeSheetName, rawRows)

  return {
    fileName: file.name,
    fileSize: file.size,
    fileType: 'xlsx',
    sheetNames,
    activeSheetName,
    currentSheet,
    _workbookRef: xlsxResult,
  }
}

/**
 * Switches the active sheet for a multi-sheet XLSX file.
 */
export function switchSpreadsheetSheet(
  spreadsheet: ParsedSpreadsheet,
  targetSheetName: string,
): ParsedSpreadsheet {
  if (spreadsheet.fileType !== 'xlsx' || !spreadsheet._workbookRef) {
    return spreadsheet
  }

  const xlsxResult = spreadsheet._workbookRef as ParsedXlsxResult
  const rawRows = xlsxResult.getRawSheetRows(targetSheetName)
  const currentSheet = processRawMatrixToSheetData(targetSheetName, rawRows)

  return {
    ...spreadsheet,
    activeSheetName: targetSheetName,
    currentSheet,
  }
}
