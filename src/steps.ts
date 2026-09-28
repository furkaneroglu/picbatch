export interface WorkflowStep {
  readonly id: string
  readonly title: string
  readonly shortDescription: string
  readonly placeholderNotice: string
  readonly details: readonly string[]
}

export const WORKFLOW_STEPS: readonly WorkflowStep[] = [
  {
    id: 'product-file',
    title: '1. Product file',
    shortDescription: 'Upload a CSV or XLSX spreadsheet containing catalog data.',
    placeholderNotice: 'Step 1: Product file import will be implemented in MVP-02. File content will remain strictly on-device.',
    details: [
      'Supports CSV (auto-detecting comma, semicolon, tab) and XLSX workbooks.',
      'Sheet selection supported for multi-sheet workbooks.',
      'Preserves Turkish and Unicode characters in product identifiers.',
    ],
  },
  {
    id: 'column-mapping',
    title: '2. Column mapping',
    shortDescription: 'Map product identifiers such as SKU, barcode, and source filename.',
    placeholderNotice: 'Step 2: Column mapping will be implemented in MVP-02.',
    details: [
      'Select primary product identifier (SKU or barcode).',
      'Optionally map SKU, barcode, and current image filename columns.',
      'Column preview with detected header rows.',
    ],
  },
  {
    id: 'images',
    title: '3. Images',
    shortDescription: 'Select product images via folder picker or ZIP archive.',
    placeholderNotice: 'Step 3: Image selection will be implemented in MVP-03.',
    details: [
      'Supports JPEG, PNG, and WebP images.',
      'Import via directory picker or ZIP archive upload.',
      'Non-image files are safely ignored and reported.',
    ],
  },
  {
    id: 'match-review',
    title: '4. Match review',
    shortDescription: 'Inspect deterministic match results, unmatched items, and ambiguities.',
    placeholderNotice: 'Step 4: Matching will be implemented in MVP-04 and review UI in MVP-05. Output naming and collision reporting follow in MVP-06.',
    details: [
      'Summary counts: products, images, matched, unmatched, duplicates, collisions.',
      'Filterable review table with match method and diagnostic reasons.',
      'Strict deterministic matching: zero guessing.',
    ],
  },
  {
    id: 'processing',
    title: '5. Processing',
    shortDescription: 'Configure optional resizing, format conversion, and compression quality.',
    placeholderNotice: 'Step 5: Client-side image processing options will be implemented in MVP-07.',
    details: [
      'Optional max width/height with aspect ratio preservation (no upscaling).',
      'Format conversion: Keep original, JPEG, or WebP.',
      'Adjustable quality setting (1–100) for re-encoding.',
    ],
  },
  {
    id: 'export',
    title: '6. Export',
    shortDescription: 'Download renamed images in a ZIP archive and the picbatch-report CSV.',
    placeholderNotice: 'Step 6: Batch export and CSV report generation will be implemented in MVP-08.',
    details: [
      'Generate output ZIP with organized image structure.',
      'Include picbatch-report.csv with detailed status for every item.',
      'Excel-compatible UTF-8 with BOM encoding.',
    ],
  },
] as const

export function getStepByIndex(index: number): WorkflowStep | undefined {
  return WORKFLOW_STEPS[index]
}

export function getTotalStepCount(): number {
  return WORKFLOW_STEPS.length
}
