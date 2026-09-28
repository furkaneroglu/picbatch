import { describe, expect, it } from 'vitest'
import { detectCsvDelimiter, parseCsv, stripBom } from './csv'

describe('CSV Parser and Delimiter Detection', () => {
  it('strips UTF-8 Byte Order Mark (BOM)', () => {
    const withBom = '\uFEFFSKU,Name,Price\nABC-1,Widget,10.00'
    expect(stripBom(withBom)).toBe('SKU,Name,Price\nABC-1,Widget,10.00')
    expect(stripBom('SKU,Name,Price')).toBe('SKU,Name,Price')
  })

  it('detects comma delimiter', () => {
    const csv = 'SKU,Product Name,Barcode\nABC-101,T-Shirt Blue,8690001001\nABC-102,T-Shirt Red,8690001002'
    expect(detectCsvDelimiter(csv)).toBe(',')
  })

  it('detects semicolon delimiter commonly used in Turkish/European Excel exports', () => {
    const csv = 'SKU;Ürün Adı;Barkod;Fiyat\nABC-101;Mavi Tişört;001234567890;12,50\nABC-102;Kırmızı Tişört;001234567891;15,00'
    expect(detectCsvDelimiter(csv)).toBe(';')
  })

  it('detects tab delimiter', () => {
    const tsv = 'SKU\tProduct Name\tBarcode\nABC-101\tT-Shirt Blue\t8690001001\nABC-102\tT-Shirt Red\t8690001002'
    expect(detectCsvDelimiter(tsv)).toBe('\t')
  })

  it('detects semicolon delimiter even when comma decimals are present inside cells', () => {
    const csv = 'Stok Kodu;Fiyat;Ağırlık\nTR-01;12,50;0,75\nTR-02;99,90;1,20'
    expect(detectCsvDelimiter(csv)).toBe(';')
  })

  it('preserves Turkish characters in CSV parsing', () => {
    const turkishCsv = 'SKU;Ürün Adı;Açıklama\nTR-01;Işık Şemsiyesi;Çok Renkli & Kaliteli\nTR-02;Özel İğne;Güneş Koruması'
    const rows = parseCsv(turkishCsv)
    expect(rows).toEqual([
      ['SKU', 'Ürün Adı', 'Açıklama'],
      ['TR-01', 'Işık Şemsiyesi', 'Çok Renkli & Kaliteli'],
      ['TR-02', 'Özel İğne', 'Güneş Koruması'],
    ])
  })

  it('preserves leading-zero identifiers as strings', () => {
    const csv = 'SKU,Barcode\nABC-1,001234567890\nABC-2,000987654321'
    const rows = parseCsv(csv)
    expect(rows[1]?.[1]).toBe('001234567890')
    expect(rows[2]?.[1]).toBe('000987654321')
  })

  it('handles quoted fields with embedded commas and quotes', () => {
    const csv = 'SKU,Description,Price\nABC-1,"Widget, with comma and ""quotes""",25.00'
    const rows = parseCsv(csv)
    expect(rows[1]).toEqual(['ABC-1', 'Widget, with comma and "quotes"', '25.00'])
  })

  it('handles multiline quoted values', () => {
    const csv = 'SKU,Notes\nABC-1,"Line 1\nLine 2"'
    const rows = parseCsv(csv)
    expect(rows[1]).toEqual(['ABC-1', 'Line 1\nLine 2'])
  })

  it('handles empty or whitespace-only inputs gracefully', () => {
    expect(parseCsv('')).toEqual([])
    expect(detectCsvDelimiter('')).toBe(',')
  })
})
