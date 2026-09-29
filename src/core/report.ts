import type { MatchingEngineResult } from '../types/matching'
import type { OutputPlan, ReportRow } from '../types/output'
import { buildOutputPlan } from './naming'

export const REPORT_CSV_HEADERS: readonly string[] = [
  'Row Type',
  'Source Path',
  'Source Filename',
  'Source Size (Bytes)',
  'Product Row Number',
  'Primary Identifier',
  'Sanitized Identifier',
  'SKU',
  'Barcode',
  'Sequence Number',
  'Match Method',
  'Proposed Filename',
  'Proposed Output Path',
  'Status',
  'Reason',
] as const

/**
 * Escapes a single string field according to standard RFC 4180 CSV rules:
 * - If the field contains comma, quote, or newline (\r, \n), surround with double quotes.
 * - Any embedded double quotes are escaped by doubling them ("").
 */
export function escapeCsvField(value: string): string {
  if (!value) return ''
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Builds unified, comprehensive report rows covering both image-oriented records
 * and product-oriented problems in deterministic order.
 */
export function buildReportRows(
  result: MatchingEngineResult,
  plan?: OutputPlan,
): ReportRow[] {
  const outputPlan = plan ?? buildOutputPlan(result)

  // 1. Image-oriented rows (deterministic inventory order)
  const imageRows: ReportRow[] = outputPlan.imagePlans.map((imgPlan) => {
    const sizeStr = imgPlan.item.fileSize !== null && imgPlan.item.fileSize > 0
      ? String(imgPlan.item.fileSize)
      : ''
    const rowNumStr = imgPlan.matchedProduct ? String(imgPlan.matchedProduct.rowNumber) : ''
    const seqStr = imgPlan.sequenceNumber !== null ? String(imgPlan.sequenceNumber) : ''
    const reasonStr = imgPlan.reason !== '—' ? imgPlan.reason : ''

    return {
      rowType: 'image',
      sourcePath: imgPlan.item.relativePath,
      sourceFilename: imgPlan.item.basename,
      sourceSize: sizeStr,
      productRowNumber: rowNumStr,
      primaryIdentifier: imgPlan.originalIdentifier ?? '',
      sanitizedIdentifier: imgPlan.sanitizedIdentifier ?? '',
      sku: imgPlan.matchedProduct?.skuRaw ?? '',
      barcode: imgPlan.matchedProduct?.barcodeRaw ?? '',
      sequenceNumber: seqStr,
      matchMethod: imgPlan.matchMethod,
      proposedFilename: imgPlan.proposedFilename ?? '',
      proposedOutputPath: imgPlan.proposedOutputPath ?? '',
      status: imgPlan.status,
      reason: reasonStr,
    }
  })

  // 2. Product-oriented rows: Unmatched products (in spreadsheet row order)
  const unmatchedProductRows: ReportRow[] = result.unmatchedProducts.map((u) => ({
    rowType: 'product',
    sourcePath: '',
    sourceFilename: '',
    sourceSize: '',
    productRowNumber: String(u.product.rowNumber),
    primaryIdentifier: u.product.primaryIdentifierRaw || '',
    sanitizedIdentifier: '',
    sku: u.product.skuRaw ?? '',
    barcode: u.product.barcodeRaw ?? '',
    sequenceNumber: '',
    matchMethod: 'none',
    proposedFilename: '',
    proposedOutputPath: '',
    status: 'unmatched_product',
    reason: u.reason,
  }))

  // 3. Product-oriented rows: Invalid product keys (in spreadsheet row order)
  const invalidProductRows: ReportRow[] = result.invalidProducts.map((inv) => ({
    rowType: 'product',
    sourcePath: '',
    sourceFilename: '',
    sourceSize: '',
    productRowNumber: String(inv.rowNumber),
    primaryIdentifier: inv.primaryIdentifierRaw || '',
    sanitizedIdentifier: '',
    sku: inv.skuRaw ?? '',
    barcode: inv.barcodeRaw ?? '',
    sequenceNumber: '',
    matchMethod: 'none',
    proposedFilename: '',
    proposedOutputPath: '',
    status: 'invalid_product_key',
    reason: inv.reason ?? 'Blank primary product identifier',
  }))

  // 4. Product-oriented rows: Duplicate product keys (in spreadsheet row order)
  const duplicateProductRows: ReportRow[] = result.duplicateProducts.map((dup) => ({
    rowType: 'product',
    sourcePath: '',
    sourceFilename: '',
    sourceSize: '',
    productRowNumber: String(dup.rowNumber),
    primaryIdentifier: dup.primaryIdentifierRaw || '',
    sanitizedIdentifier: '',
    sku: dup.skuRaw ?? '',
    barcode: dup.barcodeRaw ?? '',
    sequenceNumber: '',
    matchMethod: 'none',
    proposedFilename: '',
    proposedOutputPath: '',
    status: 'duplicate_product_key',
    reason: dup.reason ?? `Duplicate primary product key: "${dup.primaryIdentifierRaw}"`,
  }))

  return [
    ...imageRows,
    ...unmatchedProductRows,
    ...invalidProductRows,
    ...duplicateProductRows,
  ]
}

/**
 * Serializes report rows into a comma-delimited CSV string with UTF-8 BOM.
 */
export function serializeReportToCsv(rows: readonly ReportRow[]): string {
  const BOM = '\uFEFF'
  const headerLine = REPORT_CSV_HEADERS.map(escapeCsvField).join(',')

  if (rows.length === 0) {
    return `${BOM}${headerLine}\r\n`
  }

  const dataLines = rows.map((row) =>
    [
      row.rowType,
      row.sourcePath,
      row.sourceFilename,
      row.sourceSize,
      row.productRowNumber,
      row.primaryIdentifier,
      row.sanitizedIdentifier,
      row.sku,
      row.barcode,
      row.sequenceNumber,
      row.matchMethod,
      row.proposedFilename,
      row.proposedOutputPath,
      row.status,
      row.reason,
    ]
      .map(escapeCsvField)
      .join(','),
  )

  return `${BOM}${headerLine}\r\n${dataLines.join('\r\n')}\r\n`
}

/**
 * Convenience function to generate complete report CSV directly from matching engine result.
 */
export function generateReportCsv(
  result: MatchingEngineResult,
  plan?: OutputPlan,
): string {
  const rows = buildReportRows(result, plan)
  return serializeReportToCsv(rows)
}

/**
 * Triggers a browser-side file download of the report CSV using a local Blob and Object URL.
 * Does not send any data over the network.
 */
export function downloadReportCsv(
  csvContent: string,
  filename: string = 'picbatch-report.csv',
): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    return
  }
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
