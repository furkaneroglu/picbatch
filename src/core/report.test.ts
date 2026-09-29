import { describe, expect, it, vi } from 'vitest'
import {
  REPORT_CSV_HEADERS,
  buildReportRows,
  downloadReportCsv,
  escapeCsvField,
  generateReportCsv,
  serializeReportToCsv,
} from './report'
import type { ImageInventoryItem } from '../types/image'
import type {
  ImageMatchResult,
  MatchingEngineResult,
  ProductRecord,
  UnmatchedProductResult,
} from '../types/matching'
import type { ReportRow } from '../types/output'

function createFakeItem(overrides: Partial<ImageInventoryItem>): ImageInventoryItem {
  const relativePath = overrides.relativePath ?? 'sample.jpg'
  const basename = overrides.basename ?? 'sample.jpg'
  return {
    id: overrides.id ?? 'item-1',
    originalFilename: basename,
    basename,
    stem: overrides.stem ?? 'sample',
    extension: overrides.extension ?? 'jpg',
    relativePath,
    fileSize: 2048,
    sourceMethod: 'folder',
    isSupported: true,
    fileRef: null,
    ...overrides,
  }
}

function createFakeProduct(overrides: Partial<ProductRecord>): ProductRecord {
  const idRaw = overrides.primaryIdentifierRaw ?? 'PROD-1'
  return {
    rowIndex: overrides.rowIndex ?? 0,
    rowNumber: overrides.rowNumber ?? 2,
    sourceRow: { ID: idRaw },
    primaryIdentifierRaw: idRaw,
    primaryIdentifierNormalized: overrides.primaryIdentifierNormalized ?? idRaw.toLowerCase(),
    skuRaw: overrides.skuRaw ?? null,
    skuNormalized: overrides.skuNormalized ?? null,
    barcodeRaw: overrides.barcodeRaw ?? null,
    barcodeNormalized: overrides.barcodeNormalized ?? null,
    currentFilenameRaw: overrides.currentFilenameRaw ?? null,
    currentFilenameNormalized: overrides.currentFilenameNormalized ?? null,
    status: overrides.status ?? 'valid',
    ...overrides,
  }
}

describe('escapeCsvField', () => {
  it('returns empty string unchanged', () => {
    expect(escapeCsvField('')).toBe('')
  })

  it('leaves clean alphanumeric and Unicode text without special characters unquoted', () => {
    expect(escapeCsvField('PROD-100')).toBe('PROD-100')
    expect(escapeCsvField('Çorap-001')).toBe('Çorap-001')
  })

  it('quotes fields containing commas', () => {
    expect(escapeCsvField('Hello, World')).toBe('"Hello, World"')
  })

  it('quotes fields containing double quotes and doubles embedded quotes', () => {
    expect(escapeCsvField('He said "test"')).toBe('"He said ""test"""')
  })

  it('quotes fields containing newline or carriage return characters', () => {
    expect(escapeCsvField('Line 1\nLine 2')).toBe('"Line 1\nLine 2"')
    expect(escapeCsvField('Line 1\r\nLine 2')).toBe('"Line 1\r\nLine 2"')
  })
})

describe('buildReportRows', () => {
  it('builds comprehensive report rows for all supported and problem cases', () => {
    const matchedProd = createFakeProduct({
      rowNumber: 2,
      primaryIdentifierRaw: 'PROD-100',
      skuRaw: 'SKU-A',
      barcodeRaw: '8690001',
    })
    const matchedItem = createFakeItem({
      id: 'm1',
      relativePath: 'folder/PROD-100.jpg',
      basename: 'PROD-100.jpg',
      fileSize: 4096,
    })

    const unmatchedItem = createFakeItem({
      id: 'u1',
      relativePath: 'unknown.png',
      basename: 'unknown.png',
      extension: 'png',
    })

    const ambiguousItem = createFakeItem({
      id: 'a1',
      relativePath: 'ambig.jpg',
      basename: 'ambig.jpg',
    })

    const duplicateItem = createFakeItem({
      id: 'd1',
      relativePath: 'dup.jpg',
      basename: 'dup.jpg',
    })

    const unsupportedItem = createFakeItem({
      id: 'un1',
      relativePath: 'doc.pdf',
      basename: 'doc.pdf',
      extension: 'pdf',
      isSupported: false,
      fileSize: null,
    })

    const imageResults: ImageMatchResult[] = [
      {
        item: matchedItem,
        status: 'matched',
        matchMethod: 'primary_identifier',
        matchedProductRowIndex: 0,
        matchedProduct: matchedProd,
        primaryIdentifier: 'PROD-100',
        sequenceNumber: 1,
      },
      {
        item: unmatchedItem,
        status: 'unmatched_image',
        matchMethod: 'none',
        matchedProductRowIndex: null,
        primaryIdentifier: null,
        reason: 'No matching product identifier found',
      },
      {
        item: ambiguousItem,
        status: 'ambiguous_match',
        matchMethod: 'sku',
        matchedProductRowIndex: null,
        primaryIdentifier: null,
        reason: 'Multiple products matched SKU',
      },
      {
        item: duplicateItem,
        status: 'duplicate_product_key',
        matchMethod: 'none',
        matchedProductRowIndex: null,
        primaryIdentifier: 'DUP-KEY',
        reason: 'Duplicate product key',
      },
      {
        item: unsupportedItem,
        status: 'unsupported_file',
        matchMethod: 'none',
        matchedProductRowIndex: null,
        primaryIdentifier: null,
        reason: 'Unsupported file extension: .pdf',
      },
    ]

    const unmatchedProducts: UnmatchedProductResult[] = [
      {
        product: createFakeProduct({
          rowNumber: 3,
          primaryIdentifierRaw: 'PROD-UNMATCHED',
          skuRaw: 'SKU-UN',
        }),
        status: 'unmatched_product',
        reason: 'No image matched this product',
      },
    ]

    const invalidProducts: ProductRecord[] = [
      createFakeProduct({
        rowNumber: 4,
        primaryIdentifierRaw: '',
        status: 'invalid_product_key',
        reason: 'Blank primary product identifier',
      }),
    ]

    const duplicateProducts: ProductRecord[] = [
      createFakeProduct({
        rowNumber: 5,
        primaryIdentifierRaw: 'PROD-DUP',
        status: 'duplicate_product_key',
        reason: 'Duplicate primary product key: "PROD-DUP"',
      }),
    ]

    const engineResult: MatchingEngineResult = {
      products: [],
      imageResults,
      matchedImages: [imageResults[0]!],
      unmatchedImages: [imageResults[1]!],
      ambiguousImages: [imageResults[2]!],
      unmatchedProducts,
      invalidProducts,
      duplicateProducts,
      unsupportedFiles: [imageResults[4]!],
      summary: {
        totalProducts: 4,
        validProducts: 2,
        invalidProducts: 1,
        duplicateProducts: 1,
        totalImages: 5,
        supportedImages: 4,
        unsupportedFiles: 1,
        matchedImages: 1,
        unmatchedImages: 1,
        ambiguousMatches: 1,
        unmatchedProducts: 1,
      },
    }

    const rows = buildReportRows(engineResult)
    expect(rows.length).toBe(8) // 5 images + 1 unmatched prod + 1 invalid prod + 1 duplicate prod

    // 1. Matched image
    const row0 = rows[0]
    expect(row0?.rowType).toBe('image')
    expect(row0?.sourcePath).toBe('folder/PROD-100.jpg')
    expect(row0?.sourceFilename).toBe('PROD-100.jpg')
    expect(row0?.sourceSize).toBe('4096')
    expect(row0?.productRowNumber).toBe('2')
    expect(row0?.primaryIdentifier).toBe('PROD-100')
    expect(row0?.sanitizedIdentifier).toBe('PROD-100')
    expect(row0?.sku).toBe('SKU-A')
    expect(row0?.barcode).toBe('8690001')
    expect(row0?.sequenceNumber).toBe('1')
    expect(row0?.matchMethod).toBe('primary_identifier')
    expect(row0?.proposedFilename).toBe('PROD-100-1.jpg')
    expect(row0?.proposedOutputPath).toBe('images/PROD-100-1.jpg')
    expect(row0?.status).toBe('matched')
    expect(row0?.reason).toBe('')

    // 2. Unmatched image
    const row1 = rows[1]
    expect(row1?.rowType).toBe('image')
    expect(row1?.sourcePath).toBe('unknown.png')
    expect(row1?.proposedFilename).toBe('')
    expect(row1?.status).toBe('unmatched_image')
    expect(row1?.reason).toContain('No matching product identifier')

    // 3. Ambiguous image
    const row2 = rows[2]
    expect(row2?.rowType).toBe('image')
    expect(row2?.status).toBe('ambiguous_match')
    expect(row2?.proposedFilename).toBe('')

    // 4. Duplicate product key image
    const row3 = rows[3]
    expect(row3?.rowType).toBe('image')
    expect(row3?.status).toBe('duplicate_product_key')

    // 5. Unsupported file
    const row4 = rows[4]
    expect(row4?.rowType).toBe('image')
    expect(row4?.sourceSize).toBe('')
    expect(row4?.status).toBe('unsupported_file')

    // 6. Unmatched product
    const row5 = rows[5]
    expect(row5?.rowType).toBe('product')
    expect(row5?.sourcePath).toBe('')
    expect(row5?.sourceFilename).toBe('')
    expect(row5?.productRowNumber).toBe('3')
    expect(row5?.primaryIdentifier).toBe('PROD-UNMATCHED')
    expect(row5?.sku).toBe('SKU-UN')
    expect(row5?.status).toBe('unmatched_product')
    expect(row5?.reason).toContain('No image matched')

    // 7. Invalid product
    const row6 = rows[6]
    expect(row6?.rowType).toBe('product')
    expect(row6?.productRowNumber).toBe('4')
    expect(row6?.primaryIdentifier).toBe('')
    expect(row6?.status).toBe('invalid_product_key')

    // 8. Duplicate product
    const row7 = rows[7]
    expect(row7?.rowType).toBe('product')
    expect(row7?.productRowNumber).toBe('5')
    expect(row7?.primaryIdentifier).toBe('PROD-DUP')
    expect(row7?.status).toBe('duplicate_product_key')
  })

  it('correctly includes output collision status and reason in report rows', () => {
    const prodSlash = createFakeProduct({ primaryIdentifierRaw: 'A/B' })
    const prodBackslash = createFakeProduct({ primaryIdentifierRaw: 'A\\B' })

    const item1 = createFakeItem({ id: '1', basename: 'a.jpg' })
    const item2 = createFakeItem({ id: '2', basename: 'b.jpg' })

    const engineResult: MatchingEngineResult = {
      products: [],
      imageResults: [
        {
          item: item1,
          status: 'matched',
          matchMethod: 'primary_identifier',
          matchedProductRowIndex: 0,
          matchedProduct: prodSlash,
          primaryIdentifier: 'A/B',
          sequenceNumber: 1,
        },
        {
          item: item2,
          status: 'matched',
          matchMethod: 'primary_identifier',
          matchedProductRowIndex: 1,
          matchedProduct: prodBackslash,
          primaryIdentifier: 'A\\B',
          sequenceNumber: 1,
        },
      ],
      matchedImages: [],
      unmatchedImages: [],
      ambiguousImages: [],
      unmatchedProducts: [],
      invalidProducts: [],
      duplicateProducts: [],
      unsupportedFiles: [],
      summary: {
        totalProducts: 2,
        validProducts: 2,
        invalidProducts: 0,
        duplicateProducts: 0,
        totalImages: 2,
        supportedImages: 2,
        unsupportedFiles: 0,
        matchedImages: 2,
        unmatchedImages: 0,
        ambiguousMatches: 0,
        unmatchedProducts: 0,
      },
    }

    const rows = buildReportRows(engineResult)
    expect(rows.length).toBe(2)
    expect(rows[0]?.status).toBe('output_collision')
    expect(rows[1]?.status).toBe('output_collision')
    expect(rows[0]?.proposedFilename).toBe('A-B-1.jpg')
    expect(rows[1]?.proposedFilename).toBe('A-B-1.jpg')
    expect(rows[0]?.reason).toContain('Multiple images resolve to the same output path: images/A-B-1.jpg')
  })
})

describe('serializeReportToCsv', () => {
  it('prepends UTF-8 BOM as the very first character', () => {
    const csv = serializeReportToCsv([])
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
  })

  it('maintains deterministic header order', () => {
    const csv = serializeReportToCsv([])
    const headerLine = csv.slice(1).split('\r\n')[0]
    expect(headerLine).toBe(REPORT_CSV_HEADERS.join(','))
  })

  it('preserves Turkish and Unicode text accurately', () => {
    const row: ReportRow = {
      rowType: 'image',
      sourcePath: 'img/çorap_01.jpg',
      sourceFilename: 'çorap_01.jpg',
      sourceSize: '1024',
      productRowNumber: '2',
      primaryIdentifier: 'Çorap-001',
      sanitizedIdentifier: 'Çorap-001',
      sku: 'SKU-ŞAPKA-ĞÜİ',
      barcode: '8690001002',
      sequenceNumber: '1',
      matchMethod: 'primary_identifier',
      proposedFilename: 'Çorap-001-1.jpg',
      proposedOutputPath: 'images/Çorap-001-1.jpg',
      status: 'matched',
      reason: 'Eşleşme başarılı',
    }

    const csv = serializeReportToCsv([row])
    expect(csv).toContain('Çorap-001')
    expect(csv).toContain('SKU-ŞAPKA-ĞÜİ')
    expect(csv).toContain('Eşleşme başarılı')
  })

  it('escapes fields containing commas, quotes, and newlines', () => {
    const row: ReportRow = {
      rowType: 'image',
      sourcePath: 'test.jpg',
      sourceFilename: 'test.jpg',
      sourceSize: '100',
      productRowNumber: '2',
      primaryIdentifier: 'ID,WITH,COMMAS',
      sanitizedIdentifier: 'ID,WITH,COMMAS',
      sku: 'SKU "Quotes"',
      barcode: '',
      sequenceNumber: '1',
      matchMethod: 'primary_identifier',
      proposedFilename: 'test-1.jpg',
      proposedOutputPath: 'images/test-1.jpg',
      status: 'ambiguous_match',
      reason: 'Line 1\r\nLine 2',
    }

    const csv = serializeReportToCsv([row])
    expect(csv).toContain('"ID,WITH,COMMAS"')
    expect(csv).toContain('"SKU ""Quotes"""')
    expect(csv).toContain('"Line 1\r\nLine 2"')
  })

  it('handles empty values cleanly without undef/null artifacts', () => {
    const row: ReportRow = {
      rowType: 'product',
      sourcePath: '',
      sourceFilename: '',
      sourceSize: '',
      productRowNumber: '10',
      primaryIdentifier: 'PROD-EMPTY',
      sanitizedIdentifier: '',
      sku: '',
      barcode: '',
      sequenceNumber: '',
      matchMethod: 'none',
      proposedFilename: '',
      proposedOutputPath: '',
      status: 'unmatched_product',
      reason: 'No match',
    }

    const csv = serializeReportToCsv([row])
    expect(csv).toContain('product,,,')
  })

  it('produces byte-for-byte identical output across repeated runs', () => {
    const row: ReportRow = {
      rowType: 'image',
      sourcePath: 'item.jpg',
      sourceFilename: 'item.jpg',
      sourceSize: '2000',
      productRowNumber: '2',
      primaryIdentifier: 'P-1',
      sanitizedIdentifier: 'P-1',
      sku: 'S-1',
      barcode: 'B-1',
      sequenceNumber: '1',
      matchMethod: 'primary_identifier',
      proposedFilename: 'P-1-1.jpg',
      proposedOutputPath: 'images/P-1-1.jpg',
      status: 'matched',
      reason: '',
    }

    const run1 = serializeReportToCsv([row])
    const run2 = serializeReportToCsv([row])
    expect(run1).toBe(run2)
  })
})

describe('generateReportCsv', () => {
  it('generates complete CSV string directly from matching engine result', () => {
    const prod = createFakeProduct({ primaryIdentifierRaw: 'PROD-99' })
    const item = createFakeItem({ basename: 'PROD-99.jpg' })
    const engineResult: MatchingEngineResult = {
      products: [],
      imageResults: [
        {
          item,
          status: 'matched',
          matchMethod: 'primary_identifier',
          matchedProductRowIndex: 0,
          matchedProduct: prod,
          primaryIdentifier: 'PROD-99',
          sequenceNumber: 1,
        },
      ],
      matchedImages: [],
      unmatchedImages: [],
      ambiguousImages: [],
      unmatchedProducts: [],
      invalidProducts: [],
      duplicateProducts: [],
      unsupportedFiles: [],
      summary: {
        totalProducts: 1,
        validProducts: 1,
        invalidProducts: 0,
        duplicateProducts: 0,
        totalImages: 1,
        supportedImages: 1,
        unsupportedFiles: 0,
        matchedImages: 1,
        unmatchedImages: 0,
        ambiguousMatches: 0,
        unmatchedProducts: 0,
      },
    }

    const csv = generateReportCsv(engineResult)
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('PROD-99-1.jpg')
  })
})

describe('downloadReportCsv', () => {
  it('creates Blob, ObjectURL, triggers link click, and revokes ObjectURL', () => {
    const createObjectURLSpy = vi.fn().mockReturnValue('blob:http://localhost/test-uuid')
    const revokeObjectURLSpy = vi.fn()
    vi.stubGlobal('URL', {
      createObjectURL: createObjectURLSpy,
      revokeObjectURL: revokeObjectURLSpy,
    })

    const clickSpy = vi.fn()
    const appendChildSpy = vi.fn()
    const removeChildSpy = vi.fn()
    const fakeLink = {
      href: '',
      setAttribute: vi.fn(),
      click: clickSpy,
    }

    const fakeDocument = {
      createElement: vi.fn().mockReturnValue(fakeLink),
      body: {
        appendChild: appendChildSpy,
        removeChild: removeChildSpy,
      },
    }
    vi.stubGlobal('document', fakeDocument)

    downloadReportCsv('sample,csv,content', 'custom-report.csv')

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1)
    expect(fakeDocument.createElement).toHaveBeenCalledWith('a')
    expect(fakeLink.setAttribute).toHaveBeenCalledWith('download', 'custom-report.csv')
    expect(appendChildSpy).toHaveBeenCalledWith(fakeLink)
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(removeChildSpy).toHaveBeenCalledWith(fakeLink)
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:http://localhost/test-uuid')

    vi.unstubAllGlobals()
  })
})
