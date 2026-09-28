import { describe, expect, it } from 'vitest'
import {
  normalizeHeaders,
  processRawMatrixToSheetData,
  suggestColumnMapping,
  validatePrimaryIdentifierColumn,
} from './table'

describe('Table and Header Normalization', () => {
  it('normalizes headers and disambiguates duplicates', () => {
    const raw = ['SKU', 'SKU', '  Barcode  ', '', 'Price']
    const normalized = normalizeHeaders(raw)
    expect(normalized).toEqual(['SKU', 'SKU (2)', 'Barcode', 'Column 4', 'Price'])
  })

  it('skips leading blank lines before the header row', () => {
    const matrix = [
      ['', '  ', ''],
      ['', ''],
      ['SKU', 'Ürün Adı', 'Barkod'],
      ['ABC-1', 'Gömlek', '00123'],
      ['ABC-2', 'Pantolon', '00124'],
    ]

    const result = processRawMatrixToSheetData('Sheet1', matrix)
    expect(result.headers).toEqual(['SKU', 'Ürün Adı', 'Barkod'])
    expect(result.totalRowCount).toBe(2)
    expect(result.rows[0]).toEqual({
      SKU: 'ABC-1',
      'Ürün Adı': 'Gömlek',
      Barkod: '00123',
    })
  })

  it('preserves leading zeroes and trims surrounding whitespace in row records', () => {
    const matrix = [
      ['SKU', 'Barcode'],
      ['  ABC-100  ', '  001234567890  '],
    ]

    const result = processRawMatrixToSheetData('TestSheet', matrix)
    expect(result.rows[0]?.['SKU']).toBe('ABC-100')
    expect(result.rows[0]?.['Barcode']).toBe('001234567890')
  })

  it('throws an actionable error if matrix contains no non-empty rows', () => {
    const emptyMatrix = [
      ['', ''],
      ['   ', ''],
    ]

    expect(() => processRawMatrixToSheetData('Empty', emptyMatrix)).toThrow(
      'The spreadsheet contains no readable header or data rows.',
    )
  })

  it('validates a valid primary identifier column', () => {
    const headers = ['SKU', 'Barcode']
    const rows = [
      { SKU: 'ABC-1', Barcode: '869001' },
      { SKU: 'ABC-2', Barcode: '869002' },
    ]

    const validation = validatePrimaryIdentifierColumn('SKU', headers, rows)
    expect(validation.isValid).toBe(true)
    expect(validation.validRowsCount).toBe(2)
    expect(validation.blankRowsCount).toBe(0)
    expect(validation.duplicateKeysCount).toBe(0)
  })

  it('detects blank values and duplicates in primary identifier column', () => {
    const headers = ['SKU', 'Barcode']
    const rows = [
      { SKU: 'ABC-1', Barcode: '869001' },
      { SKU: '  ', Barcode: '869002' },
      { SKU: 'abc-1', Barcode: '869003' }, // Case-insensitive duplicate of ABC-1
      { SKU: 'ABC-3', Barcode: '869004' },
    ]

    const validation = validatePrimaryIdentifierColumn('SKU', headers, rows)
    expect(validation.isValid).toBe(true)
    expect(validation.validRowsCount).toBe(3)
    expect(validation.blankRowsCount).toBe(1)
    expect(validation.duplicateKeysCount).toBe(2) // 'ABC-1' and 'abc-1'
  })

  it('fails validation when all rows are blank in selected column', () => {
    const headers = ['SKU', 'Barcode']
    const rows = [
      { SKU: '', Barcode: '869001' },
      { SKU: '   ', Barcode: '869002' },
    ]

    const validation = validatePrimaryIdentifierColumn('SKU', headers, rows)
    expect(validation.isValid).toBe(false)
    expect(validation.errorMessage).toContain('contains no values')
  })

  it('fails validation when column name is empty or not in headers', () => {
    const headers = ['SKU', 'Barcode']
    const rows = [{ SKU: 'ABC-1', Barcode: '869001' }]

    const emptyVal = validatePrimaryIdentifierColumn('', headers, rows)
    expect(emptyVal.isValid).toBe(false)
    expect(emptyVal.errorMessage).toBe('Please select a primary product identifier column.')

    const missingVal = validatePrimaryIdentifierColumn('NonExistent', headers, rows)
    expect(missingVal.isValid).toBe(false)
    expect(missingVal.errorMessage).toContain('does not exist')
  })

  it('auto-suggests optional mappings but leaves primary identifier unselected', () => {
    const turkishHeaders = ['Stok Kodu', 'Ürün Adı', 'Barkod', 'Görsel Adı']
    const mapping = suggestColumnMapping(turkishHeaders)

    expect(mapping.primaryKeyColumn).toBe('')
    expect(mapping.skuColumn).toBe('Stok Kodu')
    expect(mapping.barcodeColumn).toBe('Barkod')
    expect(mapping.currentFilenameColumn).toBe('Görsel Adı')
  })

  it('never guesses the primary identifier from the first arbitrary column', () => {
    const mapping = suggestColumnMapping(['Ürün Adı', 'Renk', 'Fiyat'])
    expect(mapping.primaryKeyColumn).toBe('')
  })
})
