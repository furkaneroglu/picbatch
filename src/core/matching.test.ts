import { describe, expect, it } from 'vitest'
import type { ColumnMapping } from '../types/spreadsheet'
import type { ImageInventory, ImageInventoryItem } from '../types/image'
import {
  buildProductRecords,
  executeDeterministicMatching,
} from './matching'

function createMockImage(relativePath: string, isSupported = true): ImageInventoryItem {
  const normPath = relativePath.replace(/\\/g, '/')
  const lastSlash = normPath.lastIndexOf('/')
  const basename = lastSlash === -1 ? normPath : normPath.slice(lastSlash + 1)
  const lastDot = basename.lastIndexOf('.')
  const stem = lastDot > 0 ? basename.slice(0, lastDot) : basename
  const extension = lastDot > 0 ? basename.slice(lastDot + 1).toLowerCase() : ''

  return {
    id: `img-${normPath}`,
    originalFilename: basename,
    basename,
    stem,
    extension,
    relativePath: normPath,
    fileSize: 1024,
    mimeType: isSupported ? 'image/jpeg' : undefined,
    sourceMethod: 'folder',
    isSupported,
    fileRef: new Blob([]),
  }
}

function createMockInventory(relativePaths: string[], unsupportedPaths: string[] = []): ImageInventory {
  const supportedItems = relativePaths.map((p) => createMockImage(p, true))
  const unsupportedItems = unsupportedPaths.map((p) => createMockImage(p, false))
  const allItems = [...supportedItems, ...unsupportedItems]

  return {
    sourceMethod: 'folder',
    sourceName: 'TestFolder',
    items: allItems,
    supportedItems,
    unsupportedItems,
    totalFileCount: allItems.length,
    supportedFileCount: supportedItems.length,
    unsupportedFileCount: unsupportedItems.length,
    totalSourceBytes: allItems.length * 1024,
    totalSupportedBytes: supportedItems.length * 1024,
    hasLargeDatasetWarning: false,
  }
}

describe('Deterministic Matching Engine', () => {
  describe('Product Records Building and Primary Keys', () => {
    const mapping: ColumnMapping = {
      primaryKeyColumn: 'SKU',
      skuColumn: 'SKU',
      barcodeColumn: 'Barcode',
      currentFilenameColumn: null,
    }

    it('classifies blank primary keys as invalid_product_key', () => {
      const rows = [
        { SKU: 'ABC-1', Barcode: '869001' },
        { SKU: '   ', Barcode: '869002' },
        { SKU: '', Barcode: '869003' },
      ]

      const products = buildProductRecords(rows, mapping)
      expect(products[0]?.status).toBe('valid')
      expect(products[1]?.status).toBe('invalid_product_key')
      expect(products[2]?.status).toBe('invalid_product_key')
    })

    it('detects duplicate primary product keys case-insensitively and never auto-assigns them', () => {
      const rows = [
        { SKU: 'ABC-100', Barcode: '111' },
        { SKU: 'abc-100', Barcode: '222' },
        { SKU: 'XYZ-999', Barcode: '333' },
      ]

      const products = buildProductRecords(rows, mapping)
      expect(products[0]?.status).toBe('duplicate_product_key')
      expect(products[1]?.status).toBe('duplicate_product_key')
      expect(products[2]?.status).toBe('valid')

      const inventory = createMockInventory(['ABC-100.jpg', 'XYZ-999.jpg'])
      const result = executeDeterministicMatching(rows, mapping, inventory)

      // ABC-100 must be marked duplicate_product_key and not matched
      const abcMatch = result.imageResults.find((r) => r.item.basename === 'ABC-100.jpg')
      expect(abcMatch?.status).toBe('duplicate_product_key')
      expect(result.summary.matchedImages).toBe(1)
      expect(result.matchedImages[0]?.primaryIdentifier).toBe('XYZ-999')
    })
  })

  describe('Filename Inference & Prefix Collision Handling', () => {
    const mapping: ColumnMapping = {
      primaryKeyColumn: 'SKU',
      skuColumn: null,
      barcodeColumn: null,
      currentFilenameColumn: null,
    }

    it('matches exact identifier stem and valid boundaries (-, _, space, ()', () => {
      const rows = [{ SKU: 'ABC-123' }]
      const inventory = createMockInventory([
        'ABC-123.jpg',
        'ABC-123-1.png',
        'ABC-123_02.webp',
        'ABC-123 (front).jpeg',
        'ABC-123(back).jpg',
        'ABC-123 detail.jpg',
        'ABC-1234.jpg', // Invalid boundary: 4
        'XABC-123.jpg', // Substring match rejected
      ])

      const result = executeDeterministicMatching(rows, mapping, inventory)

      expect(result.summary.matchedImages).toBe(6)
      expect(result.summary.unmatchedImages).toBe(2)

      const unmatched = result.unmatchedImages.map((u) => u.item.basename)
      expect(unmatched).toContain('ABC-1234.jpg')
      expect(unmatched).toContain('XABC-123.jpg')
    })

    it('MANDATORY FIXTURE: prevents prefix false positives between ABC-1 and ABC-10', () => {
      const rows = [
        { SKU: 'ABC-1' },
        { SKU: 'ABC-10' },
      ]
      const inventory = createMockInventory([
        'ABC-1.jpg',
        'ABC-10.jpg',
        'ABC-1-front.jpg',
        'ABC-10-back.jpg',
      ])

      const result = executeDeterministicMatching(rows, mapping, inventory)

      expect(result.summary.matchedImages).toBe(4)
      expect(result.summary.ambiguousMatches).toBe(0)

      const img1 = result.imageResults.find((r) => r.item.basename === 'ABC-1.jpg')
      const img10 = result.imageResults.find((r) => r.item.basename === 'ABC-10.jpg')
      const img1Front = result.imageResults.find((r) => r.item.basename === 'ABC-1-front.jpg')
      const img10Back = result.imageResults.find((r) => r.item.basename === 'ABC-10-back.jpg')

      expect(img1?.matchedProduct?.primaryIdentifierRaw).toBe('ABC-1')
      expect(img10?.matchedProduct?.primaryIdentifierRaw).toBe('ABC-10')
      expect(img1Front?.matchedProduct?.primaryIdentifierRaw).toBe('ABC-1')
      expect(img10Back?.matchedProduct?.primaryIdentifierRaw).toBe('ABC-10')
    })

    it('prefers the longest most specific prefix match when nested prefixes exist', () => {
      const rows = [
        { SKU: 'ABC-1' },
        { SKU: 'ABC-1-X' },
      ]
      const inventory = createMockInventory(['ABC-1-X-front.jpg'])
      const result = executeDeterministicMatching(rows, mapping, inventory)

      expect(result.summary.matchedImages).toBe(1)
      expect(result.matchedImages[0]?.matchedProduct?.primaryIdentifierRaw).toBe('ABC-1-X')
    })
  })

  describe('Explicit Current Filename Matching', () => {
    const mapping: ColumnMapping = {
      primaryKeyColumn: 'SKU',
      skuColumn: null,
      barcodeColumn: null,
      currentFilenameColumn: 'CurrentFilename',
    }

    it('explicit filename takes highest precedence and overrides identifier inference', () => {
      const rows = [
        { SKU: 'PRODUCT-A', CurrentFilename: 'IMG_999.jpg' },
        { SKU: 'IMG_999', CurrentFilename: '' }, // Inferred match would target this, but explicit must win
      ]
      const inventory = createMockInventory(['IMG_999.jpg'])

      const result = executeDeterministicMatching(rows, mapping, inventory)

      expect(result.summary.matchedImages).toBe(1)
      expect(result.matchedImages[0]?.matchMethod).toBe('explicit_filename')
      expect(result.matchedImages[0]?.matchedProduct?.primaryIdentifierRaw).toBe('PRODUCT-A')
    })

    it('matches explicit filenames case-insensitively with extension differences', () => {
      const rows = [{ SKU: 'SHOES-01', CurrentFilename: 'IMG_1001.JPG' }]
      const inventory = createMockInventory(['img_1001.jpg'])

      const result = executeDeterministicMatching(rows, mapping, inventory)

      expect(result.summary.matchedImages).toBe(1)
      expect(result.matchedImages[0]?.matchMethod).toBe('explicit_filename')
      expect(result.matchedImages[0]?.matchedProduct?.primaryIdentifierRaw).toBe('SHOES-01')
    })

    it('flags explicit filename matching multiple rows as ambiguous_match', () => {
      const rows = [
        { SKU: 'PRODUCT-1', CurrentFilename: 'shared-photo.jpg' },
        { SKU: 'PRODUCT-2', CurrentFilename: 'shared-photo.jpg' },
      ]
      const inventory = createMockInventory(['shared-photo.jpg'])

      const result = executeDeterministicMatching(rows, mapping, inventory)

      expect(result.summary.matchedImages).toBe(0)
      expect(result.summary.ambiguousMatches).toBe(1)
      expect(result.imageResults[0]?.status).toBe('ambiguous_match')
      expect(result.imageResults[0]?.reason).toContain('Explicit filename matches 2 product rows')
    })

    it('rejects multiple source images sharing the explicit filename basename as ambiguous_match', () => {
      const rows = [{ SKU: 'PROD-1', CurrentFilename: 'front.jpg' }]
      const inventory = createMockInventory(['folder-a/front.jpg', 'folder-b/front.jpg'])

      const result = executeDeterministicMatching(rows, mapping, inventory)

      expect(result.summary.matchedImages).toBe(0)
      expect(result.summary.ambiguousMatches).toBe(2)
      expect(result.summary.unmatchedProducts).toBe(1)

      const imgA = result.imageResults.find((r) => r.item.relativePath === 'folder-a/front.jpg')
      const imgB = result.imageResults.find((r) => r.item.relativePath === 'folder-b/front.jpg')

      expect(imgA?.status).toBe('ambiguous_match')
      expect(imgA?.matchMethod).toBe('explicit_filename')
      expect(imgA?.reason).toContain('Multiple source images share the explicit filename "front.jpg"')

      expect(imgB?.status).toBe('ambiguous_match')
      expect(imgB?.matchMethod).toBe('explicit_filename')
      expect(imgB?.reason).toContain('Multiple source images share the explicit filename "front.jpg"')
    })

    it('matches exact basename but rejects stem fallback as ambiguous_match when multiple source images share stem', () => {
      const rows = [{ SKU: 'PROD-1', CurrentFilename: 'front.jpg' }]
      const inventory = createMockInventory(['front.jpg', 'front.png'])

      const result = executeDeterministicMatching(rows, mapping, inventory)

      expect(result.summary.matchedImages).toBe(1)
      expect(result.summary.ambiguousMatches).toBe(1)

      const exactMatch = result.imageResults.find((r) => r.item.basename === 'front.jpg')
      const stemAmbiguous = result.imageResults.find((r) => r.item.basename === 'front.png')

      expect(exactMatch?.status).toBe('matched')
      expect(exactMatch?.matchMethod).toBe('explicit_filename')
      expect(exactMatch?.matchedProduct?.primaryIdentifierRaw).toBe('PROD-1')

      expect(stemAmbiguous?.status).toBe('ambiguous_match')
      expect(stemAmbiguous?.matchMethod).toBe('explicit_filename')
      expect(stemAmbiguous?.reason).toContain(
        'Multiple source images share the stem "front" for explicit filename fallback',
      )
    })

    it('allows safe extension-insensitive explicit match when only a single source image shares that stem', () => {
      const rows = [{ SKU: 'PROD-1', CurrentFilename: 'front.jpg' }]
      const inventory = createMockInventory(['front.png'])

      const result = executeDeterministicMatching(rows, mapping, inventory)

      expect(result.summary.matchedImages).toBe(1)
      expect(result.summary.ambiguousMatches).toBe(0)

      const match = result.imageResults.find((r) => r.item.basename === 'front.png')
      expect(match?.status).toBe('matched')
      expect(match?.matchMethod).toBe('explicit_filename')
      expect(match?.matchedProduct?.primaryIdentifierRaw).toBe('PROD-1')
    })
  })

  describe('SKU and Barcode Matching with Disagreement & Duplicates', () => {
    const mapping: ColumnMapping = {
      primaryKeyColumn: 'SKU',
      skuColumn: 'SKU',
      barcodeColumn: 'Barcode',
      currentFilenameColumn: null,
    }

    it('preserves leading zeroes in barcode matching', () => {
      const rows = [
        { SKU: 'TR-100', Barcode: '001234567890' },
        { SKU: 'TR-200', Barcode: '1234567890' },
      ]
      const inventory = createMockInventory(['001234567890.jpg', '1234567890.jpg'])

      const result = executeDeterministicMatching(rows, mapping, inventory)

      expect(result.summary.matchedImages).toBe(2)
      const zeroMatch = result.imageResults.find((r) => r.item.basename === '001234567890.jpg')
      const noZeroMatch = result.imageResults.find((r) => r.item.basename === '1234567890.jpg')

      expect(zeroMatch?.matchedProduct?.primaryIdentifierRaw).toBe('TR-100')
      expect(noZeroMatch?.matchedProduct?.primaryIdentifierRaw).toBe('TR-200')
    })

    it('matches when both SKU and barcode point to the same product row', () => {
      const rows = [{ SKU: 'ITEM-01', Barcode: '8690001001' }]
      const inventory = createMockInventory(['ITEM-01.jpg', '8690001001.jpg'])

      const result = executeDeterministicMatching(rows, mapping, inventory)
      expect(result.summary.matchedImages).toBe(2)
      expect(result.matchedImages[0]?.matchedProduct?.primaryIdentifierRaw).toBe('ITEM-01')
      expect(result.matchedImages[1]?.matchedProduct?.primaryIdentifierRaw).toBe('ITEM-01')
    })

    it('marks as ambiguous_match when SKU and Barcode point to different products', () => {
      const rows = [
        { SKU: 'SAME-NAME', Barcode: '999999' },
        { SKU: 'OTHER', Barcode: 'SAME-NAME' }, // Barcode matches image stem, but SKU matches row 0
      ]
      const inventory = createMockInventory(['SAME-NAME.jpg'])

      const result = executeDeterministicMatching(rows, mapping, inventory)

      expect(result.summary.matchedImages).toBe(0)
      expect(result.summary.ambiguousMatches).toBe(1)
      expect(result.imageResults[0]?.status).toBe('ambiguous_match')
      expect(result.imageResults[0]?.reason).toContain('Conflicting matches')
    })

    it('marks as ambiguous_match when duplicate SKU lookup key exists on distinct products', () => {
      const distinctMapping: ColumnMapping = {
        primaryKeyColumn: 'ID',
        skuColumn: 'SKU',
        barcodeColumn: null,
        currentFilenameColumn: null,
      }
      const rows = [
        { ID: 'PROD-1', SKU: 'SHARED-SKU' },
        { ID: 'PROD-2', SKU: 'SHARED-SKU' },
      ]
      const inventory = createMockInventory(['SHARED-SKU.jpg'])

      const result = executeDeterministicMatching(rows, distinctMapping, inventory)
      expect(result.summary.matchedImages).toBe(0)
      expect(result.summary.ambiguousMatches).toBe(1)
      expect(result.imageResults[0]?.status).toBe('ambiguous_match')
      expect(result.imageResults[0]?.reason).toContain('via SKU')
    })

    it('marks as ambiguous_match when duplicate barcode lookup key exists on distinct products', () => {
      const distinctMapping: ColumnMapping = {
        primaryKeyColumn: 'ID',
        skuColumn: null,
        barcodeColumn: 'Barcode',
        currentFilenameColumn: null,
      }
      const rows = [
        { ID: 'PROD-1', Barcode: '8690001001' },
        { ID: 'PROD-2', Barcode: '8690001001' },
      ]
      const inventory = createMockInventory(['8690001001.jpg'])

      const result = executeDeterministicMatching(rows, distinctMapping, inventory)
      expect(result.summary.matchedImages).toBe(0)
      expect(result.summary.ambiguousMatches).toBe(1)
      expect(result.imageResults[0]?.status).toBe('ambiguous_match')
      expect(result.imageResults[0]?.reason).toContain('via BARCODE')
    })
  })

  describe('Multiple Images per Product and Stable Natural Ordering', () => {
    const mapping: ColumnMapping = {
      primaryKeyColumn: 'SKU',
      skuColumn: null,
      barcodeColumn: null,
      currentFilenameColumn: null,
    }

    it('assigns 1-based natural sequence ordering to multiple matched images', () => {
      const rows = [{ SKU: 'PROD-A' }]
      const inventory = createMockInventory([
        'Supplier/PROD-A-10.jpg',
        'Supplier/PROD-A-2.jpg',
        'Supplier/PROD-A-1.jpg',
        'Supplier/PROD-A-20.jpg',
      ])

      const result = executeDeterministicMatching(rows, mapping, inventory)

      expect(result.summary.matchedImages).toBe(4)

      const img1 = result.matchedImages.find((m) => m.item.relativePath === 'Supplier/PROD-A-1.jpg')
      const img2 = result.matchedImages.find((m) => m.item.relativePath === 'Supplier/PROD-A-2.jpg')
      const img10 = result.matchedImages.find((m) => m.item.relativePath === 'Supplier/PROD-A-10.jpg')
      const img20 = result.matchedImages.find((m) => m.item.relativePath === 'Supplier/PROD-A-20.jpg')

      expect(img1?.sequenceNumber).toBe(1)
      expect(img2?.sequenceNumber).toBe(2)
      expect(img10?.sequenceNumber).toBe(3)
      expect(img20?.sequenceNumber).toBe(4)
    })

    it('produces identical matching and sequencing across repeated runs', () => {
      const rows = [{ SKU: 'ABC-1' }, { SKU: 'XYZ-2' }]
      const inventory = createMockInventory([
        'photos/ABC-1-2.jpg',
        'photos/XYZ-2.png',
        'photos/ABC-1-1.jpg',
      ])

      const run1 = executeDeterministicMatching(rows, mapping, inventory)
      const run2 = executeDeterministicMatching(rows, mapping, inventory)

      expect(run1.imageResults.map((r) => ({ id: r.item.id, status: r.status, seq: r.sequenceNumber })))
        .toEqual(run2.imageResults.map((r) => ({ id: r.item.id, status: r.status, seq: r.sequenceNumber })))
    })
  })

  describe('Unmatched Products and Unsupported Inventory Items', () => {
    const mapping: ColumnMapping = {
      primaryKeyColumn: 'SKU',
      skuColumn: null,
      barcodeColumn: null,
      currentFilenameColumn: null,
    }

    it('identifies unmatched products and unsupported files correctly', () => {
      const rows = [
        { SKU: 'PROD-MATCHED' },
        { SKU: 'PROD-NO-IMAGE' },
      ]
      const inventory = createMockInventory(
        ['PROD-MATCHED.jpg', 'ORPHAN-IMAGE.jpg'],
        ['readme.txt', 'data.pdf'],
      )

      const result = executeDeterministicMatching(rows, mapping, inventory)

      expect(result.summary.matchedImages).toBe(1)
      expect(result.summary.unmatchedImages).toBe(1)
      expect(result.summary.unsupportedFiles).toBe(2)
      expect(result.summary.unmatchedProducts).toBe(1)

      expect(result.unmatchedProducts[0]?.product.primaryIdentifierRaw).toBe('PROD-NO-IMAGE')
      expect(result.unmatchedImages[0]?.item.basename).toBe('ORPHAN-IMAGE.jpg')

      const unsupported = result.unsupportedFiles.map((u) => u.item.originalFilename)
      expect(unsupported).toEqual(['readme.txt', 'data.pdf'])
    })
  })

  describe('Turkish and Unicode Identifiers', () => {
    const mapping: ColumnMapping = {
      primaryKeyColumn: 'StokKodu',
      skuColumn: 'StokKodu',
      barcodeColumn: null,
      currentFilenameColumn: null,
    }

    it('matches Turkish product identifiers correctly', () => {
      const rows = [
        { StokKodu: 'Çanta-Örneği_01' },
        { StokKodu: 'Güneş-Gözlüğü' },
      ]
      const inventory = createMockInventory([
        'çanta-örneği_01-1.jpg',
        'GÜNEŞ-GÖZLÜĞÜ.png',
      ])

      const result = executeDeterministicMatching(rows, mapping, inventory)

      expect(result.summary.matchedImages).toBe(2)
      expect(result.matchedImages[0]?.matchedProduct?.primaryIdentifierRaw).toBe('Çanta-Örneği_01')
      expect(result.matchedImages[1]?.matchedProduct?.primaryIdentifierRaw).toBe('Güneş-Gözlüğü')
    })
  })
})
