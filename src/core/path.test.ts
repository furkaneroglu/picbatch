import { describe, expect, it } from 'vitest'
import {
  extractBasename,
  extractExtension,
  extractStem,
  getImageMimeType,
  isSupportedImageExtension,
  normalizeRelativePath,
} from './path'

describe('Path Normalization and Extension Utilities', () => {
  it('converts Windows backslashes to forward slashes', () => {
    expect(normalizeRelativePath('Supplier\\Shoes\\ABC-1 FRONT.JPG')).toBe(
      'Supplier/Shoes/ABC-1 FRONT.JPG',
    )
  })

  it('preserves Unix forward slashes and collapses consecutive slashes', () => {
    expect(normalizeRelativePath('/Supplier//Shoes///ABC-1.png/')).toBe('Supplier/Shoes/ABC-1.png')
  })

  it('removes dot segments and prevents relative traversal above the inventory root', () => {
    expect(normalizeRelativePath('./catalog/./images/../ABC-1.JPG')).toBe('catalog/ABC-1.JPG')
    expect(normalizeRelativePath('../../Supplier/../ABC-2.png')).toBe('ABC-2.png')
  })

  it('preserves whitespace that is part of path segments and filenames', () => {
    expect(normalizeRelativePath(' Supplier / ABC-1 .JPG ')).toBe(' Supplier / ABC-1 .JPG ')
  })

  it('extracts basename preserving original casing and characters', () => {
    expect(extractBasename('Supplier/Shoes/ABC-1 FRONT.JPG')).toBe('ABC-1 FRONT.JPG')
    expect(extractBasename('photo.png')).toBe('photo.png')
  })

  it('extracts stem without extension', () => {
    expect(extractStem('ABC-1 FRONT.JPG')).toBe('ABC-1 FRONT')
    expect(extractStem('Supplier/Shoes/8690001001-1.webp')).toBe('8690001001-1')
    expect(extractStem('.DS_Store')).toBe('.DS_Store')
  })

  it('extracts extension in lowercase', () => {
    expect(extractExtension('ABC-1.JPG')).toBe('jpg')
    expect(extractExtension('PHOTO.JPEG')).toBe('jpeg')
    expect(extractExtension('IMAGE.PNG')).toBe('png')
    expect(extractExtension('graphic.WebP')).toBe('webp')
    expect(extractExtension('no_ext')).toBe('')
    expect(extractExtension('.DS_Store')).toBe('')
  })

  it('identifies supported image extensions case-insensitively', () => {
    expect(isSupportedImageExtension('jpg')).toBe(true)
    expect(isSupportedImageExtension('JPG')).toBe(true)
    expect(isSupportedImageExtension('.jpeg')).toBe(true)
    expect(isSupportedImageExtension('PNG')).toBe(true)
    expect(isSupportedImageExtension('webp')).toBe(true)
  })

  it('correctly rejects unsupported extensions', () => {
    expect(isSupportedImageExtension('txt')).toBe(false)
    expect(isSupportedImageExtension('pdf')).toBe(false)
    expect(isSupportedImageExtension('gif')).toBe(false)
    expect(isSupportedImageExtension('svg')).toBe(false)
    expect(isSupportedImageExtension('bmp')).toBe(false)
    expect(isSupportedImageExtension('heic')).toBe(false)
    expect(isSupportedImageExtension('DS_Store')).toBe(false)
  })

  it('returns appropriate MIME types for supported extensions', () => {
    expect(getImageMimeType('jpg')).toBe('image/jpeg')
    expect(getImageMimeType('jpeg')).toBe('image/jpeg')
    expect(getImageMimeType('png')).toBe('image/png')
    expect(getImageMimeType('webp')).toBe('image/webp')
    expect(getImageMimeType('pdf')).toBeUndefined()
  })
})
