import type {
  ParsedSpreadsheet,
  ParsedSheetData,
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

function requireUsableDataRows(sheet: ParsedSheetData, context: string): ParsedSheetData {
  if (sheet.totalRowCount === 0) {
    throw new Error(`${context} contains a header row but no usable data rows.`)
  }
  return sheet
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
    const currentSheet = requireUsableDataRows(
      processRawMatrixToSheetData(file.name, rawRows),
      `The CSV file "${file.name}"`,
    )

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

  // Select the first worksheet that can actually provide headers and at least one data row.
  let activeSheetName: string | null = null
  let currentSheet: ParsedSheetData | null = null

  for (const name of sheetNames) {
    try {
      const candidateSheet = requireUsableDataRows(
        processRawMatrixToSheetData(name, xlsxResult.getRawSheetRows(name)),
        `Worksheet "${name}"`,
      )
      activeSheetName = name
      currentSheet = candidateSheet
      break
    } catch {
      // Keep scanning. A workbook often contains cover/instructions/blank sheets before catalog data.
    }
  }

  if (!activeSheetName || !currentSheet) {
    throw new Error('Excel workbook contains no usable worksheets with a header row and data rows.')
  }

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
  const currentSheet = requireUsableDataRows(
    processRawMatrixToSheetData(targetSheetName, rawRows),
    `Worksheet "${targetSheetName}"`,
  )

  return {
    ...spreadsheet,
    activeSheetName: targetSheetName,
    currentSheet,
  }
}
