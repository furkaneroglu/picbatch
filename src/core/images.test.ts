import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import {
  buildImageInventoryFromFiles,
  buildImageInventoryFromZip,
} from './images'

describe('Image Ingestion and Inventory', () => {
  describe('buildImageInventoryFromFiles', () => {
    it('normalizes folder file input and filters supported images', () => {
      const file1 = new File(['fake-jpg-content'], 'photo1.JPG', { type: 'image/jpeg' })
      Object.defineProperty(file1, 'webkitRelativePath', {
        value: 'Supplier\\Shoes\\photo1.JPG',
      })

      const file2 = new File(['fake-png-content'], 'photo2.png', { type: 'image/png' })
      Object.defineProperty(file2, 'webkitRelativePath', {
        value: 'Supplier/Shoes/photo2.png',
      })

      const file3 = new File(['readme text'], 'readme.txt', { type: 'text/plain' })
      Object.defineProperty(file3, 'webkitRelativePath', {
        value: 'Supplier/Shoes/readme.txt',
      })

      const inventory = buildImageInventoryFromFiles([file1, file2, file3])

      expect(inventory.sourceMethod).toBe('folder')
      expect(inventory.sourceName).toBe('Supplier')
      expect(inventory.totalFileCount).toBe(3)
      expect(inventory.supportedFileCount).toBe(2)
      expect(inventory.unsupportedFileCount).toBe(1)
      expect(inventory.totalSourceBytes).toBe(file1.size + file2.size + file3.size)
      expect(inventory.supportedItems[0]?.relativePath).toBe('Supplier/Shoes/photo1.JPG')
      expect(inventory.supportedItems[0]?.basename).toBe('photo1.JPG')
      expect(inventory.supportedItems[0]?.stem).toBe('photo1')
      expect(inventory.supportedItems[0]?.extension).toBe('jpg')
      expect(inventory.supportedItems[1]?.relativePath).toBe('Supplier/Shoes/photo2.png')
      expect(inventory.unsupportedItems[0]?.relativePath).toBe('Supplier/Shoes/readme.txt')
      expect(inventory.unsupportedItems[0]?.isSupported).toBe(false)
      expect(inventory.unsupportedItems[0]?.fileSize).toBe(file3.size)
      expect(inventory.unsupportedItems[0]?.fileRef).toBe(file3)
    })

    it('detects duplicate normalized relative paths without overwriting items', () => {
      const file1 = new File(['content1'], 'item.jpg', { type: 'image/jpeg' })
      Object.defineProperty(file1, 'webkitRelativePath', { value: 'catalog/a/../item.jpg' })

      const file2 = new File(['content2'], 'item.jpg', { type: 'image/jpeg' })
      Object.defineProperty(file2, 'webkitRelativePath', { value: 'catalog/item.jpg' })

      const inventory = buildImageInventoryFromFiles([file1, file2])

      expect(inventory.items).toHaveLength(2)
      expect(inventory.items[0]?.relativePath).toBe('catalog/item.jpg')
      expect(inventory.items[1]?.relativePath).toBe('catalog/item.jpg')
      expect(inventory.items[0]?.hasDuplicatePath).toBe(true)
      expect(inventory.items[1]?.hasDuplicatePath).toBe(true)
    })

    it('calculates total supported and total selected bytes correctly', () => {
      const file1 = new File([new Uint8Array(100)], 'a.jpg')
      const file2 = new File([new Uint8Array(250)], 'b.png')
      const file3 = new File([new Uint8Array(500)], 'c.pdf')

      const inventory = buildImageInventoryFromFiles([file1, file2, file3])

      expect(inventory.totalSupportedBytes).toBe(350)
      expect(inventory.totalSourceBytes).toBe(850)
      expect(inventory.hasLargeDatasetWarning).toBe(false)
    })
  })

  describe('buildImageInventoryFromZip', () => {
    it('extracts nested images, ignores directory entries, and preserves paths', async () => {
      const zip = new JSZip()
      zip.folder('catalog')
      zip.folder('catalog/subfolder')
      zip.file('catalog/subfolder/TR-01 FRONT.JPG', 'synthetic-image-data')
      zip.file('catalog/TR-02.webp', 'synthetic-webp-data')
      zip.file('catalog/notes.pdf', 'pdf-content')

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const zipFile = new File([zipBlob], 'products.zip', { type: 'application/zip' })

      const inventory = await buildImageInventoryFromZip(zipFile)

      expect(inventory.sourceMethod).toBe('zip')
      expect(inventory.sourceName).toBe('products.zip')
      expect(inventory.totalSourceBytes).toBe(zipFile.size)
      expect(inventory.totalFileCount).toBe(3)
      expect(inventory.supportedFileCount).toBe(2)
      expect(inventory.unsupportedFileCount).toBe(1)

      const firstImage = inventory.supportedItems.find((i) => i.extension === 'jpg')
      expect(firstImage?.relativePath).toBe('catalog/subfolder/TR-01 FRONT.JPG')
      expect(firstImage?.basename).toBe('TR-01 FRONT.JPG')
      expect(firstImage?.stem).toBe('TR-01 FRONT')
      expect(firstImage?.mimeType).toBe('image/jpeg')
      expect(firstImage?.fileRef).toBeInstanceOf(Blob)
      expect(firstImage?.fileSize).toBeGreaterThan(0)

      const webpImage = inventory.supportedItems.find((i) => i.extension === 'webp')
      expect(webpImage?.relativePath).toBe('catalog/TR-02.webp')
      expect(webpImage?.mimeType).toBe('image/webp')

      const unsupported = inventory.unsupportedItems[0]
      expect(unsupported?.relativePath).toBe('catalog/notes.pdf')
      expect(unsupported?.fileSize).toBeNull()
      expect(unsupported?.fileRef).toBeNull()
    })

    it('rejects ZIP with zero supported images', async () => {
      const zip = new JSZip()
      zip.file('notes.txt', 'hello')
      zip.file('manual.pdf', 'pdf')

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const zipFile = new File([zipBlob], 'no-images.zip', { type: 'application/zip' })

      await expect(buildImageInventoryFromZip(zipFile)).rejects.toThrow(
        'contains no supported images',
      )
    })

    it('rejects corrupt/invalid ZIP files', async () => {
      const corruptFile = new File([new Uint8Array([1, 2, 3, 4, 5])], 'corrupt.zip', {
        type: 'application/zip',
      })
      await expect(buildImageInventoryFromZip(corruptFile)).rejects.toThrow(
        'not a valid ZIP archive',
      )
    })

    it('rejects empty (0 bytes) ZIP file', async () => {
      const emptyFile = new File([], 'empty.zip', { type: 'application/zip' })
      await expect(buildImageInventoryFromZip(emptyFile)).rejects.toThrow('is empty (0 bytes)')
    })
  })
})
