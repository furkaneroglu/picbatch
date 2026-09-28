import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import {
  getSpreadsheetFileType,
  parseSpreadsheetFile,
  switchSpreadsheetSheet,
} from './spreadsheet'

describe('Spreadsheet Loader and Dispatcher', () => {
  it('correctly identifies .csv and .xlsx file types', () => {
    expect(getSpreadsheetFileType('catalog.csv')).toBe('csv')
    expect(getSpreadsheetFileType('products.XLSX')).toBe('xlsx')
  })

  it('rejects legacy .xls with a helpful message', () => {
    expect(() => getSpreadsheetFileType('legacy.xls')).toThrow(
      'Legacy .xls format is not supported',
    )
  })

  it('rejects unsupported extensions', () => {
    expect(() => getSpreadsheetFileType('image.png')).toThrow('Unsupported file type')
    expect(() => getSpreadsheetFileType('document.pdf')).toThrow('Unsupported file type')
  })

  it('rejects empty (0 bytes) file', async () => {
    const emptyFile = new File([], 'empty.csv', { type: 'text/csv' })
    await expect(parseSpreadsheetFile(emptyFile)).rejects.toThrow('is empty (0 bytes)')
  })

  it('rejects CSV file with whitespace-only content', async () => {
    const whitespaceFile = new File(['   \n\n  '], 'blank.csv', { type: 'text/csv' })
    await expect(parseSpreadsheetFile(whitespaceFile)).rejects.toThrow('is empty')
  })

  it('parses valid CSV File object', async () => {
    const content = 'SKU;Barkod;Fiyat\nTR-01;00123;10,00\nTR-02;00124;15,00'
    const file = new File([content], 'products.csv', { type: 'text/csv' })

    const parsed = await parseSpreadsheetFile(file)
    expect(parsed.fileName).toBe('products.csv')
    expect(parsed.fileType).toBe('csv')
    expect(parsed.detectedDelimiter).toBe(';')
    expect(parsed.currentSheet.headers).toEqual(['SKU', 'Barkod', 'Fiyat'])
    expect(parsed.currentSheet.totalRowCount).toBe(2)
    expect(parsed.currentSheet.rows[0]?.['Barkod']).toBe('00123')
  })

  it('parses valid XLSX File object and allows switching sheets', async () => {
    const wb = XLSX.utils.book_new()
    const s1 = XLSX.utils.aoa_to_sheet([
      ['SKU', 'Title'],
      ['S1-A', 'Item 1'],
    ])
    const s2 = XLSX.utils.aoa_to_sheet([
      ['Barcode', 'Detail'],
      ['8690001', 'Detail 2'],
    ])
    XLSX.utils.book_append_sheet(wb, s1, 'Main')
    XLSX.utils.book_append_sheet(wb, s2, 'Secondary')

    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    const file = new File([buf], 'catalog.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    const parsed = await parseSpreadsheetFile(file)
    expect(parsed.fileName).toBe('catalog.xlsx')
    expect(parsed.fileType).toBe('xlsx')
    expect(parsed.sheetNames).toEqual(['Main', 'Secondary'])
    expect(parsed.activeSheetName).toBe('Main')
    expect(parsed.currentSheet.headers).toEqual(['SKU', 'Title'])
    expect(parsed.currentSheet.totalRowCount).toBe(1)

    // Switch to Secondary sheet
    const switched = switchSpreadsheetSheet(parsed, 'Secondary')
    expect(switched.activeSheetName).toBe('Secondary')
    expect(switched.currentSheet.headers).toEqual(['Barcode', 'Detail'])
    expect(switched.currentSheet.rows[0]?.['Barcode']).toBe('8690001')
  })
})
