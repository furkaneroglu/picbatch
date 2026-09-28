import type { ColumnMapping, ParsedSpreadsheet } from '../types/spreadsheet'
import { validatePrimaryIdentifierColumn } from '../core/table'

interface ColumnMappingStepProps {
  readonly spreadsheet: ParsedSpreadsheet
  readonly mapping: ColumnMapping
  readonly onMappingChange: (mapping: ColumnMapping) => void
  readonly onPrevious: () => void
  readonly onNext: () => void
}

export function ColumnMappingStep({
  spreadsheet,
  mapping,
  onMappingChange,
  onPrevious,
  onNext,
}: ColumnMappingStepProps) {
  const headers = spreadsheet.currentSheet.headers
  const rows = spreadsheet.currentSheet.rows

  const validation = validatePrimaryIdentifierColumn(
    mapping.primaryKeyColumn,
    headers,
    rows,
  )

  const handlePrimaryKeyChange = (column: string) => {
    onMappingChange({
      ...mapping,
      primaryKeyColumn: column,
    })
  }

  const handleSkuChange = (column: string) => {
    onMappingChange({
      ...mapping,
      skuColumn: column || null,
    })
  }

  const handleBarcodeChange = (column: string) => {
    onMappingChange({
      ...mapping,
      barcodeColumn: column || null,
    })
  }

  const handleFilenameChange = (column: string) => {
    onMappingChange({
      ...mapping,
      currentFilenameColumn: column || null,
    })
  }

  return (
    <div className="column-mapping-step">
      <div className="mapping-context-card">
        <div className="context-item">
          <span className="context-label">Current File:</span>
          <span className="context-value">{spreadsheet.fileName}</span>
        </div>
        {spreadsheet.fileType === 'xlsx' && (
          <div className="context-item">
            <span className="context-label">Active Sheet:</span>
            <span className="context-value">{spreadsheet.activeSheetName}</span>
          </div>
        )}
        <div className="context-item">
          <span className="context-label">Total Product Rows:</span>
          <span className="context-value">{rows.length}</span>
        </div>
      </div>

      <div className="mapping-form-container">
        {/* Primary Identifier (Required) */}
        <div className="mapping-field required-field">
          <div className="field-header">
            <label htmlFor="primary-key-select" className="field-label">
              Primary Product Identifier <span className="required-star">*</span>
            </label>
            <span className="field-badge required-badge">Required</span>
          </div>
          <p className="field-description">
            The unique identifier used as the base filename for exported images (e.g., <code>SKU-1.jpg</code>).
          </p>
          <select
            id="primary-key-select"
            className={`select-input ${!validation.isValid ? 'input-invalid' : ''}`}
            value={mapping.primaryKeyColumn}
            onChange={(e) => handlePrimaryKeyChange(e.target.value)}
          >
            <option value="">-- Select a column --</option>
            {headers.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>

          {/* Validation Feedback */}
          {mapping.primaryKeyColumn ? (
            <div className="validation-feedback">
              {validation.isValid ? (
                <>
                  <div className="validation-item validation-success">
                    ✓ Valid column: <strong>{validation.validRowsCount}</strong> product identifiers loaded.
                  </div>
                  {validation.blankRowsCount > 0 && (
                    <div className="validation-item validation-warning">
                      ⚠️ {validation.blankRowsCount} rows have blank identifiers and cannot be matched.
                    </div>
                  )}
                  {validation.duplicateKeysCount > 0 && (
                    <div className="validation-item validation-info">
                      ℹ️ {validation.duplicateKeysCount} duplicate keys detected (will be flagged during match review).
                    </div>
                  )}
                </>
              ) : (
                <div className="validation-item validation-error">
                  &times; {validation.errorMessage}
                </div>
              )}
            </div>
          ) : (
            <div className="validation-item validation-error">
              &times; You must select a primary identifier column to proceed.
            </div>
          )}
        </div>

        {/* SKU Column (Optional) */}
        <div className="mapping-field">
          <div className="field-header">
            <label htmlFor="sku-select" className="field-label">
              SKU Column
            </label>
            <span className="field-badge optional-badge">Optional</span>
          </div>
          <p className="field-description">
            Stock Keeping Unit column. Recommended if the primary identifier is barcode.
          </p>
          <select
            id="sku-select"
            className="select-input"
            value={mapping.skuColumn || ''}
            onChange={(e) => handleSkuChange(e.target.value)}
          >
            <option value="">-- None / Not mapped --</option>
            {headers.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>

        {/* Barcode Column (Optional) */}
        <div className="mapping-field">
          <div className="field-header">
            <label htmlFor="barcode-select" className="field-label">
              Barcode Column
            </label>
            <span className="field-badge optional-badge">Optional</span>
          </div>
          <p className="field-description">
            EAN, UPC, or GTIN numbers. Leading zeroes (e.g., <code>001234567890</code>) are strictly preserved.
          </p>
          <select
            id="barcode-select"
            className="select-input"
            value={mapping.barcodeColumn || ''}
            onChange={(e) => handleBarcodeChange(e.target.value)}
          >
            <option value="">-- None / Not mapped --</option>
            {headers.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>

        {/* Current Image Filename Column (Optional) */}
        <div className="mapping-field">
          <div className="field-header">
            <label htmlFor="filename-select" className="field-label">
              Current Image Filename Column
            </label>
            <span className="field-badge optional-badge">Optional</span>
          </div>
          <p className="field-description">
            If your product catalog specifies source filenames, explicit matching will use this column.
          </p>
          <select
            id="filename-select"
            className="select-input"
            value={mapping.currentFilenameColumn || ''}
            onChange={(e) => handleFilenameChange(e.target.value)}
          >
            <option value="">-- None / Not mapped --</option>
            {headers.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="wizard-controls">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onPrevious}
        >
          &larr; Back to Product File
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onNext}
          disabled={!validation.isValid}
          title={!validation.isValid ? 'Select a valid primary identifier to continue' : ''}
        >
          Continue to Images &rarr;
        </button>
      </div>
    </div>
  )
}
