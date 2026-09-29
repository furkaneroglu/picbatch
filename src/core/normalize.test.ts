import { describe, expect, it } from 'vitest'
import {
  matchesIdentifierBoundary,
  normalizeFilenameBasename,
  normalizeFilenameStem,
  normalizeIdentifier,
} from './normalize'

describe('Identifier and Filename Normalization', () => {
  it('trims surrounding whitespace and converts to lowercase', () => {
    expect(normalizeIdentifier('  SKU-1001  ')).toBe('sku-1001')
    expect(normalizeIdentifier('\t ABC-99 \n')).toBe('abc-99')
  })

  it('preserves leading zeroes in barcodes without numeric conversion', () => {
    expect(normalizeIdentifier('001234567890')).toBe('001234567890')
    expect(normalizeIdentifier('000987654321')).toBe('000987654321')
    expect(normalizeIdentifier('001234567890')).not.toBe(normalizeIdentifier('1234567890'))
  })

  it('preserves Turkish characters and punctuation', () => {
    expect(normalizeIdentifier('GÜNEŞ GÖZLÜĞÜ')).toBe('güneş gözlüğü')
    expect(normalizeIdentifier('Çanta & Ayakkabı')).toBe('çanta & ayakkabı')
    expect(normalizeIdentifier('Şemsiye_01')).toBe('şemsiye_01')
    expect(normalizeIdentifier('Örnek-Ürün')).toBe('örnek-ürün')
  })

  it('applies Unicode NFKC normalization', () => {
    // \u0041\u030A is 'A' with combining ring above; NFKC normalizes to '\u00C5' ('Å')
    const decomposed = 'A\u030A-100'
    const precomposed = '\u00C5-100'
    expect(normalizeIdentifier(decomposed)).toBe(normalizeIdentifier(precomposed))
  })

  it('normalizes filename basename and stem correctly', () => {
    expect(normalizeFilenameBasename('Supplier\\Shoes\\ABC-1 FRONT.JPG')).toBe('abc-1 front.jpg')
    expect(normalizeFilenameStem('Supplier/Shoes/ABC-1 FRONT.JPG')).toBe('abc-1 front')
    expect(normalizeFilenameStem('IMG_001.webp')).toBe('img_001')
  })

  describe('matchesIdentifierBoundary', () => {
    const id = normalizeIdentifier('ABC-123')

    it('matches exact identifier stem', () => {
      expect(matchesIdentifierBoundary('abc-123', id)).toBe(true)
    })

    it('matches identifier followed by hyphen (-)', () => {
      expect(matchesIdentifierBoundary('abc-123-1', id)).toBe(true)
      expect(matchesIdentifierBoundary('abc-123-front', id)).toBe(true)
    })

    it('matches identifier followed by underscore (_)', () => {
      expect(matchesIdentifierBoundary('abc-123_02', id)).toBe(true)
    })

    it('matches identifier followed by space ( )', () => {
      expect(matchesIdentifierBoundary('abc-123 (front)', id)).toBe(true)
      expect(matchesIdentifierBoundary('abc-123 detail', id)).toBe(true)
    })

    it('matches identifier followed by open parenthesis (()', () => {
      expect(matchesIdentifierBoundary('abc-123(1)', id)).toBe(true)
    })

    it('rejects identifier followed by another alphanumeric character', () => {
      expect(matchesIdentifierBoundary('abc-1234', id)).toBe(false)
      expect(matchesIdentifierBoundary('abc-123a', id)).toBe(false)
    })

    it('rejects substring match if identifier is preceded by characters', () => {
      expect(matchesIdentifierBoundary('xabc-123', id)).toBe(false)
      expect(matchesIdentifierBoundary('prefix-abc-123', id)).toBe(false)
    })

    it('prevents prefix false positives (ABC-1 vs ABC-10)', () => {
      const id1 = normalizeIdentifier('ABC-1')
      const id10 = normalizeIdentifier('ABC-10')

      expect(matchesIdentifierBoundary('abc-1', id1)).toBe(true)
      expect(matchesIdentifierBoundary('abc-10', id10)).toBe(true)

      // ABC-1 must NOT match ABC-10
      expect(matchesIdentifierBoundary('abc-10', id1)).toBe(false)
    })
  })
})
