import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { parseXlsxWorkbook } from './xlsx'

describe('XLSX Parser via SheetJS CE', () => {
  it('parses valid XLSX array buffer and preserves leading zeroes & Turkish characters', () => {
    const wb = XLSX.utils.book_new()
    const data = [
      ['SKU', 'Barkod', 'Ürün Adı'],
      ['TR-01', '001234567890', 'Güneş Gözlüğü'],
      ['TR-02', '000987654321', 'Işık Şemsiyesi'],
    ]
    const ws = XLSX.utils.aoa_to_sheet(data)
    XLSX.utils.book_append_sheet(wb, ws, 'Ürünler')

    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    const result = parseXlsxWorkbook(buffer)

    expect(result.sheetNames).toEqual(['Ürünler'])
    const rows = result.getRawSheetRows('Ürünler')
    expect(rows).toHaveLength(3)
    expect(rows[0]).toEqual(['SKU', 'Barkod', 'Ürün Adı'])
    expect(rows[1]?.[1]).toBe('001234567890')
    expect(rows[1]?.[2]).toBe('Güneş Gözlüğü')
    expect(rows[2]?.[1]).toBe('000987654321')
  })

  it('supports multi-sheet workbooks and allows extracting rows for any sheet', () => {
    const wb = XLSX.utils.book_new()
    const sheet1 = XLSX.utils.aoa_to_sheet([
      ['SKU', 'Name'],
      ['A-1', 'Product A'],
    ])
    const sheet2 = XLSX.utils.aoa_to_sheet([
      ['Barcode', 'Description'],
      ['869001', 'Description B'],
    ])

    XLSX.utils.book_append_sheet(wb, sheet1, 'Catalog')
    XLSX.utils.book_append_sheet(wb, sheet2, 'Barcodes')

    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    const result = parseXlsxWorkbook(buffer)

    expect(result.sheetNames).toEqual(['Catalog', 'Barcodes'])

    const catalogRows = result.getRawSheetRows('Catalog')
    expect(catalogRows[1]).toEqual(['A-1', 'Product A'])

    const barcodeRows = result.getRawSheetRows('Barcodes')
    expect(barcodeRows[1]).toEqual(['869001', 'Description B'])
  })

  it('throws an error for corrupted array buffer', () => {
    const invalidBuffer = new Uint8Array([1, 2, 3, 4, 5, 6]).buffer
    expect(() => parseXlsxWorkbook(invalidBuffer)).toThrow('Failed to parse Excel workbook')
  })
})
